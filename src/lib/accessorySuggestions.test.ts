import { describe, it, expect } from "vitest";
import { pickAccessoryKinds, suggestAccessories } from "@/lib/accessorySuggestions";
import type { Accessory } from "@/types/database";

const accessory = (partial: Partial<Accessory> & { id: string; name: string }): Accessory => ({
  merchant_id: "m1",
  sku: `SKU-${partial.id}`,
  category: undefined,
  brand: undefined,
  cost: 10,
  price: 50,
  quantity: 10,
  min_quantity: 1,
  created_at: "",
  updated_at: "",
  ...partial,
});

const iphoneCover = accessory({ id: "1", name: "كفر iPhone 13 شفاف", price: 60 });
const iphoneGlass = accessory({ id: "2", name: "حماية شاشة زجاج iPhone 13", price: 40 });
const galaxyBattery = accessory({ id: "3", name: "بطارية أصلية Galaxy S22" });
const hpLaptopBattery = accessory({ id: "4", name: "بطارية لابتوب HP أصلية" });
const genericCharger = accessory({ id: "5", name: "شاحن سريع 20 وات", price: 80 });
const powerBank = accessory({ id: "6", name: "باور بانك Anker 20000mAh", price: 249 });
const deskLamp = accessory({ id: "7", name: "مصباح مكتب" });
const outOfStock = accessory({ id: "8", name: "كفر iPhone 13 جلد", quantity: 0 });

const catalogue = [
  iphoneCover,
  iphoneGlass,
  galaxyBattery,
  hpLaptopBattery,
  genericCharger,
  powerBank,
  deskLamp,
  outOfStock,
];

describe("suggestAccessories", () => {
  it("puts accessories made for the same model first", () => {
    const ids = suggestAccessories("Apple iPhone 13", catalogue).map(a => a.id);
    expect(ids.slice(0, 2)).toEqual([iphoneGlass.id, iphoneCover.id]);
  });

  it("never suggests an accessory made for another brand", () => {
    const ids = suggestAccessories("Apple iPhone 13", catalogue).map(a => a.id);
    expect(ids).not.toContain(galaxyBattery.id);
    expect(ids).not.toContain(hpLaptopBattery.id);
  });

  it("keeps brand-neutral companions like chargers and power banks", () => {
    const ids = suggestAccessories("Samsung Galaxy A55", catalogue).map(a => a.id);
    expect(ids).toContain(genericCharger.id);
    expect(ids).toContain(powerBank.id);
  });

  it("leaves out unrelated stock, sold-out items and what is already in the cart", () => {
    const ids = suggestAccessories("Apple iPhone 13", catalogue, {
      exclude: [iphoneCover.id],
    }).map(a => a.id);
    expect(ids).not.toContain(deskLamp.id);
    expect(ids).not.toContain(outOfStock.id);
    expect(ids).not.toContain(iphoneCover.id);
  });

  it("honours the limit", () => {
    expect(suggestAccessories("Apple iPhone 13", catalogue, { limit: 2 })).toHaveLength(2);
  });

  it("returns nothing when there is nothing sensible to offer", () => {
    expect(suggestAccessories("Canon EOS R50", [deskLamp, galaxyBattery])).toEqual([]);
  });
});

describe("pickAccessoryKinds", () => {
  const chargingCable = accessory({ id: "9", name: "كابل شاحن Type-C", price: 35 });
  const stock = [...catalogue, chargingCable];

  it("offers a screen protector, a cable and a charger in that order", () => {
    const picks = pickAccessoryKinds("Apple iPhone 13", stock);
    expect(picks.map(p => p.kind.key)).toEqual(["screen", "cable", "charger"]);
    expect(picks[0].accessory?.id).toBe(iphoneGlass.id);
  });

  it("gives a cable to the cable option, not to the charger", () => {
    const picks = pickAccessoryKinds("Apple iPhone 13", stock);
    const byKind = Object.fromEntries(picks.map(p => [p.kind.key, p.accessory?.id]));
    expect(byKind.cable).toBe(chargingCable.id);
    expect(byKind.charger).toBe(genericCharger.id);
  });

  it("reports an option the branch cannot cover", () => {
    const picks = pickAccessoryKinds("Apple iPhone 13", [iphoneCover]);
    expect(picks.every(p => p.accessory === null)).toBe(true);
  });

  it("skips an accessory already in the cart", () => {
    const picks = pickAccessoryKinds("Apple iPhone 13", stock, { exclude: [chargingCable.id] });
    const cable = picks.find(p => p.kind.key === "cable");
    expect(cable?.accessory).toBeNull();
  });
});
