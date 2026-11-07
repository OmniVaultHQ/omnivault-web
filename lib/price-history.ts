/*
File: lib/price-history.ts

Shared rules for which saved ItemPrice rows count as real market data.
Used when saving prices (lib/prices.ts) and when showing history, price
changes and portfolio charts (app/dashboard/page.tsx), so the numbers on
screen follow the same rules as the pricing engine.
*/

/*
How much each provider's price is trusted. A recent price from a higher-trust
source is not replaced by a lower-trust one.
- tcgplayer: market price from actual sales
- ebay: median of active listings (asking prices)
*/
export const SOURCE_TRUST: Record<string, number> = {
  tcgplayer: 3,
  ebay: 1,
};

// How long a trusted price stays "recent" enough to outrank a weaker source
export const TRUSTED_PRICE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// ItemPrice sources that are not real market data from a provider
export const NON_PROVIDER_SOURCES = ["manual", "simulated", "estimated-rarity"];

export function getSourceTrust(source: string): number {
  return SOURCE_TRUST[source] ?? 0;
}

/*
Provider dates come in different formats (pokemontcg.io uses "2026/11/06").
Returns null when missing or unparseable instead of saving a bad date.
Date-only values are read as midnight UTC.
*/
export function parseProviderDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value.replace(/\//g, "-"));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

type HistoryRow = {
  source: string;
  createdAt: Date;
  lastUpdated: Date;
};

/*
Rows that should appear in history, price changes and charts:
- only real provider prices (no manual, simulated or rarity-guess rows)
- minus "overruled" rows: a lower-trust price saved while a higher-trust price
  was still recent (e.g. an eBay price saved during a TCGplayer outage).

Works on the rows of ONE item, in any order; keeps the input order.
*/
export function filterTrustedHistory<T extends HistoryRow>(rows: T[]): T[] {
  const providerRows = rows.filter((row) => !NON_PROVIDER_SOURCES.includes(row.source));

  return providerRows.filter((row) => {
    const rowTrust = getSourceTrust(row.source);
    const rowTime = new Date(row.createdAt).getTime();

    return !providerRows.some((other) => {
      if (getSourceTrust(other.source) <= rowTrust) return false;

      const otherCreated = new Date(other.createdAt).getTime();
      const otherConfirmed = Math.max(otherCreated, new Date(other.lastUpdated).getTime());

      return otherCreated <= rowTime && rowTime <= otherConfirmed + TRUSTED_PRICE_MAX_AGE_MS;
    });
  });
}
