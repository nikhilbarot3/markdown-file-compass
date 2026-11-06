import { createServerFn } from "@tanstack/react-start";
import { DemoInput } from "./langsmith-demo";

// Intentionally public fixed-fixture demo: accepts no chat, history, upload or caller IDs.
export const runSyntheticTrace = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => DemoInput.parse(input))
  .handler(async () => {
    const { exportSyntheticDemo } = await import("./langsmith.server");
    return exportSyntheticDemo({ gatewayKey: process.env["LOVABLE_API_KEY"],
      connectionKey: process.env["UDC_LANGSMITH_API_KEY"] });
  });