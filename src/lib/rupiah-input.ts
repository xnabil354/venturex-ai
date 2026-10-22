const rupiahInteger = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 0,
  useGrouping: true,
});

/** Convert an IDR input (plain or Indonesian grouped digits) to its integer payload. */
export function parseRupiahInput(value: string): string | null {
  const normalized = value.trim().replace(/^Rp\s*/iu, "");

  if (!normalized) return "";
  if (/\s/u.test(normalized) || !/^[\d.]+(?:,0{1,2})?$/u.test(normalized)) {
    return null;
  }

  const integerPart = normalized.split(",", 1)[0] ?? "";
  const digits = integerPart.replace(/\./gu, "");
  if (!digits) return "";
  const amount = Number(digits);
  return Number.isSafeInteger(amount) ? String(amount) : null;
}

export function formatRupiahInput(digits: string): string {
  if (!/^\d+$/u.test(digits)) return "";
  const amount = Number(digits);
  return Number.isSafeInteger(amount) ? rupiahInteger.format(amount) : digits;
}

export function rupiahCaretPosition(digits: string, digitsBeforeCaret: number): number {
  return formatRupiahInput(digits.slice(0, digitsBeforeCaret)).length;
}
