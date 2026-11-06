import { describe, it, expect } from "vitest";
import { createTrace, safeTraceDetails } from "./trace";

describe("privacy-safe threaded tracing", () => {
  it("correlates child spans with the request and conversation", async () => {
    const lines: string[] = [];
    const trace = createTrace("sample-thread", (line) => lines.push(line));
    await trace.step("request", () => trace.step("extraction", async () => "result"));
    const rows = lines.map((line) => JSON.parse(line));
    expect(rows).toHaveLength(4);
    expect(rows.every((r) => r.traceId === trace.traceId && r.threadId === "sample-thread")).toBe(true);
    expect(rows.find((r) => r.stage === "extraction")?.parentSpanId).toBe(trace.traceId);
  });
  it("records failed stages without leaking error messages", async () => {
    const lines: string[] = [];
    const trace = createTrace("thread", (line) => lines.push(line));
    await expect(trace.step("answer", async () => { throw new Error("private diagnosis and secret"); })).rejects.toThrow();
    expect(JSON.parse(lines[1] ?? "{}").status).toBe("error");
    expect(lines.join(" ")).not.toContain("private diagnosis");
  });
  it("drops unknown fields and unsafe IDs", () => {
    const details = { inputTokens: 42, outputTokens: -1, prompt: "patient text", sectionIds: ["4.5", "private"], providerRequestId: "private text" };
    expect(safeTraceDetails(details)).toEqual({ inputTokens: 42, sectionIds: ["4.5"] });
  });
  it("does not fail the workflow when logging fails", async () => {
    const trace = createTrace("thread", () => { throw new Error("logger unavailable"); });
    await expect(trace.step("catalog", async () => 42)).resolves.toBe(42);
  });
});