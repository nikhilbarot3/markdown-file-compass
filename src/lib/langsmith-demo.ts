import { z } from "zod";

export const DemoInput = z.object({}).strict();
export const DEMO_PROJECT = "coverage-precheck-synthetic-demo";

/** Immutable authored fixtures, not real observations or user-editable text. */
export const DEMO_TURNS = Object.freeze([
  Object.freeze({ input: "Hello (sample)", output: "Hello! What medical equipment would you like to check? (sample)" }),
  Object.freeze({ input: "I want to check a walker (sample)", output: "Please choose your insurance plan so we can check its equipment rules. (sample)" }),
]);

/** No content parameters: user messages, history, files and diagnoses cannot enter this builder. */
export function syntheticDemoBatch() {
  const threadId = crypto.randomUUID();
  const time = new Date().toISOString();
  const segment = (id: string) => time.replace(/[-:]/g, "").replace(/\.(\d{3})Z$/, "$1000Z") + id;
  const traceIds: string[] = [];
  const post = DEMO_TURNS.flatMap((turn, index) => {
    const id = crypto.randomUUID();
    const childId = crypto.randomUUID();
    traceIds.push(id);
    const common = { trace_id: id, session_name: DEMO_PROJECT,
      start_time: time, end_time: time,
      inputs: { messages: [{ role: "user", content: turn.input }] },
      outputs: { messages: [{ role: "assistant", content: turn.output }] },
      tags: ["sample", "synthetic-only", "simulated"],
      extra: { metadata: { thread_id: threadId, synthetic_only: true, simulated: true,
        source: "fixed_fixture", turn: index + 1, timing: "simulated; not model latency" } } };
    return [
      { ...common, id, name: `Synthetic conversation turn ${index + 1} (sample)`, run_type: "chain", dotted_order: segment(id) },
      { ...common, id: childId, parent_run_id: id, name: "Fixed sample reply (sample)", run_type: "chain",
        dotted_order: `${segment(id)}.${segment(childId)}` },
    ];
  });
  return { batch: { post }, threadId, traceIds };
}