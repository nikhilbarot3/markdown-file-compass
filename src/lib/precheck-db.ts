import { supabase } from "@/integrations/supabase/client";
import type { ChatResponse, PlanId } from "./precheck";

/** Builds a demo response using suppliers, stock, network and prices stored in the database. */
export async function dbResponse(planId: PlanId, itemName: string, base: ChatResponse): Promise<ChatResponse> {
  const [{ data: item, error: e1 }, { data: plan, error: e2 }] = await Promise.all([
    supabase.from("equipment_items").select("*").ilike("name", itemName).maybeSingle(),
    supabase.from("plans").select("*").eq("id", planId).maybeSingle(),
  ]);
  if (e1 || e2) throw new Error("Couldn't load equipment data.");
  if (!item) return base;

  const [{ data: stock, error: e3 }, { data: nets, error: e4 }] = await Promise.all([
    supabase.from("supplier_stock").select("qty, suppliers(id, name, address, area)").eq("item_id", item.id),
    supabase.from("supplier_networks").select("supplier_id").eq("plan_id", planId),
  ]);
  if (e3 || e4) throw new Error("Couldn't load supplier data.");
  const { data: sections, error: e5 } = await supabase
    .from("policy_sections")
    .select("section, body, item_id")
    .eq("plan_id", planId)
    .or(`item_id.is.null,item_id.eq.${item.id}`)
    .order("section");
  if (e5) throw new Error("Couldn't load policy sections.");
  const facts = (sections ?? []).map((r) => ({ section: r.section, text: r.body }));
  const needsPA = (sections ?? []).find((r) => r.item_id === item.id);
  const planName = plan?.name ?? planId;
  const answer = needsPA
    ? `Your ${item.name} is likely covered under ${planName} (Section 4.2), but it needs prior authorization first (Section ${needsPA.section}). Ask your doctor's office to send the prescription with the authorization form.`
    : `Your ${item.name} is likely covered under ${planName} (Section 4.2) and does not need prior authorization. Use an in-network supplier (Section 2.1).`;
  const inNet = new Set((nets ?? []).map((n) => n.supplier_id));

  return {
    ...base,
    item: item.name,
    answer,
    policy_facts: facts.length ? facts : base.policy_facts,
    price: Number(item.price),
    plan_limit: plan ? Number(plan.annual_limit) : undefined,
    suppliers: (stock ?? [])
      .filter((r) => r.suppliers)
      .map((r) => ({
        name: r.suppliers!.name,
        address: [r.suppliers!.address, r.suppliers!.area].filter(Boolean).join(" · "),
        qty: r.qty,
        in_network: inNet.has(r.suppliers!.id),
      })),
  };
}
