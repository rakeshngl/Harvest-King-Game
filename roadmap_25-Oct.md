# Harvest King — Roadmap (25 Oct 2026)

Grounded in the tree at `e5fbb56`. Already shipped and not re-proposed: rooms + SSE, Hindi/Tamil chrome, online CPU, mobile board, trade/auctions, per-device record, daily seed, 12/18/24 presets, PWA, tutorial overlay, CI/ESLint.

## Must-fix (engine + server)

1. **`transfer` double-charges** after `forcePay` — rent/card cash vanishes (`src/engine.js`). — done
2. **FCI/loan not gated** to `pending.kind` — a modified client can dump grain or borrow on any action (`server/index.js`). — done
3. **`sellToFci` never `checkWin`** — warehouse cash can pass the crown silently. — done
4. **XSS** — farmer names/diary interpolated with no escape (`playerCard`, `openTablesHtml`, `diaryRow`). — done
5. **`readBody` unbounded**; **`x-forwarded-for` trusted**; CORS `*`; seat tokens in query + `rooms.json`. — body cap, `TRUST_PROXY`, `CORS_ORIGIN` done; seat tokens still in query + `rooms.json` (needs store work in sequence 3).

## Suggested sequence

1. Security + engine correctness (must-fix items 1–5). Small diffs, real fairness/exploit. — done except seat-token-at-rest (sequence 3).
2. Golden replays (`seed + actions → log/winner`) + HTTP tests for create/join/action/drain. — done
3. Cap `state.log`, debounce `saveRooms`, tmp+rename `saveStats`. Drop CPU tokens from disk. — done
4. Split `main.js` (~2244 lines, full `innerHTML` each render). — done (`chrome.js`, `board.js`, `lobby.js`, `hud.js`; `main.js` keeps session/bind/CPU).
  5. Reduced-motion, keyboard tiles, `:focus-visible`, Escape/focus-trap. — done
  6. Player-chosen mortgage / fire-sale (idle-only auto-mortgage feels random). — done
7. Board/diary i18n (chrome is done; tiles, crops, cards, logs still English). — done
8. Win standings + rematch (`finalStandings` already exists). — done
  9. AI: use unused `gamble`, let CPU `offer` trades, optional luck on hard. No AI tests today. — done
10. HMAC visitor cookie (not Google) so `/api/profile` is not spoofable — unblocks daily leaderboard. — done
11. Fix docs: README still says online rooms are human-only; `public/roadmap.html` still lists SSE/persist as open; `tasks-18-oct.md` still says `hk-shell-1`. — done
12. Season clock = rounds (today every GO advances the season — 4 farmers burn “18 seasons” in ~5 laps). Insurance/irrigation are permanent snowballs. — done

## Later (fits current engine)

- Crops: soybean, maize, onion, potato, chili, turmeric, coconut, rubber.
- More Farmer/Market cards via existing `fn` keys.
- Season-weighted weather (monsoon in kharif, hail in rabi hills). — done (10 Nov #7).
- Regroup belts (Vidarbha is `oil`, Shimla is wheat, Baghpat Cane is cotton). — done (10 Nov #8).
- FCI vs open-harvest EV in the warehouse modal. — done (same modifiers minus luck; MSP +10%; modal prints both).
- Auction: custom bid field; `awardLot` should open `farmWork`. — done (`#bidamt`; current-player farm win opens `farmWork`).
- Labour shortage as a cash cost on extra labour in peak season.
- Organic / know-how as lasting counters (like `enam`), not one-shot cash. — organic done (10 Nov #9).

## Later (needs accounts / new board)

OAuth, friends/rematch, Telugu/Marathi/Bengali, 5–6 players, extra maps, Redis replicas, itch.io, TypeScript.

## Do not do yet

Multi-replica, WebSockets, mid-game seat late-join. One Coolify replica + spectator/token resume already covers restarts if `data/` is a volume.

## Notes from the survey

### Economy / farming

- Mortgage is automatic, idle-only, not a player choice. Ripe land and infra never fire-sale. — done (player-chosen raise: mortgage farms or fire-sale infra/utility).
- FCI harvest ignores weather, irrigation, insurance, pests, tractor/seed/yard/cold, `enam`, `knowHow`, group bonus, volatility; does not reset fertility. — done (shared yield minus luck/pests/spoilage/eNAM/yard; fertility drops 0.08).
- Tax tiles say “X% or flat” but the engine uses `Math.max(flat, pct)`. — done (EN/HI/TA copy is “the greater of”).
- Insurance and irrigation are permanent once bought. — done (`clearCrop` on harvest/FCI/wipe/mortgage/lease expiry; idle/prepared land cannot irrigate or insure).
- Season clock ticks on every Village Hall pass, not per round. — done (full round via `nextTurn` wrap).
- Decks never reshuffle after the opening shuffle. — done (`drawCard` reshuffles Farmer/Market when the index wraps).
- `state.doubles` is dead. Soil types other than hail+hill and flood+alluvial do nothing. — doubles dropped (10 Nov #3); soils move drought/hail (10 Nov #6).
- Market panel shows only the first 12 of 18 crops. — done (prices pane lists all 18).

### Cards vs text

- Hail: pays expected value, crop stays. — done (50% of live listed yield; crop stays).
- Pest: wipes crops if cash is short; no mortgage/insolvency. — done (uninsured fee through `forcePay`; insurance covers the rest).
- Labour: auto-pays or applies 15% harvest haircut; no choice. — done (hire Rs 600 or skip next harvest bonus).
- Export ban mentions onion; onion crop does not exist. — done (spice panic copy; onion crop still later).
- Organic cert is an instant cash bonus, not a track.

### AI

- Never offers a trade (receive-only). `DIFF.gamble` unused. Difficulty is miss chance only. — done (CPU cash-for-land offers; `gamble` stretches buys/bids; hard `luck` 0.12).
- No AI tests. Trade eval is list-price arithmetic. — tests done (`test/ai.test.js` buy/skip/bid/offer); eval still list-price.

### Ops

- Visitor id is a client-chosen `localStorage` string; `GET /api/profile?visitor=` has no proof of possession. — done (HttpOnly HMAC `hk-vid`; query/body visitor ignored).
- Seat tokens in query strings (EventSource) and in `data/rooms.json`. — query done (`hk-seat` cookie / `X-Seat-Token`); human tokens still in `rooms.json`.
- Passwords are unsalted SHA-256. CORS `*`. — passwords done (scrypt salt); CORS still env `CORS_ORIGIN` (default `*`).
- `state.log` unbounded; every action `writeFileSync`s the whole room map. — done (`LOG_CAP` 200; debounce `saveRooms` 250ms + flush on drain).
- CI smoke only curls `/api/health`. `vite preview` has no `/api` proxy. — done (preview shares the `/api` proxy; CI also `POST /api/create`).
- `start.mjs` does not forward SIGTERM to the API child. — done (SIGTERM/SIGINT to both children).

### UX / a11y

- Almost no labels, no focus trap, no Escape, tiles are click-only `<div>`s. — done (labelled tile buttons, `:focus-visible`, modal Tab trap + `inert`; Escape closes tutorial/inspect/landing/win/trade-panel and skippable actions; lobby inputs labelled).
- No `prefers-reduced-motion`, no high-contrast / colour-blind palette. — reduced-motion done (dice skip spin); high-contrast chrome toggle done (10 Nov #10).
- Sound off does not mute music. — done (`musicGain` feeds `master`).
- Win modal shows only the king; Play again returns to lobby. — done (ranked standings; local rematch reseats; online host `POST /api/rematch`).
- Google Fonts are a third-origin fetch the service worker ignores. — done (10 Nov #11; self-hosted Mukta / Cinzel / Tiro).

### Docs drift

- README: “Online rooms stay human-only” is false; Vite proxy timeout and Node 18 are stale; project tree omits several `src/` modules. — done
- `public/roadmap.html` still lists persistence and SSE as open. — done
- `tasks-18-oct.md` still says `CACHE_VERSION` = `hk-shell-1` (code is `hk-shell-2`). — done (`hk-shell-4`).
