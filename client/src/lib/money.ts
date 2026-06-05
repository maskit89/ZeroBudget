// Money on the client is an integer count of minor units at SCALE 4
// (ten-thousandths of a Euro), matching the backend's decimal(18,4).
//
// Why integers: every budget total is a SUM of line amounts. Summing IEEE-754
// doubles can accumulate drift (0.1 + 0.2 !== 0.3); summing integers cannot.
// We therefore convert to integer minor units at the API boundary, do all
// arithmetic on integers, and only divide by SCALE for display/transport.
//
// Safe-range note: a JS number is an exact integer up to 2^53. At scale 4 that
// covers budgets up to ~900 billion EUR — far beyond any personal budget. If
// the full decimal(18,4) range is ever required, swap `Minor` to bigint; the
// call sites below are the only places that would change.

const FACTOR = 10_000

/** Integer minor units — ten-thousandths of a Euro. */
export type Minor = number

/** API JSON amount (a decimal with <= 4 dp) -> integer minor units. */
export function fromAmount(amount: number): Minor {
  return Math.round(amount * FACTOR)
}

/** Integer minor units -> decimal number for the API wire format. */
export function toAmount(minor: Minor): number {
  return minor / FACTOR
}

/** Exact integer sum. */
export function sumMinor(values: Minor[]): Minor {
  return values.reduce((acc, v) => acc + v, 0)
}

/** Plain (non-localized) decimal string for editing in an <input>. */
export function toEditString(minor: Minor): string {
  return (minor / FACTOR).toString()
}

const euroFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Format integer minor units as a localized Euro string (e.g. "1.100,00 €"). */
export function formatEuro(minor: Minor): string {
  return euroFormatter.format(toAmount(minor))
}

/**
 * Parse a user-entered decimal string into integer minor units WITHOUT going
 * through floating point. Accepts '.' or ',' as the decimal separator.
 * Returns null for empty / negative / non-numeric input. Anything beyond 4 dp
 * is rounded half-up to scale 4.
 */
export function parseMinor(input: string): Minor | null {
  const trimmed = input.trim().replace(',', '.')
  if (trimmed === '' || !/^\d+(\.\d+)?$/.test(trimmed)) {
    return null
  }

  const [intPart, fracRaw = ''] = trimmed.split('.')
  const frac4 = fracRaw.slice(0, 4).padEnd(4, '0')
  let minor = Number(intPart) * FACTOR + Number(frac4)

  // Round half-up on a 5th fractional digit.
  const fifth = fracRaw.charAt(4)
  if (fifth !== '' && Number(fifth) >= 5) {
    minor += 1
  }

  return minor
}
