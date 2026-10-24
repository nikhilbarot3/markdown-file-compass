# Coverage Pre-Check

A patient-facing pre-check for medical equipment (back brace, walker, CPAP, wheelchair). Pick a
health plan, upload a prescription or describe what you need, and the app reads it, checks it
against that plan's own policy rules, and shows which nearby suppliers have the item in stock —
with the price checked against the plan's annual limit.

**All data in this repository is synthetic and labelled "(sample)".** This is a demonstration, not
a coverage decision.

## How an answer is produced

1. **Gemma reads the request** — `google/gemma-4-31b-it` through OpenRouter. Text, a photo, or a
   PDF (PDF text is extracted server-side with `unpdf`) is turned into the equipment item,
   prescriber and diagnosis. If no item is present, you get a normal conversational reply instead.
2. **Retrieval over the plan's rules** — BM25 ranks rows of `public.policy_sections` for that plan
   and item, so only the relevant sections reach the model (`src/lib/rag.ts`).
3. **Gemma writes the answer** — plain language, citing only the retrieved sections.
4. **Every number comes from SQL** — price, annual limit, stock counts and network membership are
   read from the database, never from the model.
5. **The match score is plain code** — four hand-weighted checks in `src/lib/precheck.ts`: item
   recognised, plan rule found, supplier in network and in stock, price within the limit.

## Requirements

- Node.js 20+ and npm (`bun` also works — `bun.lock` is committed)
- A PostgreSQL database reachable with the Supabase JS client
- An OpenRouter API key (see below)

## Quick start

```sh
git clone <repository-url>
cd <repository-name>
npm install
npm run dev
```

Vite prints the local URL when it starts (typically `http://localhost:5173`).

With bun instead: `bun install` then `bun run dev`.

## Environment variables

The app reads these at runtime. A `.env` is committed with the original hosted backend's
*publishable* values — those are safe to publish by design, but they point at the original
project's database. Replace them to run against your own.

| Variable | Required | Purpose |
| --- | --- | --- |
| `SUPABASE_URL` | yes | Database URL, used by server code |
| `SUPABASE_PUBLISHABLE_KEY` | yes | Publishable key, used by server code |
| `VITE_SUPABASE_URL` | yes | Same URL, used by the browser |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | yes | Same key, used by the browser |
| `OPENROUTER_API_KEY` | yes | Gemma access. Server-only — never prefix it with `VITE_` |
| `VITE_BACKEND_URL` | no | Route the chat to your own backend instead of the built-in pipeline |

## Adding the OpenRouter key

1. Sign in at [openrouter.ai](https://openrouter.ai), open **Keys**, and create a key.
2. Add it to `.env` at the project root:

   ```sh
   OPENROUTER_API_KEY=***
   ```

   Editing `.env` while the dev server is running does not take effect — restart `npm run dev`.
   When running inside Lovable, add it as a project secret instead
   (**Settings → Secrets**) so it never enters the repository.
3. Check it worked: open the app and type `hi`. You should get a conversational reply asking what
   equipment you need. `Gemma key is not configured.` means the variable isn't reaching the server.

The model is pinned in one place — `GEMMA_MODEL` in `src/lib/gemma.server.ts`. Point it at any
other OpenRouter model to swap it.

## Sample data setup

The schema and every sample row live in `drizzle/migrations`. Apply the files **in numeric order**
— `0001` references tables created by `0000`.

```sh
psql "$DATABASE_URL" -f drizzle/migrations/0000_migration.sql
psql "$DATABASE_URL" -f drizzle/migrations/0001_migration.sql
```

Or open each file and run its contents in your database's SQL editor.

Six tables, all read-only: `plans`, `equipment_items`, `suppliers`, `supplier_stock`,
`supplier_networks`, `policy_sections`. Each has row-level security enabled with a public `SELECT`
policy and no write access, so the app can read but never modify them.

What's in them:

- **2 plans** — BlueCare PPO (sample), annual limit $250; Metro Medicaid (sample), annual limit $400
- **6 equipment items** — back brace, walker, CPAP, wheelchair, knee brace, cane, each with an
  HCPCS code, category, material and price
- **4 suppliers** — Detroit-area, with address, area and phone
- **Stock counts** — deliberately including zero-stock rows, so "Out of stock" and a lower match
  score are visible in the interface
- **Network membership** — which supplier is in-network for which plan
- **Policy sections** — 2.1 Network, 4.2 DME coverage, 4.5 Prior authorization, 4.7 Annual limit
  for each plan, with 4.5 tied to specific items

## Try it

- Type `I need a walker` on **Metro Medicaid** — Corktown Health Equipment appears greyed out with
  "Out of stock" and a lower match score than the stocked suppliers.
- Type `I need a back brace` on **BlueCare PPO** — prior authorization is required (section 4.5),
  and $180 is shown against the $250 annual limit.
- Upload a PDF or a photo of a prescription and press **Submit**.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run preview` | Serve the production build |
| `npm test` | Run the test suite (match score, item detection, retrieval) |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |

## Where things live

| Path | Contents |
| --- | --- |
| `src/routes/index.tsx` | The single dashboard screen |
| `src/lib/analyze.functions.ts` | Server function: read → retrieve → answer |
| `src/lib/gemma.server.ts` | The OpenRouter call (server-only) |
| `src/lib/rag.ts` | BM25 retrieval over policy sections |
| `src/lib/precheck.ts` | Match score, supplier ranking, packet text, wording rules |
| `src/lib/precheck.test.ts` | Tests for the above |
| `drizzle/migrations/` | Schema plus all sample data |

## Rules this app holds to

- Never says "approved" or "pre-approved". Only **Likely covered**, **Needs prior authorization**,
  **Within plan limit**, **Ready to submit**.
- Exact supplier, stock and price figures always come from SQL, not the model.
- The footer disclaimer appears on every screen.
- Everything is synthetic and labelled "(sample)".
