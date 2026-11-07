# OmniVault

Read `docs/PROJECT_BRIEF.md` for the product vision, roadmap and development rules. Key rules:

- Inspect before changing; make incremental changes; explain major changes (what, why, files, DB impact) before making them.
- No fake market data: if pricing fails, show unavailable/stale. Simulated prices only with `PRICING_ALLOW_SIMULATED=true` in local dev.
- Never delete user collections, inventory or price history without explicit permission. Migrations must preserve data.
- Keep API credentials server-side. Avoid `any`.
- Verify with `npm test` (Vitest, pricing tests in `lib/*.test.ts`), `npx tsc --noEmit` and `npx eslint <files>`. Add or update tests when changing pricing rules.
- Record decisions and status in `docs/` (pricing audit: `docs/PRICING_AUDIT.md`).
- pokemontcg.io (current Pokémon price source) is deprecated and stops working **March 1, 2027**; the plan is to move to Scrydex (paid) before launch. See the decision in `docs/PRICING_AUDIT.md`.

Dev: `npm run dev` (Next.js 16, Turbopack). If Turbopack panics with "Next.js package not found", delete `.next` and restart. Local DB is SQLite at `prisma/dev.db`, managed with `npx prisma db push` (stop the dev server first on Windows). **Never run `prisma migrate dev`**: the DB has no migration history and Prisma will offer to wipe it. Back up `dev.db` before schema changes.
