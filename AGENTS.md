<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Coverage Pre-Check scoring, sample data and packet text live in src/lib/precheck.ts as plain code (no AI); the UI falls back to sample responses when VITE_BACKEND_URL is unset so the demo works offline.
- Plans, policy sections, equipment items, suppliers, stock and network membership live in Lovable Cloud tables (public read-only); demo mode reads them via src/lib/precheck-db.ts, falling back to precheck.ts constants.
