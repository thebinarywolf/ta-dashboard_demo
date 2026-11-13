// Number formatting for the Financials tab. Money is in rupees and shown the
// Indian way: lakh (L) and crore (Cr).

/** ₹2.27 Cr, ₹17.2 L, ₹45,000. */
export function money(n: number | null | undefined, opts: { signed?: boolean } = {}): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "–";
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : opts.signed && n > 0 ? "+" : "";
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(abs >= 1e6 ? 1 : 2)} L`;
  return `${sign}₹${Math.round(abs).toLocaleString("en-IN")}`;
}

/** ₹2,26,82,357 */
export function moneyFull(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "–";
  return `${n < 0 ? "−" : ""}₹${Math.round(Math.abs(n)).toLocaleString("en-IN")}`;
}

/** Whole number with Indian grouping, or a dash. */
export function count(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "–";
  return n.toLocaleString("en-IN", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

export function pct(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "–";
  return `${n.toFixed(digits)}%`;
}

/** Change from `before` to `after` as a percentage, or null when it can't be worked out. */
export function changePct(after: number | null, before: number | null): number | null {
  if (after === null || before === null || before === 0) return null;
  return ((after - before) / Math.abs(before)) * 100;
}
