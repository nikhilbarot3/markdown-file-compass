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
});

import { detectItem } from "./precheck";
describe("item detection", () => {
  it("'hi' names no item", () => expect(detectItem("hi")).toBeNull());
  it("finds back brace", () => expect(detectItem("I need a back brace")).toBe("back brace"));
});
