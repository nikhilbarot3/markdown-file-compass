import { langsmithBatch } from "./langsmith";
import { syntheticDemoBatch } from "./langsmith-demo";
import type { CompletedSpan } from "./trace";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/udc_langsmith";

/** Credentials are supplied only from the server-function handler. No automatic tracing. */
export async function exportLangsmith(spans: CompletedSpan[], credentials: {
  gatewayKey?: string | undefined; connectionKey?: string | undefined;
}, send: typeof fetch = fetch, sink: (line: string) => void = console.info) {
  if (!credentials.gatewayKey || !credentials.connectionKey) return;
  const batch = langsmithBatch(spans);
  if (batch.post.length === 0) return;
  await sendBatch(batch, spans[0]?.traceId, credentials, send, sink);
}

type Credentials = { gatewayKey?: string | undefined; connectionKey?: string | undefined };

/** Only this no-content entry point can export visible synthetic inputs/outputs. */
export async function exportSyntheticDemo(credentials: Credentials, send: typeof fetch = fetch) {
  if (!credentials.gatewayKey || !credentials.connectionKey) return { ok: false as const };
  const demo = syntheticDemoBatch();
  const ok = await sendBatch(demo.batch, demo.traceIds[0], credentials, send, console.info);
  return ok ? { ok: true as const, threadId: demo.threadId, traceIds: demo.traceIds }
    : { ok: false as const };
}

async function sendBatch(batch: { post: unknown[] }, traceId: string | undefined, credentials: Credentials,
  send: typeof fetch, sink: (line: string) => void) {
  if (!credentials.gatewayKey || !credentials.connectionKey) return false;
  let status: number | undefined;
  let outcome: "ok" | "http_error" | "unavailable" = "unavailable";
  try {
    const response = await send(`${GATEWAY_URL}/runs/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json",
        Authorization: `Bearer ${credentials.gatewayKey}`,
        "X-Connection-Api-Key": credentials.connectionKey },
      body: JSON.stringify(batch),
      signal: AbortSignal.timeout(3000),
    });
    status = response.status;
    outcome = response.ok ? "ok" : "http_error";
    // Never log provider bodies: they may echo sensitive data or credentials.
    await response.body?.cancel();
  } catch { /* Bounded best-effort export; no exceptions or stacks retained. */ }
  try {
    sink(JSON.stringify({ event: "coverage_trace_export", provider: "langsmith",
      traceId, outcome, ...(status === undefined ? {} : { status }) }));
  } catch { /* Logging must also remain best-effort. */ }
  return outcome === "ok";
}