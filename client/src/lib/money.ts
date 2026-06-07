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

// Cache one formatter per currency (constructing Intl.NumberFormat isn't free).
const formatters = new Map<string, Intl.NumberFormat>()

function formatterFor(currency: string): Intl.NumberFormat {
  let fmt = formatters.get(currency)
  if (!fmt) {
    fmt = new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    formatters.set(currency, fmt)
  }
  return fmt
}

/** Format integer minor units as a localized currency string (e.g. "1.100,00 €"). */
export function formatMoney(minor: Minor, currency: string): string {
  return formatterFor(currency).format(toAmount(minor))
}

/** The currency's symbol for the active locale (e.g. "EUR" -> "€", "GBP" -> "£"). */
export function currencySymbol(currency: string): string {
  const part = formatterFor(currency)
    .formatToParts(0)
    .find((p) => p.type === 'currency')
  return part?.value ?? currency
}

/**
 * Parse a user-entered decimal string into integer minor units WITHOUT going
 * through floating point. Accepts '.' or ',' as the decimal separator, and
 * tolerates a European thousands separator when the amount carries both — e.g.
 * "2.500,00" (de-DE) or "1,234.56" (en): the right-most separator is taken as
 * the decimal point and the other is stripped as grouping. Income figures are
 * the largest in the budget, so this is where grouping separators show up.
 * Returns null for empty / negative / non-numeric input. Anything beyond 4 dp
 * is rounded half-up to scale 4.
 */
export function parseMinor(input: string): Minor | null {
  let trimmed = input.trim()

  const lastComma = trimmed.lastIndexOf(',')
  const lastDot = trimmed.lastIndexOf('.')
  if (lastComma !== -1 && lastDot !== -1) {
    // Both present: the right-most is the decimal separator; strip the grouping one.
    const decimalSep = lastComma > lastDot ? ',' : '.'
    const groupSep = decimalSep === ',' ? '.' : ','
    trimmed = trimmed.split(groupSep).join('').replace(decimalSep, '.')
  } else {
    // A single separator is the decimal separator (preserves prior behaviour:
    // a malformed "1.2.3" / "1,2,3" still fails the strict check below).
    trimmed = trimmed.replace(',', '.')
  }

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
