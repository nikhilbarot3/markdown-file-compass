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
  const inNet = new Set((nets ?? []).map((n) => n.supplier_id));

  return {
    ...base,
    item: item.name,
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
