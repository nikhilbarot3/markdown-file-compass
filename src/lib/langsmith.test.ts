import { describe, it, expect, vi } from "vitest";
import { createTrace, type CompletedSpan } from "./trace";
import { langsmithBatch } from "./langsmith";
import { exportLangsmith } from "./langsmith.server";

async function collect() {
  let spans: CompletedSpan[] = [];
  const trace = createTrace("b07dff68-4ac2-4367-bd65-ff9b1e3c2dfe", () => {}, async (batch) => { spans = batch; });
  await trace.step("request", async () => {
    await trace.step("extraction", async () => {
      trace.metadata("extraction", { inputTokens: 42, outputTokens: 7 });
      return "private prescription result";
    }, { model: "google/gemma-4-31b-it" });
    await trace.step("retrieval", async () => 4);
    trace.metadata("retrieval", { sectionIds: ["4.5"], chunkCount: 1 });
    trace.metadata("request", { outcome: "result" });
  });
  await trace.flush();
  return { spans, trace };
}

describe("metadata-only LangSmith export", () => {
  it("uses the request UUID as the root and threads every child with empty content", async () => {
    const { spans, trace } = await collect();
    const { post } = langsmithBatch(spans);
    const root = post[0];
    expect(root?.id).toBe(trace.traceId);
    for (const run of post) {
      expect(run.trace_id).toBe(trace.traceId);
      expect(run.extra.metadata.thread_id).toBe(trace.threadId);
      expect(run.inputs).toEqual({});
      expect(run.outputs).toEqual({});
      if (run !== root) {
        expect(run.parent_run_id).toBe(root?.id);
        expect(run.dotted_order.startsWith(`${root?.dotted_order}.`)).toBe(true);
      }
    }
    expect(JSON.stringify(post)).not.toContain("private prescription");
    expect(post[1]?.extra.metadata.inputTokens).toBe(42);
    expect(post[2]?.extra.metadata.sectionIds).toEqual(["4.5"]);
    expect(root?.extra.metadata.outcome).toBe("result");
    expect(root?.dotted_order).toMatch(/^\d{8}T\d{12}Z[\da-f-]+$/);
  });

  it("re-applies the allowlist and never exports exceptions or arbitrary fields", async () => {
    let spans: CompletedSpan[] = [];
    const original = new Error("private diagnosis");
    const trace = createTrace("thread", () => {}, async (batch) => { spans = batch; throw new Error("export failed"); });
    await expect(trace.step("request", () => trace.step("answer", async () => { throw original; }))).rejects.toBe(original);
    await expect(trace.flush()).resolves.toBeUndefined();
    const span = spans[1];
    if (!span) throw new Error("Expected child span");
    Object.assign(span.details, { prompt: "private prompt", diagnosis: "private diagnosis" });
    const payload = JSON.stringify(langsmithBatch(spans));
    expect(payload).not.toContain("private");
    expect(langsmithBatch(spans).post[1]?.extra.metadata.status).toBe("error");
  });

  it("does not send anything without both gateway credentials", async () => {
    const send = vi.fn<typeof fetch>();
    const { spans } = await collect();
    await exportLangsmith(spans, { gatewayKey: "test" }, send);
    expect(send).not.toHaveBeenCalled();
  });

  it("sends a single completed batch through the gateway with a deadline", async () => {
    const send = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 202 }));
    const { spans } = await collect();
    await exportLangsmith(spans, { gatewayKey: "test-gateway", connectionKey: "test-connection" }, send, () => {});
    expect(send).toHaveBeenCalledOnce();
    const [url, init] = send.mock.calls[0] ?? [];
    expect(url).toBe("https://connector-gateway.lovable.dev/udc_langsmith/runs/batch");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(init?.headers).toMatchObject({ Authorization: "Bearer test-gateway", "X-Connection-Api-Key": "test-connection" });
    expect(JSON.parse(String(init?.body)).post).toHaveLength(3);
  });

  it("records HTTP failures without leaking provider error bodies", async () => {
    const send = vi.fn<typeof fetch>().mockResolvedValue(new Response("private response with credential", { status: 403 }));
    const lines: string[] = [];
    const { spans } = await collect();
    await expect(exportLangsmith(spans, { gatewayKey: "test", connectionKey: "test" }, send, (line) => lines.push(line))).resolves.toBeUndefined();
    expect(JSON.parse(lines[0] ?? "{}")).toMatchObject({ status: 403, outcome: "http_error" });
    expect(lines.join(" ")).not.toContain("private");
  });

  it("survives timeout and logging failure without retaining exception messages", async () => {
    const send = vi.fn<typeof fetch>().mockRejectedValue(new DOMException("private timeout", "TimeoutError"));
    const { spans } = await collect();
    await expect(exportLangsmith(spans, { gatewayKey: "test", connectionKey: "test" }, send,
      () => { throw new Error("sink unavailable"); })).resolves.toBeUndefined();
  });
});