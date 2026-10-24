// Sample (synthetic) data and plain-code scoring for Coverage Pre-Check.

export type PlanId = "bluecare_ppo" | "metro_medicaid";

export const PLANS: { id: PlanId; name: string; limit: number }[] = [
  { id: "bluecare_ppo", name: "BlueCare PPO (sample)", limit: 250 },
  { id: "metro_medicaid", name: "Metro Medicaid (sample)", limit: 400 },
];

export const ITEM_PRICES: Record<string, number> = {
  "back brace": 180,
  walker: 90,
  cpap: 700,
};

// Network membership per plan (sample). Suppliers not listed are in network.
const OUT_OF_NETWORK: Record<PlanId, string[]> = {
  bluecare_ppo: ["Eastside Home Care (sample)"],
  metro_medicaid: [],
};

export interface PolicyFact {
  section: string;
  text: string;
}
export interface Supplier {
  name: string;
  address: string;
  qty: number;
  in_network?: boolean | undefined;
}
export interface ChatResponse {
  item: string;
  answer: string;
  score: number;
  policy_facts: PolicyFact[];
  suppliers: Supplier[];
  price?: number | undefined;
  plan_limit?: number | undefined;
}

export interface Check {
  label: string;
  passed: boolean;
}

export interface RankedSupplier extends Supplier {
  inNetwork: boolean;
  inStock: boolean;
  reason?: string | undefined;
  score: number;
  checks: Check[];
}

export function itemPrice(item: string): number | undefined {
  return ITEM_PRICES[item.trim().toLowerCase()];
}

export function planById(id: PlanId) {
  return PLANS.find((p) => p.id === id)!;
}

/** Hand-weighted checklist: score = share of 4 checks passed. */
export function scoreChecks(
  res: ChatResponse,
  planId: PlanId,
  s: Supplier,
): { checks: Check[]; score: number; inNetwork: boolean } {
  const price = res.price ?? itemPrice(res.item);
  const limit = res.plan_limit ?? planById(planId).limit;
  const inNetwork = s.in_network ?? !OUT_OF_NETWORK[planId].includes(s.name);
  const checks: Check[] = [
    { label: "Prescription read clearly (item recognized)", passed: !!res.item },
    { label: "Plan rule found in the policy documents", passed: res.policy_facts.length > 0 },
    { label: "Supplier is in network and has stock", passed: inNetwork && s.qty > 0 },
    { label: "Item price is within the plan limit", passed: price !== undefined && price <= limit },
  ];
  const score = Math.round((checks.filter((c) => c.passed).length / checks.length) * 100);
  return { checks, score, inNetwork };
}

export function rankSuppliers(res: ChatResponse, planId: PlanId): RankedSupplier[] {
  return res.suppliers
    .map((s) => {
      const { checks, score, inNetwork } = scoreChecks(res, planId, s);
      const inStock = s.qty > 0;
      const reasons = [!inNetwork && "Not in network for this plan", !inStock && "Out of stock"].filter(
        Boolean,
      ) as string[];
      return { ...s, inNetwork, inStock, score, checks, reason: reasons.join(" · ") || undefined };
    })
    .sort((a, b) => b.score - a.score || b.qty - a.qty);
}

export function factResult(f: PolicyFact): "Met" | "Action needed" | "Within limit" {
  const t = f.text.toLowerCase();
  if (t.includes("prior authorization")) return "Action needed";
  if (t.includes("limit")) return "Within limit";
  return "Met";
}

/** Finds a known equipment item in free text, or null if none is mentioned. */
export function detectItem(message: string): string | null {
  const m = message.toLowerCase();
  if (/\bwalker\b/.test(m)) return "walker";
  if (/\bc-?pap\b/.test(m)) return "CPAP";
  if (/back\s*brace|lumbar|brace/.test(m)) return "back brace";
  return null;
}

/** Conversational demo reply for messages that don't name an item. */
export function demoChatReply(message: string): string {
  const m = message.toLowerCase().trim();
  if (/^(hi|hello|hey|hiya|good (morning|afternoon|evening))\b/.test(m))
    return "Hi there! I can help you check whether medical equipment is likely covered by your plan. What do you need — for example a back brace, a walker, or a CPAP? You can also upload your prescription.";
  if (/thank/.test(m)) return "You're welcome! Let me know if you'd like to check another item.";
  if (/help|what can you do|how/.test(m))
    return "Pick your plan, then tell me the equipment you need or upload a photo of your prescription. I'll show the plan rules that apply, your plan limit, and nearby suppliers that have it in stock.";
  return "I'm not sure which equipment you mean. In this demo I can check a back brace, a walker, or a CPAP — or upload your prescription and I'll read it.";
}

export function sampleResponse(planId: PlanId, message: string): ChatResponse {
  const item = detectItem(message) ?? "back brace";
  const plan = planById(planId);
  return {
    item,
    answer: `Your ${item} is likely covered under ${plan.name} (Section 4.2), but it needs prior authorization first (Section 4.5). Ask your doctor's office to send the prescription with the authorization form. Price is checked against the annual limit (Section 4.7).`,
    score: 0,
    policy_facts: [
      { section: "2.1", text: "Use an in-network supplier to receive plan benefits (sample)." },
      { section: "4.2", text: `Durable medical equipment such as a ${item} is covered when prescribed (sample).` },
      { section: "4.5", text: `A ${item} needs prior authorization before purchase (sample).` },
      { section: "4.7", text: `Annual equipment limit for this item is $${plan.limit} (sample).` },
    ],
    suppliers: [
      { name: "Motor City Medical Supply (sample)", address: "1200 Sample St, East Side, Detroit", qty: 3 },
      { name: "Woodward Mobility (sample)", address: "4400 Woodward Ave (sample), Midtown, Detroit", qty: 1 },
      { name: "Eastside Home Care (sample)", address: "800 Example Rd, Detroit", qty: 0 },
    ],
  };
}

export function buildPacket(res: ChatResponse, planId: PlanId, best?: RankedSupplier): string {
  const plan = planById(planId);
  const price = res.price ?? itemPrice(res.item);
  return [
    "Coverage Pre-Check packet (sample data)",
    `Plan: ${plan.name}`,
    `Equipment: ${res.item}${price ? ` ($${price} sample)` : ""}`,
    "",
    "Policy facts:",
    ...res.policy_facts.map((f) => `- Section ${f.section}: ${f.text} [${factResult(f)}]`),
    "",
    best ? `Supplier: ${best.name}, ${best.address} (stock ${best.qty})` : "Supplier: none matched",
    best ? `Match score: ${best.score}% (hand-weighted checklist)` : "",
    "",
    "Your insurer makes the final coverage decision. Not medical advice.",
  ].join("\n");
}
