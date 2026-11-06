# RAGAS evaluation

Offline evaluation of **real answers collected from the running app**, independent of the
four-check supplier match score. Six hand-authored synthetic cases cover both plans, prior
authorization, CPAP's BlueCare sleep-study requirement, and within/over-limit equipment.
References come from committed SQL seed data; review them if your policies or prices change.

## Run

Keep the app running (`bun run dev`) and use its printed URL. Install Python 3.10+ and Bun.
Keep the environment and generated results **outside the repository**:

```sh
python3 -m venv /tmp/coverage-ragas
/tmp/coverage-ragas/bin/python -m pip install -r evaluation/requirements.txt
/tmp/coverage-ragas/bin/python -m playwright install chromium
/tmp/coverage-ragas/bin/python -m unittest discover -s evaluation -p 'test_*.py'

/tmp/coverage-ragas/bin/python evaluation/collect.py \
  --url http://localhost:5173 --output /tmp/coverage-eval/observations.jsonl

/tmp/coverage-ragas/bin/python evaluation/evaluate.py \
  --input /tmp/coverage-eval/observations.jsonl --output /tmp/coverage-eval/report.json
```

Use `--limit 1` on collection for a small smoke run. Inside the Lovable sandbox the URL is
`http://localhost:8080`, Chromium is already installed, and the AI Gateway judge is managed.
Outside Lovable, configure AI Gateway SDK authentication with a private local environment
before scoring; never commit credentials. The existing OpenRouter key is still required by
the running app for Gemma, but is **not** the evaluation judge credential.

Collection invokes the normal Check button, including Gemma extraction and hybrid retrieval.
It does not bypass the application or recreate retrieval in Python. If `VITE_BACKEND_URL` is
configured, it evaluates that configured pipeline instead. Each case starts in a fresh browser
context to avoid history contamination. Failures are written explicitly and return a nonzero exit.

## Metrics (0–1, higher is better)

- **Faithfulness:** Are claims in the answer supported by the observed policy facts and SQL facts?
- **Context recall:** Do retrieved policy facts cover the reference policy requirements?
- **Context precision (unranked):** What fraction of observed policy chunks are relevant
  to the request and golden policy requirements? Uses RAGAS's context-relevance judgments
  and `relevant chunks / all chunks`, not RAGAS's ranked average precision. The UI's
  section-sorted order cannot establish retrieval ranking quality.

Correctness F1 is removed from the current protocol. Section citations remain intact in
observed answers and policy contexts. A separate citation audit records cited IDs absent
from observed sections; matching IDs do **not** prove the cited claim is entailed.
Per-chunk precision verdicts and reasons are retained in the report. SQL price/limit
facts are excluded from precision, so structured facts cannot inflate policy precision.

The judge is independent of Gemma: `openai/gpt-6-astra` through the existing AI Gateway SDK.
RAGAS 0.4.3's legacy single-turn API is version-pinned with compatible LangChain dependencies.
No separate embedding call is required for these three metrics. Evaluation consumes AI credits,
in addition to the normal app calls; begin with one case. Requests are not automatically retried.

The JSON report includes per-case scores/errors, metric averages, scored/total counts, RAGAS
version, judge model, and timestamp. Failed metrics remain null and are never silently averaged
as zero. A partial report is saved after each case. There is no arbitrary pass threshold.

## Interpretation and limitations

### Historical six-case run (6 November 2026)

`full-results-2026-11-06.json` contains the six-case raw run: faithfulness 0.9333,
context recall 0.7361, and factual correctness F1 0.1750; all 18 metrics completed.
These are **provisional judge outputs**, not validated accuracy percentages. Inspection
of wheelchair correctness decisions showed correct policy claims rejected because
the answer's section citation labels were absent from the plain-text golden reference.
Do not interpret 0.175 as only 17.5% of answers being correct. Validate citation-aware
goldens/judge calibration in a separately versioned run before claiming accuracy.
The original six hand-authored synthetic references were kept unchanged; they are
not independently insurer-validated and omit BlueCare's licensed-provider qualification.

Use collection's optional `--screenshots /tmp/coverage-eval/screenshots` for UI evidence.

### Revised protocol (v2)

The current evaluator re-scores real observations with faithfulness, context recall and
unranked context precision, with no correctness F1. The v2 report records the protocol,
metric definition, per-chunk reasons and citation audit. The presentation is versioned;
historical raw results are preserved rather than overwritten. Review confirmed that
wheelchair correctness judgments rejected otherwise supported claims because section
labels were missing from the plain-text golden. This was a judge/reference mismatch,
not evidence of invented section IDs. Actual answer omissions remain independently
documented. Goldens have not been silently changed and are not independently validated.

- This measures six **sample text requests**, not PDF/OCR accuracy, patient outcomes, clinical
  safety, or production readiness. Add redacted image/PDF cases separately before making such claims.
- Returned/displayed policy facts are used as contexts; they are not an exact model prompt trace.
  Current sample sections fit the 3,000-character budget; larger policies need exact prompt capture.
- SQL price/limit facts are added to faithfulness context because the answer receives them
  separately. They are excluded from policy-only context recall to avoid inflating retrieval quality.
- Context precision measures unranked relevance only, not ranking quality; the sample
  corpus is tiny and prefiltered by plan/item, so high precision is not evidence of
  production retrieval performance.
- Judge scores vary. Review low scores and repeat representative runs before drawing conclusions.
- Synthetic data only. Never commit real prescriptions or evaluation output with patient data.