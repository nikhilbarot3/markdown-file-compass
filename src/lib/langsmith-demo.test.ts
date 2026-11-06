import { describe, expect, it, vi } from "vitest";
import { DEMO_TURNS, DEMO_PROJECT, DemoInput, syntheticDemoBatch } from "./langsmith-demo";
import { exportSyntheticDemo } from "./langsmith.server";
import { createTrace } from "./trace";
import { langsmithBatch } from "./langsmith";

describe("synthetic-only demonstration privacy", () => {
  it("rejects real conversations, prescriptions, histories and caller thread IDs", () => {
    expect(DemoInput.parse({})).toEqual({});
    for (const key of ["message", "file", "history", "threadId", "diagnosis", "outputs"]) {
      expect(DemoInput.safeParse({ [key]: "private patient data" }).success).toBe(false);
    }
  });
  it("exports exactly the fixed sample turns in a separate project and fresh thread", () => {
    const demo = syntheticDemoBatch();
    expect(demo.batch.post).toHaveLength(4);
    expect(demo.threadId).not.toBe(syntheticDemoBatch().threadId);
    const roots = demo.batch.post.filter((run) => !("parent_run_id" in run));
    expect(roots).toHaveLength(2);
    roots.forEach((run, index) => {
      expect(run.inputs.messages[0]?.content).toBe(DEMO_TURNS[index]?.input);
      expect(run.outputs.messages[0]?.content).toBe(DEMO_TURNS[index]?.output);
      expect(run.session_name).toBe(DEMO_PROJECT);
      expect(run.extra.metadata.thread_id).toBe(demo.threadId);
      expect(run.extra.metadata.simulated).toBe(true);
    });
  });
  it("never changes normal requests to capture actual task results", async () => {
    let batch: ReturnType<typeof langsmithBatch> | undefined;
    const trace = createTrace("normal-thread", () => {}, async (spans) => { batch = langsmithBatch(spans); });
    await trace.step("request", async () => "private patient output");
    await trace.flush();
    expect(batch?.post[0]?.inputs).toEqual({});
    expect(batch?.post[0]?.outputs).toEqual({});
    expect(JSON.stringify(batch)).not.toContain("private patient");
  });
  it("reports delivery failure rather than claiming a successful demonstration", async () => {
    const send = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 403 }));
    expect(await exportSyntheticDemo({ gatewayKey: "test", connectionKey: "test" }, send)).toEqual({ ok: false });
    expect(await exportSyntheticDemo({}, send)).toEqual({ ok: false });
  });
});