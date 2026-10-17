# Harvest King — Roadmap

Future development roadmap. Mirrors `public/roadmap.html`. Items marked **done** are shipped; the rest are open.

## Suggested sequence (highest-leverage path)

1. Persist rooms + reconnect — done (JSON store, seat tokens in localStorage)
2. Tests around harvest / insolvency / win — done (`npm test`)
3. Hindi and Tamil UI strings — done (chrome only; engine logs stay English)
4. CPU in online rooms — done (host seats computer farmers)
5. Mobile board layout — done (compact board, tabbed side, sticky roll dock)
6. Trading + auctions — done (end-phase offers, Village Hall auctions)
7. Match history + personal stats — done per device (visitor id + `/api/profile`)
8. Accounts / login — next (rooms now survive restarts)

## Ops (after Vercel + Coolify)

- Multiple replicas only if rooms are sticky or use a shared store — deferred, 1 replica only

## Multiplayer transport

- Action replay / late-join mid-game

Done: SSE transport, fast-forward missed dice + landing pop-ups, authoritative engine, create/join rate limits.

## Accounts and meta

- Optional login (Google / email magic link)
- Named farmer profiles, avatar and coin color unlocks
- Match history, personal stats (harvests, insolvencies, king wins) — done per device (visitor id, lobby "Your record" panel, `/api/profile`); real accounts still open
- Leaderboards: fastest king, highest net worth, season win rate
- Friends / recent players / rematch
- Daily challenge seed (same board RNG for everyone)

## Vs computer / AI

- More personas (co-op farmer, organic, exporter, contract farmer)
- Difficulty that also changes yield/price luck, not only miss chance
- AI explain panel (e.g. "leased Barmer because cash buffer")
- Puzzle mode: win in 3 seasons from this save
- Replay a recorded match vs the same AI seed

Done: online mixed tables (1 human + 1 to 3 CPUs).

## Core rules you could add

- Player-chosen mortgage / fire-sale (mortgage is automatic today)
- Crop contracts (forward sale at a fixed price)
- MSP vs open mandi vs export as a real choice, not only FCI landing
- Crop rotation bonus / monoculture fertility penalty
- Intercropping on large tiles
- Labour market: extra labour actions cost cash in peak season
- Farmer producer org / cooperative tile (pool harvest, share bonus)
- Climate event deck: El Nino year, heatwave, unseasonal rain as a season modifier
- Policy cards: loan waiver, fertilizer subsidy, export ban with real board effects
- Livestock / dairy as a side loop on a few tiles
- Water table: over-irrigation lowers future yield on canal/borewell belts
- Soil carbon / organic cert as a slow investment (card exists; make it a track)
- 5 to 6 players (needs more coins, more belts, or a bigger board)
- Shorter / longer match presets (12 / 18 / 24 seasons, different WIN_NET)
- Sandbox / tutor match with forced good monsoon

Done: player trading (land, cash, debt); auctions when someone declines to buy.

## Content

- More crops: soybean, maize, onion, potato, rubber, coconut, chili, turmeric
- More belts or a second map (South-only, Northeast, one-state district map)
- Alternate boards: compact 28-tile quick farm, or 52-tile all India
- Card expansions (more Farmer / Market cards) without engine rewrites
- Seasonal events tied to festivals already in market cards
- Real-ish regional crop lists per tile (already started)

## UX / presentation

- Telugu, Marathi, Bengali UI chrome (Hindi / Tamil done)
- Reduced-motion mode (dice 3D + token bob)
- Dark board / high-contrast / color-blind palettes
- PWA / Add to Home Screen
- Spectator-friendly big-board TV mode
- Tutorial overlay for the farming cycle
- Undo last local action (not online)
- Farm diary export / share image of the win screen
- Animated crop growth on owned tiles
- Map of India inset highlighting the tile's state

Done: English / Hindi / Tamil toggle; full mobile layout; sound effects with a mute toggle; seasonal music bed; Indian number formatting (lakh/crore shorthand).

## Economy / balance tools

- Admin or debug overlay: force season, weather, prices
- Data-driven balance file so crops/cards tune without code
- Telemetry: which crops win, which tiles are never bought
- Match length histogram; if games run too long, tune WIN_NET / grow times

## Tech debt that unlocks the rest

- Golden replay files: seed + actions to expected log
- Split `data.js` from `engine.js` so expansions are JSON
- TypeScript on engine + server
- OpenAPI for `/api/*`
- Docker Compose for local API + Vite
- CI: lint, test, build on push
- Replace in-memory Map with a room store interface (memory now, Redis later)

Done: automated engine tests.

## Distribution / product

- itch.io / standalone static + bring your own server
- School / NGO build: simplified rules, no loans, Hindi-first
- Print-and-play card/board export from the same TILES / CROPS data
- Spectator stream overlay (OBS browser source)
- Weekly tournament (Coolify cron + persisted bracket)
