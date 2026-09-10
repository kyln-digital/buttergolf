import { describe, it, expect } from "vitest";
import {
  getShippingOption,
  rankCarrierPreference,
  selectRateForOption,
  type SelectableRate,
} from "@buttergolf/constants";

/** Minimal shape of a ShipEngine rate, with only the fields selection reads. */
function rate(
  carrier: string,
  service: string,
  amount: number,
  deliveryDays: number | null
): SelectableRate {
  return {
    carrier_friendly_name: carrier,
    service_type: service,
    shipping_amount: { amount },
    delivery_days: deliveryDays,
  };
}

const NEXT_DAY = getShippingOption("nextDay")!;
const STANDARD = getShippingOption("standard")!;
const EXPRESS = getShippingOption("express")!;

describe("selectRateForOption", () => {
  it("does not buy a slow cheap label when the buyer paid for next day", () => {
    // The original bug: cheapest-within-budget meant £8.99 next-day money
    // bought a 5-day Evri label.
    const rates = [
      rate("Evri", "Standard", 3.2, 5),
      rate("DPD", "Next Day", 7.5, 1),
      rate("Royal Mail", "Tracked 48", 4.1, 3),
    ];

    const selected = selectRateForOption(rates, NEXT_DAY);

    expect(selected?.carrier_friendly_name).toBe("DPD");
    expect(selected?.delivery_days).toBe(1);
  });

  it("returns null when nothing can meet the promised window", () => {
    // A real failure worth surfacing, not something to silently substitute.
    const rates = [rate("Evri", "Standard", 3.2, 5), rate("Royal Mail", "Tracked 48", 4.1, 3)];

    expect(selectRateForOption(rates, NEXT_DAY)).toBeNull();
  });

  it("prefers the named carrier over a cheaper one at the same speed", () => {
    // "Royal Mail Tracked 24" should buy Royal Mail where it can.
    const rates = [rate("Evri", "Next Day", 5.0, 1), rate("Royal Mail", "Tracked 24", 6.2, 1)];

    const selected = selectRateForOption(rates, EXPRESS);

    expect(selected?.carrier_friendly_name).toBe("Royal Mail");
  });

  it("takes the cheapest when no carrier preference matches", () => {
    const rates = [rate("InPost", "Locker 24", 4.4, 1), rate("GlobalPost", "Express", 6.0, 1)];

    const selected = selectRateForOption(rates, EXPRESS);

    expect(selected?.carrier_friendly_name).toBe("InPost");
  });

  it("prefers a verified delivery window over an unknown one", () => {
    // ShipEngine omits delivery_days for some services. Those stay eligible —
    // refusing to ship is worse — but never beat a rate that provably fits.
    const rates = [
      rate("Evri", "Unknown speed", 2.0, null),
      rate("Royal Mail", "Tracked 48", 4.1, 3),
    ];

    const selected = selectRateForOption(rates, STANDARD);

    expect(selected?.carrier_friendly_name).toBe("Royal Mail");
  });

  it("still ships when every rate has an unknown window", () => {
    // Nothing is verifiable, so carrier preference decides: for a next-day
    // option that's DPD, even though Evri is cheaper. Better to pay more for
    // the carrier the service is named after than to miss the promise.
    const rates = [rate("Evri", "Unknown", 2.0, null), rate("DPD", "Unknown", 5.0, null)];

    expect(selectRateForOption(rates, NEXT_DAY)?.carrier_friendly_name).toBe("DPD");
  });

  it("takes the cheapest unknown-window rate when no carrier is preferred", () => {
    const rates = [rate("InPost", "Unknown", 5.0, null), rate("GlobalPost", "Unknown", 2.0, null)];

    expect(selectRateForOption(rates, NEXT_DAY)?.carrier_friendly_name).toBe("GlobalPost");
  });

  it("falls back to cheapest for legacy orders with no recorded option", () => {
    // Orders placed before shippingOptionId existed.
    const rates = [rate("DPD", "Next Day", 7.5, 1), rate("Evri", "Standard", 3.2, 5)];

    expect(selectRateForOption(rates, undefined)?.carrier_friendly_name).toBe("Evri");
  });

  it("returns null when there are no rates at all", () => {
    expect(selectRateForOption([], STANDARD)).toBeNull();
    expect(selectRateForOption([], undefined)).toBeNull();
  });

  it("allows a rate exactly on the window boundary", () => {
    const rates = [rate("Royal Mail", "Tracked 48", 4.1, STANDARD.maxDeliveryDays)];

    expect(selectRateForOption(rates, STANDARD)).not.toBeNull();
  });

  it("is deterministic when every rate ties", () => {
    // The ShipEngine sandbox dummy carrier returns identical price and speed
    // for a dozen services. Without a final tiebreak the chosen label depends
    // on API ordering, so the same quote could buy a different service twice.
    const rates = [
      rate("Dummy Module", "Standard", 21.37, 1),
      rate("Dummy Module", "Dangerous Goods Service", 21.37, 1),
      rate("Dummy Module", "Saturday", 21.37, 1),
    ];

    const first = selectRateForOption(rates, NEXT_DAY);
    const reversed = selectRateForOption([...rates].reverse(), NEXT_DAY);

    expect(first?.service_type).toBe(reversed?.service_type);
    expect(first?.service_type).toBe("Dangerous Goods Service");
  });
});

describe("rankCarrierPreference", () => {
  it("ranks by position in the preference list, case-insensitively", () => {
    expect(rankCarrierPreference(NEXT_DAY, "DPD UK")).toBe(0);
    expect(rankCarrierPreference(NEXT_DAY, "royal mail group")).toBe(1);
  });

  it("ranks an unlisted carrier last", () => {
    expect(rankCarrierPreference(NEXT_DAY, "InPost")).toBe(NEXT_DAY.preferredCarriers.length);
  });
});
