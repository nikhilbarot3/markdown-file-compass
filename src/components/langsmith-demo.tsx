import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { FlaskConical, ExternalLink, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { runSyntheticTrace } from "@/lib/langsmith-demo.functions";
import { DEMO_TURNS, DEMO_PROJECT } from "@/lib/langsmith-demo";

export function LangsmithDemo() {
  const run = useServerFn(runSyntheticTrace);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");
  async function submit() {
    setPending(true);
    setStatus("idle");
    try {
      const result = await run({ data: {} });
      setStatus(result.ok ? "ok" : "error");
    } catch { setStatus("error"); }
    finally { setPending(false); }
  }
  return (
    <details className="border-t border-border pt-3 text-sm">
      <summary className="cursor-pointer font-bold text-primary">LangSmith synthetic demo (sample)</summary>
      <div className="mt-3 flex flex-col gap-3">
        <p className="text-muted-foreground">Fixed sample conversation · No chat or uploads shared · Simulated, not a live AI run</p>
        {DEMO_TURNS.map((turn) => (
          <div key={turn.input} className="border-l-2 border-border pl-3">
            <p><strong>Input:</strong> {turn.input}</p>
            <p className="mt-1"><strong>Output:</strong> {turn.output}</p>
          </div>
        ))}
        <Button type="button" variant="outline" disabled={pending} onClick={submit} className="h-auto min-h-10 whitespace-normal">
          {pending ? <LoaderCircle className="animate-spin motion-reduce:animate-none" /> : <FlaskConical />}
          {pending ? "Sending samples…" : "Run synthetic trace (sample)"}
        </Button>
        {status === "ok" && <div role="status" className="text-primary">
          <p>Sample conversation sent to {DEMO_PROJECT}.</p>
          <Button asChild variant="link" className="h-auto whitespace-normal px-0">
            <a href="https://smith.langchain.com/o/00f7ff78-b234-47a0-ada4-a2ee8977d458/projects" target="_blank" rel="noreferrer">
              Open LangSmith <ExternalLink />
            </a>
          </Button>
        </div>}
        {status === "error" && <p role="alert" className="text-destructive">Sample delivery could not be confirmed. Your coverage chat is unchanged.</p>}
      </div>
    </details>
  );
}