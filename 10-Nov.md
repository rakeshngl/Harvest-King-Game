# Tasks — 10 Nov 2026

Grounded in `a57bf7b` after the 4 Nov sequence. Already shipped and not re-proposed: rooms + SSE, HMAC `hk-vid`, Hindi/Tamil board/diary, online CPU, mobile board, trade/auctions, raise/mortgage, round-based seasons, crop-scoped irrigation/insurance, hail/pest/labour copy, warehouse EV, AI tests, rematch-after-over, standings, PWA, tutorial, CI/ESLint, goldens.

Walk one item at a time. Commit and push each finished item to `origin/master`.

## Must-fix (fairness + honesty)

1. **Farmer/Market decks never reshuffle.** `drawCard` does `deck[kisanI % length]` (`src/engine.js`). After one pass the same order repeats, so long matches are predictable.
2. **Flood copy vs rules.** EN/HI/TA say orchards suffer (`src/data.js` `WEATHER.flood`, `src/names.js`). Engine is alluvial soil + `crop.water < 0.7` (`floodCut`).
3. **`state.doubles` is dead.** Set in `createGame`, zeroed in `nextTurn`, never read. Either drop it or give doubles an extra roll (Monopoly-style, cap 3).

## Suggested sequence (small → larger)

1. Reshuffle Farmer and Market decks when the draw index wraps. Keep engine log English. Goldens may change if seed-42 draws past one cycle — regen only if they fail. — done (`drawCard` reshuffles at wrap; diary “deck is shuffled.”).
2. Flood copy matches the engine: alluvial + thirsty crops, not orchards. EN/HI/TA together.
3. Drop `state.doubles` (no extra-turn rule today). If you later want doubles-as-extra-roll, that is a new item.
4. CI smoke beyond `GET /api/health`: after the server is up, `POST /api/create` and assert 200 + `code`. Lint/test/build already run.
5. Room passwords: salted hash (scrypt or pbkdf2), not unsalted SHA-256. Keep `passOk` compatible with empty (unlocked) rooms. CORS stays env `CORS_ORIGIN` (default `*` for local); document that production must set it — do not change the default here.
6. Soil besides hail+hill and flood+alluvial: black holds drought better, red/laterite dries faster, arid extra drought cut, hill extra hail. Display-only soils should move the needle a little, not a new board.
7. Season-weighted weather: monsoon more likely in kharif, hail more likely in rabi hills, drought in zaid. Still uses `WEATHER` ids.
8. Belt regroup: Vidarbha Cotton → `cotton`, Shimla Orchards → `hill` or `orchard`, Baghpat Cane → `gangetic`. Regen goldens if farm ownership snapshots shift.
9. Organic as a lasting counter (like `knowHow` / `enam`), not instant Rs 800. Card still targets Sikkim Organic / spice farms; harvest or net-worth reads the counter.
10. High-contrast / colour-blind palette. CSS tokens + a chrome toggle; keep the saffron/green/navy board as default.
11. Self-host Mukta / Cinzel / Tiro (or drop third-origin Google Fonts). SW already skips other origins, so PWA Hindi/Tamil fall back today.
12. Extra crops via existing tile `crops` lists: soybean, maize, onion, potato, chili, turmeric, coconut, rubber. One or two per belt, not a new map. Onion unblocks the old export-ban flavour.

## Later (fits current engine, lower urgency)

- Human tokens still written to `data/rooms.json` (CPU tokens already blanked). Needed today for process-restart resume. Real fix is cookie-only restore (`hk-seat`) and omit tokens from disk — do not blank them until resume still works.
- Labour shortage as a cash cost on extra labour in peak season (hire-or-skip already shipped).
- More Farmer/Market cards via existing `fn` keys.
- AI trade eval still list-price arithmetic.

## Later (needs accounts / new board)

OAuth, daily leaderboard, friends, Telugu/Marathi/Bengali, 5–6 players, extra maps, Redis replicas, itch.io, TypeScript.

## Do not do yet

Multi-replica, WebSockets, mid-game seat late-join. One Coolify replica + spectator/token resume already covers restarts if `data/` is a volume.

## Notes

- Goldens: `{ seed, seasons: 2, winNet: 999999, preset: 'short' }` at `test/fixtures/golden-*-42.json`. Sequence 1 and 8 are the ones most likely to force a regen.
- Sequence 5: never print password hashes or salts in logs.
- Sequence 11: bump `CACHE_VERSION` / `public/sw.js` `VERSION` together if the shell gains font files.
- Trade panel stays collapsed behind Make a Deal.
- Cosmetic RNG (dice spin, audio, room codes) stays unseeded; game RNG stays seeded.
