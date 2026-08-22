/**
 * Currency formatting utilities — UGX default, USD supported.
 */

export type CurrencyCode = 'UGX' | 'USD';

/** Full price with commas — e.g. "UGX 450,000" */
export function formatPrice(amount: number, currency: CurrencyCode = 'UGX'): string {
  if (currency === 'UGX') {
    return `UGX ${Math.round(amount).toLocaleString()}`;
  }
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Card-optimised price:
 * UGX <1M  → exact: "UGX 450,000"
 * UGX ≥1M  → short: "UGX 1.5M"
 * USD ≥1K  → short: "$1.4K"
 */
export function formatPriceCard(amount: number, currency: CurrencyCode = 'UGX'): string {
  if (currency === 'UGX') {
    if (amount >= 1_000_000) return `UGX ${(amount / 1_000_000).toFixed(1)}M`;
    return `UGX ${Math.round(amount).toLocaleString()}`;
  }
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount.toFixed(2)}`;
}

/** Dashboard / earnings summary — always short */
export function formatPriceShort(amount: number, currency: CurrencyCode = 'UGX'): string {
  if (currency === 'UGX') {
    if (amount >= 1_000_000) return `UGX ${(amount / 1_000_000).toFixed(1)}M`;
    if (amount >= 1_000) return `UGX ${(amount / 1_000).toFixed(0)}K`;
    return `UGX ${Math.round(amount).toLocaleString()}`;
  }
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(1)}K`;
  return `$${amount.toFixed(2)}`;
}
