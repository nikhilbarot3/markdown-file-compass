import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { analyzePrescription } from "@/lib/analyze.functions";
import { useMemo, useRef, useState } from "react";
import {
  PLANS,
  type PlanId,
  type ChatResponse,
  rankSuppliers,
  factResult,
  sampleResponse,
  buildPacket,
  detectItem,
  demoChatReply,
  itemPrice,
  planById,
} from "@/lib/precheck";
import { dbResponse } from "@/lib/precheck-db";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Coverage Pre-Check — DME coverage dashboard" },
      {
        name: "description",
        content: "Upload a prescription, see policy facts, plan limits and ranked in-network suppliers.",
      },
      { property: "og:title", content: "Coverage Pre-Check" },
      { property: "og:description", content: "See if medical equipment is likely covered and who has it in stock." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const BACKEND_URL = (import.meta.env["VITE_BACKEND_URL"] as string | undefined)?.replace(/\/$/, "");
const MAX_MSG = 2000;
const MAX_FILE = 3 * 1024 * 1024;

type Msg = { role: "user" | "assistant"; text: string };

function toBase64(f: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1] ?? "");
    r.onerror = rej;
    r.readAsDataURL(f);
  });
}

function Dashboard() {
  const [planId, setPlanId] = useState<PlanId>("bluecare_ppo");
  const [file, setFile] = useState<File | null>(null);
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ChatResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const analyze = useServerFn(analyzePrescription);

  const ranked = useMemo(() => (result ? rankSuppliers(result, planId) : []), [result, planId]);
  const best = ranked.find((s) => s.inNetwork && s.inStock) ?? ranked[0];

  async function send(e?: React.FormEvent, preset?: string) {
    e?.preventDefault();
    setError(null);
    const message = preset ?? (input.trim() || (file ? "Please read my prescription." : ""));
    if (!message) return setError("Type a message or upload a prescription.");
    if (message.length > MAX_MSG) return setError(`Message must be under ${MAX_MSG} characters.`);
    if (file && file.size > MAX_FILE) return setError("File must be under 3 MB.");
    setMsgs((m) => [...m, { role: "user", text: file ? `${message} (attached: ${file.name})` : message }]);
    setInput("");
    setLoading(true);
    try {
      let data: ChatResponse;
      if (BACKEND_URL) {
        const body = { plan_id: planId, message, image_b64: file ? await toBase64(file) : undefined };
        const r = await fetch(`${BACKEND_URL}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = await r.json().catch(() => ({}));
        if (r.status === 400) {
          const list = Array.isArray(json.errors) ? json.errors : Array.isArray(json) ? json : [json.error ?? "Invalid request"];
          throw new Error(list.map((x: unknown) => (typeof x === "string" ? x : (x as { msg?: string }).msg ?? JSON.stringify(x))).join("; "));
        }
        if (!r.ok) throw new Error(`The service returned an error (${r.status}).`);
        data = json as ChatResponse;
      } else {
        const res = await analyze({
          data: {
            planId,
            message,
            history: msgs.slice(-6),
            file: file ? { name: file.name, mime: file.type || "application/octet-stream", b64: await toBase64(file) } : undefined,
          },
        });
        if (res.kind === "chat") {
          setMsgs((m) => [...m, { role: "assistant", text: res.reply }]);
          return;
        }
        data = res.response;
      }
      setResult(data);
      setMsgs((m) => [...m, { role: "assistant", text: data.answer }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function copyPacket() {
    if (!result) return;
    await navigator.clipboard.writeText(buildPacket(result, planId, best));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const plan = planById(planId);
  const price = result ? (result.price ?? itemPrice(result.item)) : undefined;
  const limit = result?.plan_limit ?? plan.limit;
  const needsPA = result?.policy_facts.some((f) => factResult(f) === "Action needed");

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4">
          <div>
            <h1 className="font-display text-2xl text-primary">Coverage Pre-Check</h1>
            <p className="text-sm text-muted-foreground">Medical equipment coverage, explained.</p>
          </div>
          <span className="rounded-full bg-secondary px-3 py-1 text-xs font-bold text-secondary-foreground">
            {BACKEND_URL ? "Live backend" : "Demo mode (sample responses)"}
          </span>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[380px_1fr]">
        {/* Left panel */}
        <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5" aria-label="Your request">
          <div>
            <label htmlFor="plan" className="mb-1 block text-sm font-bold">Insurance plan</label>
            <select
              id="plan"
              value={planId}
              onChange={(e) => setPlanId(e.target.value as PlanId)}
              className="h-12 w-full rounded-lg border border-input bg-card px-3 text-base focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {PLANS.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <span className="mb-1 block text-sm font-bold">Prescription (image or PDF)</span>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex min-h-24 w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-input bg-muted px-4 py-4 text-center hover:border-primary"
            >
              <span className="font-bold text-primary">{file ? file.name : "Tap to upload"}</span>
              <span className="text-xs text-muted-foreground">JPG, PNG or PDF, up to 3 MB</span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              className="sr-only"
              aria-label="Upload prescription"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file && (
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => send(undefined, "Please check my prescription against my plan and nearby suppliers.")}
                  className="h-12 flex-1 rounded-lg bg-primary px-5 font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {loading ? "Checking…" : "Submit"}
                </button>
                <button type="button" onClick={() => setFile(null)} className="text-sm text-muted-foreground underline">
                  Remove file
                </button>
              </div>
            )}
          </div>

          <div className="flex min-h-48 flex-1 flex-col gap-2 overflow-y-auto rounded-lg bg-muted p-3" aria-live="polite">
            {msgs.length === 0 && (
              <p className="text-sm text-muted-foreground">Try: "I need a back brace"</p>
            )}
            {msgs.map((m, i) => (
              <div
                key={i}
                className={`max-w-[90%] rounded-lg px-3 py-2 text-sm ${
                  m.role === "user" ? "self-end bg-primary text-primary-foreground" : "self-start bg-card"
                }`}
              >
                {m.text}
              </div>
            ))}
            {loading && <div className="self-start animate-pulse rounded-lg bg-card px-3 py-2 text-sm">Reading your prescription and plan… this can take up to 30 seconds.</div>}
          </div>

          <form onSubmit={send} className="flex gap-2">
            <label htmlFor="msg" className="sr-only">Message</label>
            <input
              id="msg"
              value={input}
              maxLength={MAX_MSG}
              onChange={(e) => setInput(e.target.value)}
              placeholder="I need a back brace"
              className="h-12 flex-1 rounded-lg border border-input bg-card px-3 text-base focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="submit"
              disabled={loading}
              className="h-12 rounded-lg bg-primary px-5 font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              Check
            </button>
          </form>
          {error && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        </section>

        {/* Right panel */}
        <section className="flex flex-col gap-5" aria-label="Results">
          {!result ? (
            <div className="flex min-h-80 flex-col items-center justify-center rounded-xl border border-dashed border-input bg-card p-8 text-center">
              <h2 className="font-display text-xl text-primary">Your results will appear here</h2>
              <p className="mt-2 max-w-md text-muted-foreground">
                Pick your plan, upload a prescription or type what you need, then press Check.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Tile label="Equipment" value={result.item} />
                <Tile label="Plan status" value={needsPA ? "Needs prior authorization" : "Likely covered"} />
                <Tile label="Suppliers matched" value={String(ranked.filter((s) => s.inNetwork && s.inStock).length)} />
                <Tile label="Best match score" value={best ? `${best.score}%` : "—"} />
              </div>

              <Card title="Why it matches: your policy facts">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] text-left text-sm">
                    <thead className="text-muted-foreground">
                      <tr><th className="py-2 pr-3">Policy fact</th><th className="py-2 pr-3">Plan section</th><th className="py-2">Result</th></tr>
                    </thead>
                    <tbody>
                      {result.policy_facts.map((f) => {
                        const r = factResult(f);
                        return (
                          <tr key={f.section} className="border-t border-border">
                            <td className="py-3 pr-3">{f.text}</td>
                            <td className="py-3 pr-3 font-bold">§ {f.section}</td>
                            <td className="py-3"><Badge tone={r === "Action needed" ? "warn" : "ok"}>{r}</Badge></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>

              {price !== undefined && (
                <Card title="Plan limit">
                  <p className="mb-2 text-sm">
                    <strong>${price}</strong> of <strong>${limit}</strong> annual equipment limit for this item (sample)
                    {" — "}
                    <span className={price <= limit ? "text-success-foreground" : "text-destructive"}>
                      {price <= limit ? "Within plan limit" : "Over plan limit"}
                    </span>
                  </p>
                  <div className="h-4 w-full overflow-hidden rounded-full bg-muted" role="meter" aria-valuemin={0} aria-valuemax={limit} aria-valuenow={price}>
                    <div
                      className={`h-full rounded-full ${price <= limit ? "bg-primary" : "bg-destructive"}`}
                      style={{ width: `${Math.min(100, (price / limit) * 100)}%` }}
                    />
                  </div>
                </Card>
              )}

              <Card title="Supplier matches">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead className="text-muted-foreground">
                      <tr><th className="py-2 pr-3">Supplier and address</th><th className="py-2 pr-3">Stock</th><th className="py-2 pr-3">Policy check</th><th className="py-2">Match score</th></tr>
                    </thead>
                    <tbody>
                      {ranked.map((s) => {
                        const ok = s.inNetwork && s.inStock;
                        return (
                          <tr key={s.name} className={`border-t border-border ${ok ? "" : "opacity-55"}`}>
                            <td className="py-3 pr-3">
                              <div className="font-bold">{s.name}</div>
                              <div className="text-muted-foreground">{s.address}</div>
                              {s.reason && <div className="text-xs text-destructive">{s.reason}</div>}
                            </td>
                            <td className="py-3 pr-3">{s.inStock ? `${s.qty} in stock` : "Out of stock"}</td>
                            <td className="py-3 pr-3">
                              <Badge tone={s.inNetwork ? "ok" : "warn"}>{s.inNetwork ? "In network" : "Out of network"}</Badge>
                            </td>
                            <td className="py-3 text-lg font-bold">{s.score}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>

              {best && (
                <Card title={`Why ${best.score}%?`}>
                  <p className="mb-3 text-sm text-muted-foreground">
                    For {best.name}. This is a simple hand-weighted checklist, not a trained model: score = share of checks passed.
                  </p>
                  <ul className="flex flex-col gap-2">
                    {best.checks.map((c) => (
                      <li key={c.label} className="flex items-center gap-3 text-sm">
                        <Badge tone={c.passed ? "ok" : "warn"}>{c.passed ? "Passed" : "Not met"}</Badge>
                        {c.label}
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              <div className="flex flex-wrap gap-3">
                <button onClick={copyPacket} className="h-12 rounded-lg bg-primary px-6 font-bold text-primary-foreground hover:opacity-90">
                  {copied ? "Copied — ready to submit" : "Copy packet"}
                </button>
                {best && (
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(best.address)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-12 items-center rounded-lg border border-primary px-6 font-bold text-primary hover:bg-secondary"
                  >
                    Get directions
                  </a>
                )}
              </div>
            </>
          )}
        </section>
      </main>

      <footer className="border-t border-border px-4 py-5 text-center text-sm text-muted-foreground">
        Demo with synthetic data. Your insurer makes the final coverage decision. Not medical advice.
      </footer>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-bold capitalize text-primary">{value}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-3 font-display text-lg">{title}</h2>
      {children}
    </div>
  );
}

function Badge({ tone, children }: { tone: "ok" | "warn"; children: React.ReactNode }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${
        tone === "ok" ? "bg-success text-success-foreground" : "bg-warning text-warning-foreground"
      }`}
    >
      {children}
    </span>
  );
}
