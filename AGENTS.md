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

- Match score and packet text are plain code in src/lib/precheck.ts (never the model) so the score stays explainable.
- Plans, policy sections, equipment items, suppliers, stock and network membership live in Lovable Cloud tables (public read-only); exact supplier/stock/price numbers always come from SQL, not the model.
- Submit/chat call analyzePrescription (src/lib/analyze.functions.ts): Gemma via OpenRouter (OPENROUTER_API_KEY) extracts the item from text/image/PDF text (unpdf), BM25 over policy_sections (src/lib/rag.ts) retrieves plan rules, Gemma answers citing only those sections. VITE_BACKEND_URL, if set, overrides with the external Flask backend.
