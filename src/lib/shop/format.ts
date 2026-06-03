// Prices are stored in integer cents and include 8.1% Swiss VAT (inclusive).
export function formatPrice(cents: number, currency = 'chf'): string {
    return `${currency.toUpperCase()} ${(cents / 100).toFixed(2)}`
}
