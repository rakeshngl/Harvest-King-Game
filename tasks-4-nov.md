# Tasks — 4 Nov 2026

Grounded in `6a946f1` after the 25 Oct sequence. Already shipped and not re-proposed: rooms + SSE, HMAC `hk-vid`, Hindi/Tamil board/diary, online CPU, mobile board, trade/auctions, raise/mortgage, round-based seasons, crop-scoped irrigation/insurance, standings/rematch, PWA, tutorial, CI/ESLint, goldens.

Walk one item at a time. Commit and push each finished item to `origin/master`.

## Must-fix (engine + fairness)

1. **Harvest double-applies `marketMod`.** Season tick already bakes it into `state.prices` (`src/engine.js` `advanceSeasonMaybe`); `harvest` multiplies again. Distorts FCI vs mandi. AI crop EV does the same (`src/ai.js`).
2. **Tax tiles say “X% or flat”; engine uses `Math.max`.** Copy in `src/data.js` / `src/names.js`; `resolveTile` at tax.
3. **FCI harvest is a stripped MSP dump.** Ignores weather, irrigation, insurance, pests, tractor/seed/yard/cold, `enam`, `knowHow`, belt, volatility; does not drop fertility. Warehouse modal has no EV.
4. **Idle irrigate/insure can outlive the crop.** `irrigate`/`insure` allow idle land; mortgage/lease-expiry only `clearCrop` when `stage !== 'idle'`. Next owner can inherit flags.

## Suggested sequence

1. Stop double `marketMod` in `harvest` (and AI EV). One-line fairness; regenerates goldens if seed-42 buy path harvests. — done
2. Tax copy vs `Math.max`: either honour the cheaper of pct/flat, or change EN/HI/TA text to “the greater of”. — done (copy matches `Math.max`; no tax-choice UI)
3. Sound off mutes music (`musicGain` currently bypasses `master` in `src/sound.js`). Keep the Music toggle; mute is a master bus. — done
4. Market panel lists all 18 crops (`src/hud.js` `slice(0, 12)`). — done
  5. Docs leftovers: README diary “last 12” (`DIARY_PAGE` is 20); `public/roadmap.html` intro still says in-memory rooms; `roadmap_25-Oct.md` Notes block lists shipped bugs. — done
  6. Escape closes landing / action / win / trade (today tutorial + inspect only). Lobby inputs get labels. — done (Escape also skippable action kinds; raise/auction/trade-offer stay).
  7. Preview `/api` proxy (`vite.config.js` `preview` has none). `start.mjs` forwards SIGTERM/SIGINT to both children. — done
  8. Seat tokens: EventSource / session restore should not put the token in the query string (header or cookie). Human tokens still land in `data/rooms.json`. — done (HttpOnly `hk-seat` + `X-Seat-Token`; query `token` ignored; `rooms.json` still stores human tokens).
9. Hail / pest / labour cards match their text: hail uses live prices (or wipes); pest goes through `forcePay` / insurance; labour is a choice, not auto-pay-or-haircut. Export-ban copy drops onion until the crop exists.
10. `awardLot` opens `farmWork` like buy/lease. Optional custom bid field.
11. Unify FCI with (or show EV against) open harvest in the warehouse modal. Decide: same modifiers minus volatility, or keep MSP-simple and print the numbers.
12. AI tests (`chooseAction` buy/skip/bid/offer) + HTTP rematch success after `phase === 'over'`.

## Later (fits current engine)

- Decks reshuffle when an index wraps.
- Drop or use `state.doubles`.
- Soil types besides hail+hill and flood+alluvial.
- Season-weighted weather (monsoon in kharif, hail in rabi hills).
- Regroup belts (Vidarbha is `oil`, Shimla is wheat, Baghpat Cane is cotton).
- Crops: soybean, maize, onion, potato, chili, turmeric, coconut, rubber.
- More Farmer/Market cards via existing `fn` keys.
- Labour shortage as a cash cost on extra labour in peak season.
- Organic / know-how as lasting counters (organic is still one-shot cash; knowHow is already a 2-turn counter).
- Flood weather text vs rules (copy says orchards; engine is alluvial + low water).
- High-contrast / colour-blind palettes.
- Google Fonts offline (SW skips other origins) or self-host Mukta/Cinzel/Tiro.
- Unsalted SHA-256 room passwords; CORS default `*`.
- CI smoke beyond `GET /api/health`.

## Later (needs accounts / new board)

OAuth, daily leaderboard, friends, Telugu/Marathi/Bengali, 5–6 players, extra maps, Redis replicas, itch.io, TypeScript.

## Do not do yet

Multi-replica, WebSockets, mid-game seat late-join. One Coolify replica + spectator/token resume already covers restarts if `data/` is a volume.

## Notes from the 4 Nov audit

### Economy / farming

- FCI vs mandi is not a real choice until modifiers or an EV line exist.
- Tax “or” is a lie.
- Cards (hail, pest, labour, onion ban, organic) still disagree with their text.
- Irrigation on idle land is a leftover snowball after sequence 12.

### Ops

- Seat tokens in SSE/session query and `rooms.json` (CPU tokens already blanked; spectators still stored).
- `start.mjs` does not forward SIGTERM. `vite preview` has no `/api` proxy.

### UX / a11y

- Sound off is SFX-only. Music has its own toggle but rides a separate gain node.
- Escape and lobby labels are incomplete. No high-contrast palette.
- Trade panel stays collapsed behind Make a Deal (intentional; do not “fix”).

### Tests

- 81 passing; no `test/ai.test.js`.
- HTTP rematch never asserts the success path after `phase === 'over'`.
- Goldens assert `seasonIndex` on skip-42; buy-42 does not.
