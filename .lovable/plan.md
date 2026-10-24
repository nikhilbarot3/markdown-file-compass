# Coverage Pre-Check: what I understood

## 1. Purpose
A hackathon demo (Hack for Humanity Detroit, Track 04) that helps patients see if medical equipment like a back brace, walker, or CPAP is likely covered by their insurance. It also finds nearby in-network suppliers that have the item in stock. All data is fake (synthetic), and Gemma is the AI model at the core.

## 2. User flow
1. Pick a plan: BlueCare PPO (sample) or Metro Medicaid (sample).
2. Upload a photo or PDF of a prescription, and/or type something like "I need a back brace".
3. The app sends this to your Python backend (`POST BACKEND_URL/chat`).
4. Review the policy facts, supplier ranking, and score. Then copy the packet or tap Get directions.

## 3. Screen layout (what Lovable builds)
- **Left panel:** plan dropdown, upload box, chat thread with a message box.
- **Right panel:**
  - Summary tiles: Equipment, Plan status, Suppliers matched, Best match score
  - Policy facts table: fact, plan section, result badge (Met / Action needed / Within limit)
  - Limit meter, e.g. "$180 of $250"
  - Ranked supplier table. Out-of-stock and out-of-network suppliers are greyed out with the reason.
  - "Why 92%?" breakdown of the checks behind the score
  - Copy packet and Get directions buttons
- Footer on every screen with the disclaimer.
- Style: teal #0F766E on #F2F6F5, large tap targets, works on phones, tables scroll sideways, badges always have text labels.

## 4. Wording rules
Never say "approved". Use "Likely covered", "Needs prior authorization", "Within plan limit", or "Ready to submit". Every plan, supplier, price, and limit gets a "(sample)" label.

## 5. Match score
A simple checklist, not AI. It checks four things:
1. The item was recognized.
2. A plan rule was found.
3. The supplier is in network and has stock.
4. The price is within the limit.

Score = % of checks passed. The UI says it is a hand-weighted checklist.

## 6. Backend (lives outside Lovable)
- Flask + Pydantic.
- Gemma reads the prescription (text or image).
- Hybrid search over the policy PDFs (BM25 + embeddings) finds the sections that apply.
- SQLite holds suppliers, stock, and network data.
- Gemma writes a short answer that cites section numbers.
- Exposed to the app through a cloudflared tunnel.
- The request/response format is defined in section 9 of the brief.

## 7. Priorities
- **Must keep:** upload, section-cited facts, supplier match, packet.
- **Cut first if short on time:** map, then tiles, then hybrid search, then score breakdown.
- **Risks:** handwriting, slow responses (show a loading state), Gemma vision support.

## Proposed build steps (after approval)
1. Set up the teal design theme, the page title and description, and the footer disclaimer.
2. Build the two-panel dashboard. It stacks into one column on phones.
3. Connect to the backend through a configurable BACKEND_URL. Include a built-in sample response (back brace, BlueCare, 92%) so the UI demos even when the backend is offline.
4. Show a loading state, show errors (including 400 validation errors), and enforce upload and message size limits on the user's side.
5. Calculate the score breakdown, limit meter, and greyed-out supplier reasons from the response. The plan limits and item prices come from the sample data.
6. Build Copy packet (copies a text summary) and Get directions (opens Google Maps).

## Open question
The backend's response has no fields for a supplier's network status, policy check, or score checks. The UI can work these out from sample data, or the backend can add these fields.
