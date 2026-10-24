import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { ChatResponse } from "./precheck";

const Input = z.object({
  planId: z.enum(["bluecare_ppo", "metro_medicaid"]),
  message: z.string().max(2000),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(4000) }))
    .max(10)
    .default([]),
  file: z
    .object({
      name: z.string().max(200),
      mime: z.string().max(100),
      b64: z.string().max(4_200_000), // ~3 MB file
    })
    .optional(),
});

export type AnalyzeResult =
  | { kind: "chat"; reply: string }
  | { kind: "result"; response: ChatResponse; extracted: Extracted };

export interface Extracted {
  item: string | null;
  prescriber: string | null;
  diagnosis: string | null;
  readable: boolean;
  reply: string;
}

export const analyzePrescription = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }): Promise<AnalyzeResult> => {
    const { callGemma, parseJson } = await import("./gemma.server");
    const { retrieve, buildContext } = await import("./rag");
    const { createClient } = await import("@supabase/supabase-js");

    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const db = createClient(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });

    const [{ data: items }, { data: plan }] = await Promise.all([
      db.from("equipment_items").select("id, name, price, hcpcs_code"),
      db.from("plans").select("*").eq("id", data.planId).maybeSingle(),
    ]);
    const itemNames = (items ?? []).map((i) => i.name);

    // 1) Gemma reads the prescription (image / PDF / text) and extracts the equipment.
    const userParts: ({ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } } | { type: "file"; file: { filename: string; file_data: string } })[] = [
      { type: "text", text: data.message || "Please read my prescription." },
    ];
    if (data.file) {
      const url = `data:${data.file.mime};base64,${data.file.b64}`;
      userParts.push(
        data.file.mime === "application/pdf"
          ? { type: "file", file: { filename: data.file.name, file_data: url } }
          : { type: "image_url", image_url: { url } },
      );
    }
    const extractRaw = await callGemma(
      [
        {
          role: "system",
          content: `You are a friendly assistant for "Coverage Pre-Check", which helps people check whether durable medical equipment is likely covered by their insurance plan.
Known equipment: ${itemNames.join(", ")}.
If the user attached a prescription, read it and identify the equipment prescribed. Otherwise use their message.
Respond ONLY with JSON: {"item": one of the known equipment names exactly, or null, "prescriber": string or null, "diagnosis": string or null, "readable": true/false (false if an attachment could not be read), "reply": a short, warm, human reply (1-3 sentences) — if no equipment was identified, chat naturally and ask what they need; never say "approved"}.`,
        },
        ...data.history.slice(-6).map((h) => ({ role: h.role, content: h.text })),
        { role: "user", content: userParts },
      ],
      300,
      true,
    );
    const ex = parseJson<Extracted>(extractRaw) ?? { item: null, prescriber: null, diagnosis: null, readable: !data.file, reply: extractRaw };
    const item = (items ?? []).find((i) => i.name.toLowerCase() === (ex.item ?? "").toLowerCase());
    if (!item) {
      return {
        kind: "chat",
        reply: ex.reply || (data.file ? "I couldn't find a supported equipment item on that prescription. Could you tell me what was prescribed?" : "How can I help?"),
      };
    }

    // 2) Retrieve the relevant policy sections for this plan (BM25 RAG).
    const { data: sections } = await db
      .from("policy_sections")
      .select("section, title, body, item_id")
      .eq("plan_id", data.planId);
    const query = `${item.name} ${ex.diagnosis ?? ""} coverage prior authorization annual limit network supplier`;
    const top = retrieve(sections ?? [], query, item.id, 4);
    const context = buildContext(top, 3000);

    // 3) Gemma writes a plain-language answer grounded only in the retrieved excerpts.
    const answer = await callGemma(
      [
        {
          role: "system",
          content: `Answer using ONLY the policy excerpts below. Cite section numbers like "(Section 4.5)". Be short (max 4 sentences), plain, and kind. Never say "approved" or "pre-approved"; use "Likely covered", "Needs prior authorization", "Within plan limit". Item price is $${item.price} (sample); plan annual limit is $${plan?.annual_limit ?? "unknown"} (sample).
Policy excerpts for ${plan?.name ?? data.planId}:
${context}`,
        },
        { role: "user", content: `The prescription is for a ${item.name}${ex.diagnosis ? ` (diagnosis: ${ex.diagnosis})` : ""}. What applies and what should I do next?` },
      ],
      300,
    );

    // 4) Exact supplier / stock / network numbers come from the database, not the model.
    const [{ data: stock }, { data: nets }] = await Promise.all([
      db.from("supplier_stock").select("qty, suppliers(id, name, address, area)").eq("item_id", item.id),
      db.from("supplier_networks").select("supplier_id").eq("plan_id", data.planId),
    ]);
    const inNet = new Set((nets ?? []).map((n) => n.supplier_id));

    return {
      kind: "result",
      extracted: ex,
      response: {
        item: item.name,
        answer,
        score: 0,
        price: Number(item.price),
        plan_limit: plan ? Number(plan.annual_limit) : undefined,
        policy_facts: top.map((c) => ({ section: c.section, text: c.body })),
        suppliers: (stock ?? [])
          .filter((r) => r.suppliers)
          .map((r) => ({
            name: r.suppliers!.name,
            address: [r.suppliers!.address, r.suppliers!.area].filter(Boolean).join(" · "),
            qty: r.qty,
            in_network: inNet.has(r.suppliers!.id),
          })),
      },
    };
  });
