export type TraceStage = "request" | "catalog" | "document" | "extraction" | "policy_read" | "embedding" | "retrieval" | "answer" | "suppliers";
export type TraceDetails = {
  model?: string;
  providerRequestId?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  sectionIds?: string[];
  chunkCount?: number;
  mode?: "hybrid" | "bm25";
  outcome?: "chat" | "result";
};

export type CompletedSpan = {
  id: string;
  traceId: string;
  threadId: string;
  stage: TraceStage;
  startTime: string;
  endTime: string;
  status: "ok" | "error";
  durationMs: number;
  details: TraceDetails;
};

/** Only allowlisted operational fields are retained; never prompts, files or patient data. */
export function safeTraceDetails(details: TraceDetails): TraceDetails {
  const safe: TraceDetails = {};
  if (details.model) safe.model = details.model.slice(0, 100);
  if (details.providerRequestId && /^[a-zA-Z0-9_-]{1,150}$/.test(details.providerRequestId)) safe.providerRequestId = details.providerRequestId;
  for (const key of ["inputTokens", "outputTokens", "totalTokens", "chunkCount"] as const) {
    const value = details[key];
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) safe[key] = value;
  }
  if (details.sectionIds) safe.sectionIds = details.sectionIds.filter((id) => /^\d+(\.\d+)+$/.test(id)).slice(0, 20);
  if (details.mode === "hybrid" || details.mode === "bm25") safe.mode = details.mode;
  if (details.outcome === "chat" || details.outcome === "result") safe.outcome = details.outcome;
  return safe;
}

export function createTrace(threadId: string, sink: (line: string) => void = console.info,
  exporter?: (spans: CompletedSpan[]) => Promise<void>) {
  const traceId = crypto.randomUUID();
  const spans: CompletedSpan[] = [];
  const latest = new Map<TraceStage, CompletedSpan>();
  function emit(stage: TraceStage, spanId: string, status: "started" | "ok" | "error" | "metadata", started: number, details: TraceDetails = {}) {
    // Operational logging must never break the patient workflow.
    try {
      sink(JSON.stringify({ event: "coverage_trace", timestamp: new Date().toISOString(), threadId, traceId,
        spanId, parentSpanId: stage === "request" ? null : traceId, stage, status,
        durationMs: Math.round(Math.max(0, performance.now() - started)), ...safeTraceDetails(details) }));
    } catch { /* Logging is best-effort. */ }
  }
  return {
    traceId,
    threadId,
    metadata(stage: TraceStage, details: TraceDetails) {
      const span = latest.get(stage);
      if (span) span.details = { ...span.details, ...safeTraceDetails(details) };
      emit(stage, span?.id ?? traceId, "metadata", performance.now(), details);
    },
    async flush() {
      if (!exporter || spans.length === 0) return;
      const completed = spans.splice(0);
      try { await exporter(completed); } catch { /* Export never replaces a result or application error. */ }
    },
    async step<T>(stage: TraceStage, task: () => Promise<T>, details: TraceDetails = {}): Promise<T> {
      const spanId = stage === "request" ? traceId : crypto.randomUUID();
      const started = performance.now();
      const span: CompletedSpan = { id: spanId, traceId, threadId, stage,
        startTime: new Date().toISOString(), endTime: "", status: "ok", durationMs: 0,
        details: safeTraceDetails(details) };
      latest.set(stage, span);
      spans.push(span);
      emit(stage, spanId, "started", started, details);
      try {
        const result = await task();
        emit(stage, spanId, "ok", started, details);
        return result;
      } catch (error) {
        // Error message/stack can contain sensitive inputs; record status only.
        span.status = "error";
        emit(stage, spanId, "error", started, details);
        throw error;
      } finally {
        span.endTime = new Date().toISOString();
        span.durationMs = Math.round(Math.max(0, performance.now() - started));
      }
    },
  };
}