import { describe, expect, it } from "vitest";

import { formatRupiahInput, parseRupiahInput, rupiahCaretPosition } from "./rupiah-input";

describe("Rupiah input formatting", () => {
  it.each([
    ["50000", "50000"],
    ["50.000", "50000"],
    ["Rp 50.000", "50000"],
    ["5.0000", "50000"],
    ["1.250.000,00", "1250000"],
    ["", ""],
  ])("normalizes %s to an integer payload", (input, expected) => {
    expect(parseRupiahInput(input)).toBe(expected);
  });

  it.each(["1.250,50", "1,250", "9007199254740992", "Rp 2 5"]) (
    "rejects ambiguous or unsafe IDR value %s",
    (input) => {
      expect(parseRupiahInput(input)).toBeNull();
    },
  );

  it("groups thousands and keeps the caret beside the same digit", () => {
    expect(formatRupiahInput("1250000")).toBe("1.250.000");
    expect(rupiahCaretPosition("1250000", 4)).toBe(5);
  });
});
