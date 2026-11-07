# OmniVault — Project Brief

Collectibles management and portfolio tracking platform. Repo: OmniVaultHQ/omnivault-web.
Design: black / dark gray / silver / white; modern, minimalist, professional. Keep the existing design language unless a redesign is requested.

## Vision

One place for collectors to (1) manage collections, (2) track market prices, (3) analyze portfolio performance. Built for casual collectors, serious collectors and investors, with commercial use in mind.

Started with the Gundam Card Game; expanding to a universal system: trading cards (Gundam, Pokémon, MTG, Yu-Gi-Oh!, One Piece…), miniatures and models (Warhammer, Gunpla, scale models), video games and consoles, comics and manga (incl. graded), figures and statues (Funko etc.), sneakers, limited merch, custom categories. **New categories must not require architecture changes.**

## Stack

Next.js (App Router) + React + TypeScript + Tailwind · Prisma (SQLite in dev) · NextAuth · eBay API, Pokémon TCG API (planned: TCGplayer, PriceCharting, others). Always inspect the repo to confirm versions and what's actually implemented.

## Features (verify before modifying)

- **Auth**: register, log in/out, private per-user data unless explicitly shared.
- **Collections**: multiple per user, default "Main", custom names, add/remove, quantities, per-collection stats and value.
- **Catalog**: shared, searchable, separate from user inventory. Fields: name, category, brand/manufacturer, set, set code, item number, MPN, rarity, description, image, release date, external IDs.
- **Custom items**: user-created, no external ID required; name, category, description, image upload, condition, qty, purchase price/date, estimated value, notes.
- **Inventory**: catalog item vs owned item; qty, condition, purchase price/date, current value, notes. Eventually track individual copies.

## Market pricing (top priority)

- Modular providers (`lib/price-providers.ts`): identify category → pick providers → build precise query → fetch → validate match → normalize → select value → save price + source → record last update. Not coupled to one marketplace.
- Match on everything available: name, manufacturer, set, set code, number, product number, MPN, edition, variant, condition, grading.
- Reject wrong matches, duplicates, accessories, incomplete products, wrong variants, invalid prices, outliers.
- Distinguish reliable / low-confidence / unavailable prices in the UI.
- Price history records: item, provider, price, currency, timestamp, condition/variant, confidence/match info.

## Dashboard and UI

- Stats: total collectibles, unique items, purchase cost, market value, unrealized P/L ($ and %), number of collections — from real stored data.
- Charts: value over time (from recorded history only), cost vs value, value by category, most valuable, biggest gains/losses.
- Grid view and list view; search/filter/sort by name, category, set, number, collection, condition, value, date added, gain/loss.
- **Set completion**: total cards, unique owned, missing, %, value owned. Duplicates don't count; variants per catalog rules.
- **Admin catalog imports**: choose category/provider/set, import or update, review results and failures, no duplicates (stable external IDs), safe retries, admin-only.
- **CSV import/export**: validate, preview, show errors; export for backup.

## Future

Watchlists (target price, history, notes) · price alerts · public collection sharing (financials hidden by default) · sales tracking (fees, shipping, realized P/L, history preserved) · responsive/mobile.

## Database

Existing: User, Account, Session, Item, ItemPrice, Collection, CollectionItem (+ CustomItem, CatalogSource, CatalogCollection, UserItem). Possible later: Category, Set, PriceProvider, PriceHistory, Watchlist, PriceAlert, Sale, SaleItem, ImportJob — only when a feature needs them. Migrations must preserve user data.

## Roadmap

1. Project audit — status report (working / partial / planned / broken / needs verification).
2. **Complete market pricing** (HIGH) — matching, routing, normalization, source info, refresh, error handling, never overwrite good history with bad data, accuracy tests.
3. Collection management (HIGH) — creation, add/remove, quantity, condition, filtering, grid/list, item detail.
4. Portfolio analytics (HIGH) — verify cost/value math, performance stats, historical charts, category and per-collection breakdowns.
5. Catalog expansion (MED) — admin, set imports, dedupe, more categories, manufacturer/product IDs, search.
6. Watchlist and alerts (MED).
7. Sales and transaction history (MED).
8. Production readiness (HIGH before launch) — auth security, data isolation, server-side validation, API key handling, rate limiting, logging, backups, prod infra and DB, automated tests and deploy checks.

## Development rules

1. Preserve working features; inspect before changing.
2. Incremental changes, one feature at a time; no large rewrites without reason.
3. Before major changes, explain what changes, why, which files, and whether the DB changes.
4. TypeScript quality; avoid `any`.
5. Never delete user collections, inventory or price history without explicit permission.
6. API credentials stay server-side.
7. **No fake market data.** If a provider fails, show unavailable/stale, never a fabricated price.
8. Verify: tests, `npx tsc --noEmit`, lint, check the feature, report unresolved issues.
9. Follow existing structure and conventions.
10. Keep a record of completed work, remaining tasks and architectural decisions (`docs/`).
