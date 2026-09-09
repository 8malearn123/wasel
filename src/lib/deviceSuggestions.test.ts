import { describe, it, expect } from "vitest";
import { brandFromModel, findSimilarDevice } from "@/lib/deviceSuggestions";
import type { Device } from "@/types/database";

const device = (partial: Partial<Device> & { id: string; imei: string; model: string }): Device => ({
  merchant_id: "m1",
  condition: "new",
  cost: 800,
  price: 1000,
  status: "available",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  ...partial,
});

const oldIphone = device({
  id: "1",
  imei: "353845110000001",
  model: "iPhone 15 Pro",
  brand: "Apple",
  color: "أسود",
  storage: "256GB",
  cost: 3400,
  price: 4200,
  created_at: "2026-02-01T00:00:00Z",
});

const newIphone = device({
  id: "2",
  imei: "353845110000002",
  model: "iPhone 15 Pro",
  brand: "Apple",
  color: "فضي",
  storage: "512GB",
  cost: 3600,
  price: 4500,
  created_at: "2026-03-01T00:00:00Z",
});

const galaxy = device({
  id: "3",
  imei: "354123980000003",
  model: "Galaxy S23 FE",
  brand: "Samsung",
  storage: "128GB",
  created_at: "2026-02-15T00:00:00Z",
});

const stock = [oldIphone, newIphone, galaxy];

describe("brandFromModel", () => {
  it("reads the maker out of the model name", () => {
    expect(brandFromModel("iPhone 15 Pro")).toBe("Apple");
    expect(brandFromModel("Galaxy S23 FE")).toBe("Samsung");
    expect(brandFromModel("Redmi Note 13")).toBe("Xiaomi");
    expect(brandFromModel("Pixel 8 Pro")).toBe("Google");
  });

  it("works with the Arabic spelling", () => {
    expect(brandFromModel("ايفون 15")).toBe("Apple");
  });

  it("says nothing when the model gives nothing away", () => {
    expect(brandFromModel("XT-900")).toBeNull();
    expect(brandFromModel("")).toBeNull();
  });
});

describe("findSimilarDevice", () => {
  it("matches an IMEI on its first 8 digits", () => {
    const match = findSimilarDevice(stock, { imei: "35384511" });
    expect(match?.model).toBe("iPhone 15 Pro");
  });

  it("returns the most recently added match, which carries the latest price", () => {
    expect(findSimilarDevice(stock, { imei: "35384511" })?.id).toBe(newIphone.id);
    expect(findSimilarDevice(stock, { model: "iPhone 15 Pro" })?.id).toBe(newIphone.id);
  });

  it("never matches the very IMEI being typed", () => {
    const match = findSimilarDevice([oldIphone], { imei: oldIphone.imei });
    expect(match).toBeNull();
  });

  it("falls back to a partial model match", () => {
    expect(findSimilarDevice(stock, { model: "galaxy s23" })?.id).toBe(galaxy.id);
  });

  it("holds off until there is enough to go on", () => {
    expect(findSimilarDevice(stock, { imei: "3538" })).toBeNull();
    expect(findSimilarDevice(stock, { model: "ip" })).toBeNull();
    expect(findSimilarDevice(stock, {})).toBeNull();
  });
});
