import { describe, it, expect } from "vitest";
import { rankSuppliers, sampleResponse } from "./precheck";

describe("match score", () => {
  it("back brace on BlueCare with stocked in-network supplier scores 100", () => {
    const r = rankSuppliers(sampleResponse("bluecare_ppo", "back brace"), "bluecare_ppo");
    expect(r[0]!.score).toBe(100);
  });
  it("Eastside Home Care is out of network on BlueCare and scores 75", () => {
    const r = rankSuppliers(sampleResponse("bluecare_ppo", "back brace"), "bluecare_ppo");
    const e = r.find((s) => s.name.startsWith("Eastside"))!;
    expect(e.inNetwork).toBe(false);
    expect(e.score).toBe(75);
  });
  it("CPAP ($700) exceeds the $250 BlueCare limit", () => {
    const r = rankSuppliers(sampleResponse("bluecare_ppo", "cpap"), "bluecare_ppo");
    expect(r[0]!.checks[3]!.passed).toBe(false);
  });
  it("a supplier with no stock scores lower than the same supplier in stock", () => {
    const res = sampleResponse("metro_medicaid", "walker");
    const stocked = rankSuppliers(res, "metro_medicaid")[0]!;
    const noStock = rankSuppliers(
      { ...res, suppliers: [{ ...stocked, qty: 0 }] },
      "metro_medicaid",
    )[0]!;
    expect(noStock.inStock).toBe(false);
    expect(noStock.reason).toContain("Out of stock");
    expect(noStock.score).toBeLessThan(stocked.score);
  });
});

import { detectItem } from "./precheck";
describe("item detection", () => {
  it("'hi' names no item", () => expect(detectItem("hi")).toBeNull());
  it("finds back brace", () => expect(detectItem("I need a back brace")).toBe("back brace"));
});

import { retrieve } from "./rag";
describe("policy retrieval", () => {
  const chunks = [
    { section: "4.5", title: "Prior authorization", body: "A back brace needs prior authorization", item_id: "back_brace" },
    { section: "4.5", title: "Prior authorization", body: "A CPAP needs prior authorization", item_id: "cpap" },
    { section: "4.7", title: "Annual limit", body: "Annual limit is $250", item_id: null },
  ];
  it("never returns another item's rule", () => {
    const r = retrieve(chunks, "walker coverage", "walker");
    expect(r.map((c) => c.item_id)).toEqual([null]);
  });
  it("includes the item's own prior authorization rule", () => {
    const r = retrieve(chunks, "back brace", "back_brace");
    expect(r.some((c) => c.item_id === "back_brace")).toBe(true);
  });
});
