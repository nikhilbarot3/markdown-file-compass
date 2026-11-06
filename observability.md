# Coverage request observability

Each built-in chat/Submit request has a server-generated trace UUID and a conversation
UUID shared across requests on the same mounted page. Reloading starts a new conversation.
These IDs are correlation labels, never authorization credentials or durable chat storage.

## Available tools

- LangSmith: open https://smith.langchain.com and select the project
  `coverage-precheck-sample` under tracing projects. Requests appear as nested stage
  traces; the Threads view groups them by `thread_id`. Inputs and outputs are
  deliberately empty. Token counts and provider IDs are safe metadata when available;
  native cost accounting is not configured and RAGAS quality scores remain separate.
- Lovable Cloud server logs: filter `coverage_trace`, a trace UUID, or a conversation UUID.
  Started/ok/error rows include stage, span ID, parent request span, timestamp and elapsed ms.
- AI Gateway request logs: filter `run_id` with the request trace UUID for embedding calls.
  Available model usage, cost and payload detail depend on the retained gateway record.
- Gemma runs through OpenRouter, not AI Gateway. Its safe stage rows record the provider
  generation ID and token counts when the provider supplies them. Missing usage is unknown,
  not zero. OpenRouter billing/cost is not inferred from these counts.

Stages: request, catalog, document preparation, extraction, policy read, embedding,
retrieval, answer generation, and supplier lookup. An embedding error followed by BM25
retrieval is a fallback, not necessarily a failed request. Database spans currently time
the calls; returned SQL error objects are not separately classified.

Inspect a server-function response in the browser's Network panel for
`X-Coverage-Trace-ID` and `X-Coverage-Thread-ID`, then search server logs by that ID.
Conversation IDs are client-provided opaque labels and cannot establish user identity.
Metadata rows enrich the request and stage; request is the parent of timed stage spans.

## Privacy and limitations

No prompts, answers, prescription text/images, filenames, diagnoses, prescriber names,
patient identifiers, credentials or error messages are logged by this instrumentation.
Section numbers, stage status, model name, provider ID and numeric usage are allowlisted.
The gateway has its own retention/redaction controls; this logging does not change them.

Logging is best-effort and cannot guarantee retention. There is no persistent trace table,
in-app waterfall dashboard, Langfuse export or OpenTelemetry collector integration yet.
Historical requests cannot be reconstructed. Publish to enable new traces on the live site.
`VITE_BACKEND_URL` bypasses this built-in pipeline; instrument that external service separately.

## LangSmith connection and export

The linked US-region LangSmith connector holds a workspace-scoped API key. Server calls
use the connector gateway with `LOVABLE_API_KEY` and `UDC_LANGSMITH_API_KEY`;
neither credential is sent to the browser. No LangSmith SDK or automatic tracing is used.
For local runs, configure the same connector gateway credentials securely outside Git.
EU/APAC or other workspaces need a matching connection; do not point a US key at another region.

Each request collects allowlisted stage records in memory and awaits one `/runs/batch`
export after completion, including early chat replies and failed requests. Export has a
three-second deadline and never replaces a coverage result or original application error.
`coverage_trace_export` logs record only HTTP status and ok/http_error/unavailable.
No provider error body or exception text is retained. Failed stages use controlled status
metadata, not native LangSmith error strings. A failed embedding followed by BM25 may
therefore be a successful root request with an error-status child.
Export failures are not retried or queued; trace delivery is not guaranteed.
Removing the connection disables export while existing local logs continue.
The privacy guarantee applies to this exporter, not other providers' retention policies.

## Synthetic-only demonstration

Open **LangSmith synthetic demo (sample)** below the chat and choose **Run synthetic
trace (sample)**. Two immutable authored turns are exported to the separate
`coverage-precheck-synthetic-demo` project with nonempty sample inputs and outputs.
Select that project and its Threads view in LangSmith. Every click creates a fresh
server-generated thread, with two request roots and fixed-reply children.

These are simulated fixture runs, not live Gemma calls, measured model timings or
RAGAS observations. No model is called or inferred token/cost usage recorded.
The demo function accepts only an empty object, rejects arbitrary content, and does
not access messages, uploads, plan selection, history or the normal conversation ID.
Opening/running the demo never enables content capture for normal requests.