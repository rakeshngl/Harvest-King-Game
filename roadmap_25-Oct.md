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
3. Cap `state.log`, debounce `saveRooms`, tmp+rename `saveStats`. Drop CPU tokens from disk.
4. Split `main.js` (~2244 lines, full `innerHTML` each render).
5. Reduced-motion, keyboard tiles, `:focus-visible`, Escape/focus-trap.
6. Player-chosen mortgage / fire-sale (idle-only auto-mortgage feels random).
7. Board/diary i18n (chrome is done; tiles, crops, cards, logs still English).
8. Win standings + rematch (`finalStandings` already exists).
9. AI: use unused `gamble`, let CPU `offer` trades, optional luck on hard. No AI tests today.
10. HMAC visitor cookie (not Google) so `/api/profile` is not spoofable — unblocks daily leaderboard.
11. Fix docs: README still says online rooms are human-only; `public/roadmap.html` still lists SSE/persist as open; `tasks-18-oct.md` still says `hk-shell-1`.
12. Season clock = rounds (today every GO advances the season — 4 farmers burn “18 seasons” in ~5 laps). Insurance/irrigation are permanent snowballs.

## Later (fits current engine)

- Crops: soybean, maize, onion, potato, chili, turmeric, coconut, rubber.
- More Farmer/Market cards via existing `fn` keys.
- Season-weighted weather (monsoon in kharif, hail in rabi hills).
- Regroup belts (Vidarbha is `oil`, Shimla is wheat, Baghpat Cane is cotton).
- FCI vs open-harvest EV in the warehouse modal.
- Auction: custom bid field; `awardLot` should open `farmWork`.
- Labour shortage as a cash cost on extra labour in peak season.
- Organic / know-how as lasting counters (like `enam`), not one-shot cash.

## Later (needs accounts / new board)

OAuth, friends/rematch, Telugu/Marathi/Bengali, 5–6 players, extra maps, Redis replicas, itch.io, TypeScript.

## Do not do yet

Multi-replica, WebSockets, mid-game seat late-join. One Coolify replica + spectator/token resume already covers restarts if `data/` is a volume.

## Notes from the survey

### Economy / farming

- Mortgage is automatic, idle-only, not a player choice. Ripe land and infra never fire-sale.
- FCI harvest ignores weather, irrigation, insurance, pests, tractor/seed/yard/cold, `enam`, `knowHow`, group bonus, volatility; does not reset fertility.
- Tax tiles say “X% or flat” but the engine uses `Math.max(flat, pct)`.
- Insurance and irrigation are permanent once bought.
- Season clock ticks on every Village Hall pass, not per round.
- Decks never reshuffle after the opening shuffle.
- `state.doubles` is dead. Soil types other than hail+hill and flood+alluvial do nothing.
- Market panel shows only the first 12 of 18 crops.

### Cards vs text

- Hail: pays expected value, crop stays.
- Pest: wipes crops if cash is short; no mortgage/insolvency.
- Labour: auto-pays or applies 15% harvest haircut; no choice.
- Export ban mentions onion; onion crop does not exist.
- Organic cert is an instant cash bonus, not a track.

### AI

- Never offers a trade (receive-only). `DIFF.gamble` unused. Difficulty is miss chance only.
- No AI tests. Trade eval is list-price arithmetic.

### Ops

- Visitor id is a client-chosen `localStorage` string; `GET /api/profile?visitor=` has no proof of possession.
- Seat tokens in query strings (EventSource) and in `data/rooms.json`.
- Passwords are unsalted SHA-256. CORS `*`.
- `state.log` unbounded; every action `writeFileSync`s the whole room map.
- CI smoke only curls `/api/health`. `vite preview` has no `/api` proxy.
- `start.mjs` does not forward SIGTERM to the API child.

### UX / a11y

- Almost no labels, no focus trap, no Escape, tiles are click-only `<div>`s.
- No `prefers-reduced-motion`, no high-contrast / colour-blind palette.
- Sound off does not mute music.
- Win modal shows only the king; Play again returns to lobby.
- Google Fonts are a third-origin fetch the service worker ignores.

### Docs drift

- README: “Online rooms stay human-only” is false; Vite proxy timeout and Node 18 are stale; project tree omits several `src/` modules.
- `public/roadmap.html` still lists persistence and SSE as open.
- `tasks-18-oct.md` still says `CACHE_VERSION` = `hk-shell-1` (code is `hk-shell-2`).
