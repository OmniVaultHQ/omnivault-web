# Pricing Audit — 2026-11-07

Scope: `lib/price-providers.ts`, `lib/prices.ts`, `app/api/Prices/update/route.ts`, dashboard server actions in `app/dashboard/page.tsx`, `app/components/CollectionItemsSection.tsx`, `prisma/schema.prisma`.

Stack confirmed: Next.js 16.1.6, React 19.2.3, Prisma 6.19, NextAuth 5 beta. Dev DB has 1,937 Pokémon catalog items (all with pokemontcg.io IDs), 1 user, 2 owned rows. No test suite. `npx tsc --noEmit` passes. ESLint: 9 errors (`any` in `app/dashboard/page.tsx`), 10 warnings.

## How pricing works today

1. **Routing** (`getBestProviderPrice`): Pokémon item with `externalId` → pokemontcg.io TCGplayer price (retry once on 5xx). Otherwise, or if that fails → eBay Browse active listings. Simulated only if `PRICING_ALLOW_SIMULATED=true` (not set). Else no price.
2. **TCGplayer variant**: picks unlimited/normal printings before 1st Edition (the catalog has no edition field).
3. **eBay matching** (`titleMatchesItem`): every name word present, card number present, excludes lots/proxies/graded/sealed-accessory terms and foreign-language listings, IQR outlier trim, median of ≥3 matches. Confidence "medium" with ≥8 matches, else "low".
4. **Saving** (`savePriceForItem`): low/medium-confidence prices more than 5x away from the last saved price are rejected. New ItemPrice row only when the price or source changes. Syncs `Item.marketPrice` and unlocked `CollectionItem` rows.
5. **Triggers**: dashboard "Refresh Prices" (re-prices every item in the current view, no staleness check), and `POST /api/Prices/update` (owned items not priced in 12h, max 200).

## Status

| Area | Status |
|---|---|
| Pokémon pricing via TCGplayer | Working |
| eBay fallback with match validation | Working (verified on Blaine's Charizard) |
| Outlier / jump protection | Partially working — see issue 2 |
| Manual price override + lock | Working, but pollutes shared history — issue 3 |
| Price source shown in UI | Working |
| Confidence / currency stored | Missing — computed, then discarded |
| Stale / unavailable price state in UI | Missing — UI invents a rarity-based value instead |
| Non-Pokémon categories (Gundam, MTG, games, minis…) | eBay only, card-oriented filters |
| PriceCharting / direct TCGplayer | Planned |
| Editions / variants / graded | Planned (no schema support) |
| Pluggable provider registry | Planned (routing is hardcoded) |
| Automated tests | Missing |

## Issues, by severity

1. **Owned rows are not checked against the logged-in user** (security). `deleteItem`, `updateQuantity`, `savePurchasePrice`, `saveMarketPrice`, `useAutoPriceAgain` and `updateItemDetails` update by row `id` alone. Server actions are public endpoints, so any logged-in user who obtains another user's row id can edit or delete it. Fix: scope every write by `{ id, userId }`.
2. **Fake "starter" prices are saved into real price history** (Rule 7). Adding an item calls `ensureItemHasStarterPrice`, which writes a rarity guess ($1/$5/$25/$50) as source `estimated-rarity`. The jump guard only ignores `simulated`, so that guess becomes the baseline: a new Rare Holo Charizard is saved at $50, and a correct eBay price of $430 (8.6x) is then rejected as suspicious. Only "high" TCGplayer prices get through. The UI also shows a rarity-based "fallback" value when nothing is known.
3. **One user's manual price goes into the shared catalog history.** `saveMarketPrice` writes an `ItemPrice` row with source `manual`. Price history is per catalog item (shared by all users), so one user's override shows up in everyone's history and "Change", and also becomes the jump-guard baseline.
4. **`POST /api/Prices/update` has no auth.** Anyone can trigger up to 200 provider calls per request (`force: true` ignores staleness), using up eBay and pokemontcg.io limits.
5. **Confidence, currency and sample size are not stored**, so the UI can't separate reliable from low-confidence estimates (brief §5.4–5.5).
6. **Dashboard refresh ignores staleness and runs sequentially**, so large collections will make the button hang and spend API quota re-pricing fresh items.
7. **Provider routing is hardcoded**, and non-card categories get card-specific eBay filters. Adding PriceCharting or Gundam-specific logic means editing the router.
8. **No tests** around `titleMatchesItem` / outlier logic, which decide price accuracy.

## Progress log

- **2026-11-07 — Step A done** (`625ebbd`): issues 1–4 fixed. Existing `estimated-rarity`/`manual` rows were left in place (none in the dev DB).
- **2026-11-07 — Trusted-source rule** (`7ed990a`): a TCGplayer price from the last 7 days is kept over an eBay result (pokemontcg.io outages were swapping Charizard's $954.65 for eBay's $331). Re-confirmed prices bump `ItemPrice.lastUpdated`.
- **2026-11-07 — pokemontcg.io retries** (`07c1e59`): measured ~40% random 5xx; now 3 attempts with backoff.
- **2026-11-07 — Trusted history** (`b2a29b7`): `lib/price-history.ts` holds the shared trust rules; dashboard history, Change, movers, set completion and the portfolio chart skip overruled/non-provider rows. Chart now carries last known prices forward and sums quantity across collections. Verified by the user on the dashboard.

- **2026-11-07 — Step B**: `ItemPrice` gains `currency` (default USD), `confidence`, `sampleSize`, `providerUpdatedAt`; saved on every refresh. Rows show "Low confidence" (eBay with <8 listings) and "Data from <date>" when market data is >7 days old; detail modal shows a one-line quality summary.
  - Finding: pokemontcg.io's TCGplayer data lags (gym2-2 `updatedAt` 2026/10/15 on 2026-11-07), so TCGplayer prices will often show as stale. That's accurate, not a bug. A direct TCGplayer or PriceCharting source would fix freshness.
  - **Schema workflow:** `dev.db` was built with `prisma db push` (no `_prisma_migrations` table; the 4 migration folders were never applied). Use `npx prisma db push` for dev changes. **Never run `prisma migrate dev` against it** — it will offer to reset (wipe) the DB. Before production (Postgres), create a fresh baseline migration from the current schema.

Next: Step C (provider registry, category-aware eBay filters, faster refresh) or Step D (tests).

## Proposed order of work

- **Step A — correctness and safety (no schema change):** fixes 1–4. Stop creating starter prices; UI shows "No price yet" instead of a guess. Keep manual prices on the owned row only, and exclude `manual`/`estimated-rarity` from the jump-guard baseline. Require auth (session or `CRON_SECRET` header) on the update route. Optional, ask first: delete the existing `estimated-rarity` and `manual` ItemPrice rows.
- **Step B — record quality (additive migration):** add `currency`, `confidence`, `sampleSize`, `providerUpdatedAt` to `ItemPrice`. Show a low-confidence badge and a stale state (e.g. >7 days) in the UI.
- **Step C — engine structure:** provider registry (`supports(item)`, `getPrice(item)`), category-aware eBay filters, refresh uses staleness plus limited concurrency.
- **Step D — tests:** add Vitest; unit tests for title matching, number matching, outlier removal, variant selection.
- Later: PriceCharting (video games, graded), edition/variant fields on `Item`, condition/graded pricing at the owned-row level.
