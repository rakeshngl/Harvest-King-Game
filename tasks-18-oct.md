# Tasks — 18 Oct 2026

Backlog captured after shipping match history + personal stats (`22cadf5`).
Accounts/login stay deferred (needs OAuth or email credentials).

## 1. CI with ESLint (done)

- Added ESLint 9 flat config (`eslint.config.js`) + `globals` as dev dependencies.
- Scripts: `npm run lint` and `npm run lint:fix`.
- Fixed existing violations (dead `pay` helper, unused imports/vars).
- Added `.github/workflows/ci.yml`: Node 20 + 22, `npm ci`, lint, test, build, API health smoke check.
- Outcome: every push/PR is checked before Vercel/Coolify deploy.

## 2. Season presets (12 / 18 / 24) (done)

- `createGame` stores `preset`, `maxSeasons` and `winNet` from `SEASON_PRESETS`.
- Short 12 / Rs 55k, classic 18 / Rs 75k, long 24 / Rs 1.05 lakh.
- Lobby selector for local, vs-CPU and new online rooms; host can change it in the waiting room (`POST /api/preset`).
- HUD season chip uses `state.maxSeasons`; public lobby lists the chosen length.
- Tests cover default, each preset, the 12-season cutoff and the short winNet.

## 3. Daily seed (done)

- Engine and CPU miss chance use mulberry32 stored on `state.rng`; dice, weather, markets, cards and harvest luck replay from a seed.
- Daily challenge seeds from the IST calendar date (`harvest-king:YYYY-MM-DD`).
- Lobby card starts a classic 1v1 vs Thrifty; HUD shows the date; results are tagged `DYYMMDD`.
- Tests stub `state._rng` instead of `Math.random`. Per-day leaderboard is still deferred.

## 4. PWA (done)

- `public/manifest.webmanifest` with maskable icons, theme colour, standalone display.
- Hand-written `public/sw.js` (no new dependency): precache shell, cache-first hashed assets, network-first `/api` with offline fallback.
- Register from `src/pwa.js` in the production build only (`CACHE_VERSION` = `hk-shell-1`).
- Offline banner on lobby, waiting room and board; pass-and-play and vs computer still work. Online rooms still need the network.

## Suggested order

1. CI with ESLint
2. Season presets
3. Daily seed
4. PWA

## Deferred

- Real accounts/login (Google / email magic link) — needs external credentials.
- Leaderboards, friends/rematch, tournaments.
