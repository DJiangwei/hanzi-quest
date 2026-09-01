// Pure money formatting. Client-safe — NO db imports.
//
// Every £ string in the app is produced here. Money is integer pence
// everywhere else: a float column drifts by rounding error, and 1.15 has no
// exact binary representation.

/** Format integer pence as a £ string: 150 → "£1.50", -250 → "-£2.50". */
export function formatPence(pence: number): string {
  const negative = pence < 0;
  const abs = Math.abs(Math.trunc(pence));
  const body = `£${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
  return negative ? `-${body}` : body;
}

/**
 * Parse a £ amount typed by a parent ("1.50", "1.5", ".5", "2", "£3.25") into
 * integer pence. Returns null for anything that is not a plain non-negative
 * amount with at most two decimal places.
 *
 * `Math.round` is load-bearing: Number('1.15') * 100 === 114.99999999999999,
 * so truncating would quietly bill 1p less on a large fraction of inputs.
 */
export function parsePoundsToPence(input: string): number | null {
  const trimmed = input.trim().replace(/^£/, '').trim();
  if (trimmed === '' || trimmed === '.') return null;
  if (!/^\d*\.?\d{0,2}$/.test(trimmed)) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}
