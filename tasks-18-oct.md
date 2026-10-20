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
