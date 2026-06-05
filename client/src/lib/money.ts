// Centralised Euro formatting so every amount renders identically (€1.234,56
// style depends on locale; we use de-DE/EU grouping with the € symbol).
const euroFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatEuro(amount: number): string {
  return euroFormatter.format(amount ?? 0)
}
