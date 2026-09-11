import { describe, expect, it } from "vitest";
import { addMonthsKey, costTotals, formatMoney, nextRenewal } from "./costs";

describe("Kosten", () => {
  it("Monate addieren, Monatsende bleibt Monatsende", () => {
    expect(addMonthsKey("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsKey("2026-11-15", 3)).toBe("2027-02-15");
    expect(addMonthsKey("2024-02-29", 12)).toBe("2025-02-28");
  });

  it("vergangene Verlängerungen rücken weiter, einmalige nicht", () => {
    expect(nextRenewal("2025-03-10", "YEARLY", "2026-09-12")).toBe("2027-03-10");
    expect(nextRenewal("2026-08-31", "MONTHLY", "2026-09-12")).toBe("2026-09-30");
    expect(nextRenewal("2026-10-01", "MONTHLY", "2026-09-12")).toBe("2026-10-01");
    expect(nextRenewal("2025-01-01", "ONCE", "2026-09-12")).toBe("2025-01-01");
    expect(nextRenewal(null, "YEARLY", "2026-09-12")).toBeNull();
  });

  it("Summen je Währung: monatlich, jährlich, einmalig", () => {
    const totals = costTotals([
      { amountCents: 500, currency: "EUR", interval: "MONTHLY" },
      { amountCents: 1200, currency: "EUR", interval: "YEARLY" },
      { amountCents: 3000, currency: "EUR", interval: "ONCE" },
      { amountCents: 2000, currency: "USD", interval: "MONTHLY" },
    ]);
    expect(totals).toEqual([
      { currency: "USD", monthly: 2000, yearly: 24000, once: 0 },
      { currency: "EUR", monthly: 600, yearly: 7200, once: 3000 },
    ]);
  });

  it("Beträge in der Sprache der Oberfläche", () => {
    expect(formatMoney(1299, "EUR", "de").replace(/\s/g, " ")).toBe("12,99 €");
    expect(formatMoney(1299, "USD", "en")).toBe("US$12.99");
  });
});
