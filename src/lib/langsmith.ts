import { safeTraceDetails, type CompletedSpan } from "./trace";

export const LANGSMITH_PROJECT = "coverage-precheck-sample";

// LangSmith ordering segments: UTC timestamp with six fractional digits, then UUID.
function order(span: CompletedSpan) {
  return span.startTime.replace(/[-:]/g, "").replace(/\.(\d{3})Z$/, "$1000Z") + span.id;
}

/** Explicit serialization only: never spread application inputs, results or exceptions. */
export function langsmithBatch(spans: CompletedSpan[]) {
  const root = spans.find((span) => span.stage === "request");
  if (!root) return { post: [] };
  const rootOrder = order(root);
  return { post: spans.filter((span) => span.endTime).map((span) => ({
    id: span.id,
    trace_id: root.traceId,
    ...(span.stage === "request" ? {} : { parent_run_id: root.id }),
    dotted_order: span.stage === "request" ? rootOrder : `${rootOrder}.${order(span)}`,
    name: `coverage.${span.stage} (sample)`,
    run_type: span.stage === "extraction" || span.stage === "answer" ? "llm"
      : span.stage === "retrieval" ? "retriever" : "chain",
    session_name: LANGSMITH_PROJECT,
    start_time: span.startTime,
    end_time: span.endTime,
    inputs: {},
    outputs: {},
    tags: ["sample", "metadata-only"],
    extra: { metadata: {
      thread_id: root.threadId,
      stage: span.stage,
      status: span.status,
      duration_ms: span.durationMs,
      ...safeTraceDetails(span.details),
    } },
  })) };
}