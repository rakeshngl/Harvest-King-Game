# Tasks — 18 Oct 2026

Backlog captured after shipping match history + personal stats (`22cadf5`).
Accounts/login stay deferred (needs OAuth or email credentials).

## 1. CI with ESLint (done)

- Added ESLint 9 flat config (`eslint.config.js`) + `globals` as dev dependencies.
- Scripts: `npm run lint` and `npm run lint:fix`.
- Fixed existing violations (dead `pay` helper, unused imports/vars).
- Added `.github/workflows/ci.yml`: Node 20 + 22, `npm ci`, lint, test, build, API health smoke check.
- Outcome: every push/PR is checked before Vercel/Coolify deploy.

## 2. Season presets (12 / 18 / 24)

- Move `MAX_SEASONS` and `WIN_NET` into per-game config (`createGame` options), stored on `state`.
- Use the configured values in season advance, `checkWin`, and `finishByNet`.
- Rebalance target net worth per length so 12 is punchy and 24 does not drag.
- Lobby selector for local and vs-CPU; host-only selector in online waiting rooms.
- Carry the preset through `/api/start` and snapshots; show length in the HUD.
- Tests for each preset boundary.

## 3. Daily seed

- Replace `Math.random` in `engine.js` (12 sites) plus `ai.js` and server with a seeded PRNG stored in `state`.
- Seed from `YYYY-MM-DD`, so board, weather, market and card order match for everyone.
- Add a "Daily challenge" lobby entry (local or vs CPU); tag results as `daily` in the profile record.
- Update tests to stub the PRNG instead of `Math.random`.
- Follow-on (separate): per-day leaderboard from profile data.

## 4. PWA

- `public/manifest.webmanifest` with maskable icons, theme colour, standalone display.
- Hand-written `public/sw.js` (no new dependency): precache shell, cache-first hashed assets, network-first `/api` with offline fallback.
- Register from `src/main.js` in the production build only, with a cache version string.
- Support offline lobby and local pass-and-play; online play still needs the network.

## Suggested order

1. CI with ESLint
2. Season presets
3. Daily seed
4. PWA

## Deferred

- Real accounts/login (Google / email magic link) — needs external credentials.
- Leaderboards, friends/rematch, tournaments.
