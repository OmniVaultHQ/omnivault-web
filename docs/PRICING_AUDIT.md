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

- **2026-11-07 — Step A done** (`4206010`): issues 1–4 fixed. Existing `estimated-rarity`/`manual` rows were left in place (none in the dev DB).
- **2026-11-07 — Trusted-source rule** (`dc60969`): a TCGplayer price from the last 7 days is kept over an eBay result (pokemontcg.io outages were swapping Charizard's $954.65 for eBay's $331). Re-confirmed prices bump `ItemPrice.lastUpdated`.
- **2026-11-07 — pokemontcg.io retries** (`f5dc529`): measured ~40% random 5xx; now 3 attempts with backoff.
- **2026-11-07 — Trusted history** (`d229197`): `lib/price-history.ts` holds the shared trust rules; dashboard history, Change, movers, set completion and the portfolio chart skip overruled/non-provider rows. Chart now carries last known prices forward and sums quantity across collections. Verified by the user on the dashboard.

- **2026-11-07 — Step B**: `ItemPrice` gains `currency` (default USD), `confidence`, `sampleSize`, `providerUpdatedAt`; saved on every refresh. Rows show "Low confidence" (eBay with <8 listings) and "Data from <date>" when market data is >7 days old; detail modal shows a one-line quality summary.
  - Finding: pokemontcg.io's TCGplayer data lags (gym2-2 `updatedAt` 2026/10/15 on 2026-11-07), so TCGplayer prices will often show as stale. That's accurate, not a bug. A direct TCGplayer or PriceCharting source would fix freshness.
  - **Schema workflow:** `dev.db` was built with `prisma db push` (no `_prisma_migrations` table; the 4 migration folders were never applied). Use `npx prisma db push` for dev changes. **Never run `prisma migrate dev` against it** — it will offer to reset (wipe) the DB. Before production (Postgres), create a fresh baseline migration from the current schema.

  - Verified by the user on the dashboard after a refresh (all 3 cards: tcgplayer, high, data from Oct 15, 2026). Date labels fixed to UTC (`e8eb6a2`).
  - Observed: dashboard refresh took 8.4s for 3 items (sequential + retries) — addressed in Step C.

- **2026-11-07 — Step C** (`442c7dc`, `e1fed3d`): `PRICE_PROVIDERS` registry; eBay exclusions split into common + per-category (card results unchanged on 19 sample titles; repro/box-only/manual-only/KO/for-parts/damaged now excluded); `Item.priceCheckedAt` (db push) so refresh skips items checked recently (dashboard: 1h, cron: 12h); 4 items priced in parallel; shared eBay token request; pokemontcg.io 3s per-attempt timeout with timeouts retried.
  - Verified by the user: second click 67 ms (nothing re-fetched); trust rule kept Charizard $954.65 and Blastoise $170.64 when pokemontcg.io failed. First click was 11.6s because of a 10s hang (fixed in `e1fed3d`; live test 1.8–5s for 3 cards).
  - **Biggest remaining accuracy/speed risk: pokemontcg.io reliability.** Even with 3 attempts about half of lookups failed during testing. Options: free `POKEMON_TCG_API_KEY`, or a direct TCGplayer / PriceCharting provider.

## Decision: Pokémon price source (2026-11-07)

- **pokemontcg.io is deprecated** (dev.pokemontcg.io): no new registrations, so no API key can be obtained; existing keys work until **March 1, 2027**; users are told to migrate to Scrydex. This likely explains the random 5xx/timeouts and weeks-old TCGplayer data.
- **Scrydex** (successor): paid only — Starter $29/mo (5,000 credits), Growth $99/mo (50,000). Keyless requests return 401. Needs `SCRYDEX_API_KEY` + `SCRYDEX_TEAM_ID`. Covers all TCGs, raw + graded prices, price history/trends, population reports; up to 100 cards per pricing request.
- **Decision: stay on free pokemontcg.io (keyless) + eBay for now.** Trust rules protect prices during outages.
- **Deadline: switch to Scrydex (or another source) before launch, and no later than March 2027.** Before building it, review Scrydex docs and terms for commercial use/display. Add it as a `PRICE_PROVIDERS` entry above eBay and give `scrydex` a trust level in `lib/price-history.ts`.

- **2026-11-07 — Step D**: Vitest 3.2.7 (`npm test`), 73 tests, ~0.5s, no network or DB:
  - `lib/price-providers.test.ts` — title matching per category, card numbers, outliers/median, TCGplayer printing choice, item kinds
  - `lib/price-providers.fallback.test.ts` — provider order, pokemontcg.io retries on 5xx and timeouts, eBay fallback, confidence by sample size, no-price instead of guessing, custom items never priced (fetch mocked)
  - `lib/price-history.test.ts` — trust ranking, overruled/non-provider rows, 7-day window, date parsing
  - `lib/prices.test.ts` — save rules: no-price, first save + owned-row sync (locked rows untouched), re-confirm bump, kept-trusted, 7-day expiry, 5x jump guard, high-confidence bypass, fake baselines ignored (in-memory Prisma fake)
  - Checked the tests catch regressions: making eBay outrank TCGplayer and disabling the jump guard failed 7 tests.
  - `npm audit`: tinypool advisory remains (dev-only, inside Vitest 3; fix requires Vitest 5). **Separately, Next.js 16.1.6 and @auth/core have critical advisories** — handle in production readiness.

Pricing phase (roadmap phase 2) complete apart from the Scrydex switch.

## Proposed order of work

- **Step A — correctness and safety (no schema change):** fixes 1–4. Stop creating starter prices; UI shows "No price yet" instead of a guess. Keep manual prices on the owned row only, and exclude `manual`/`estimated-rarity` from the jump-guard baseline. Require auth (session or `CRON_SECRET` header) on the update route. Optional, ask first: delete the existing `estimated-rarity` and `manual` ItemPrice rows.
- **Step B — record quality (additive migration):** add `currency`, `confidence`, `sampleSize`, `providerUpdatedAt` to `ItemPrice`. Show a low-confidence badge and a stale state (e.g. >7 days) in the UI.
- **Step C — engine structure:** provider registry (`supports(item)`, `getPrice(item)`), category-aware eBay filters, refresh uses staleness plus limited concurrency.
- **Step D — tests:** add Vitest; unit tests for title matching, number matching, outlier removal, variant selection.
- Later: PriceCharting (video games, graded), edition/variant fields on `Item`, condition/graded pricing at the owned-row level.
