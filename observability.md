# Coverage request observability

Each built-in chat/Submit request has a server-generated trace UUID and a conversation
UUID shared across requests on the same mounted page. Reloading starts a new conversation.
These IDs are correlation labels, never authorization credentials or durable chat storage.

## Available tools

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
waterfall dashboard, Langfuse/LangSmith export or OpenTelemetry collector integration yet.
Historical requests cannot be reconstructed. Publish to enable new traces on the live site.
`VITE_BACKEND_URL` bypasses this built-in pipeline; instrument that external service separately.