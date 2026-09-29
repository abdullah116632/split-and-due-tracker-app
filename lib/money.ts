// All amounts are stored as integers in poisha (1 taka = 100 poisha) to avoid float errors.

export const CURRENCY = '৳';

/** Converts Bangla (০-৯) and Arabic-Indic digits, as typed on local keyboards, to 0-9. */
export function normalizeDigits(input: string): string {
  return input
    .replace(/[০-৯]/g, (d) => String(d.charCodeAt(0) - 0x09e6))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٫]/g, '.');
}

/** Parses user input like "1,250.5" (or "১২৫০.৫") into poisha. Returns null for invalid input. */
export function toPoisha(input: string): number | null {
  const s = normalizeDigits(input).replace(/[,\s]/g, '');
  if (!/^\d*(\.\d{0,2})?$/.test(s) || s === '' || s === '.') return null;
  const [whole, frac = ''] = s.split('.');
  return Number(whole || '0') * 100 + Number((frac + '00').slice(0, 2));
}

/** Converts poisha back into an editable string, e.g. 125050 -> "1250.50". */
export function poishaToInput(poisha: number): string {
  const whole = Math.floor(poisha / 100);
  const frac = poisha % 100;
  return frac ? `${whole}.${String(frac).padStart(2, '0')}` : String(whole);
}

/** Bangladeshi digit grouping: 1234567 -> "12,34,567". */
export function groupDigits(n: number): string {
  const s = String(n);
  if (s.length <= 3) return s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${rest},${last3}`;
}

/** Formats poisha as "৳1,250.50". Sign is dropped; callers describe direction in words. */
export function formatMoney(poisha: number): string {
  const abs = Math.abs(poisha);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  return `${CURRENCY}${groupDigits(whole)}${frac ? '.' + String(frac).padStart(2, '0') : ''}`;
}

/**
 * Splits `total` into integer parts proportional to `weights` (largest-remainder method),
 * so the parts always add up exactly to `total`.
 */
export function allocate(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (total * w) / sum);
  const parts = raw.map(Math.floor);
  let remainder = total - parts.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; remainder > 0; k = (k + 1) % order.length, remainder--) {
    parts[order[k].i]++;
  }
  return parts;
}
