# Harvest King

A web-based, multiplayer Monopoly-style board game built around the Indian agriculture cycle. Two to four players buy or lease farmland across the country, prepare and sow fields, fight weather and pests, sell to the market, and race to become the **Harvest King**.

The game keeps the familiar rhythm of a property-trading board game but replaces buying houses with a full farming loop: **acquire land -> prepare soil -> sow seed -> grow -> harvest -> sell**. Success depends on crop choice, season timing, irrigation, insurance, and luck.

There is no jail. Instead, the board is loaded with agricultural complications: auction yards, canals, cold storage, government procurement, rural bank loans, farmer fate cards, market price swings, and seasonal weather.

## Highlights

- **Online multiplayer rooms** with a 4-letter join code (2 to 4 players), synced through a lightweight long-poll REST API. Online rooms are human-only.
- **Local pass-and-play** on a single device, plus **vs computer** with scripted heuristic rivals.
- **Three-dimensional animated dice** rendered with CSS 3D transforms.
- **Player tokens as bouncing letter coins**, colored per farmer, with a turn bob animation.
- **Monopoly-style board**: short labels, color belts, and solid fills on specials (cards, tax, market, corners).
- **Icon-driven tiles**: every square carries an SVG icon (millet, cotton, paddy, tractor, canal, godown, bank, and more).
- **Landing pop-up**: when a player lands on a tile, a styled modal shows the tile, its icon, every event it triggered, and the net cash change.
- **Color-coded farm diary**: gains render green, losses red, with distinct accents for dice rolls, cards, seasons, and crop milestones.
- **Living economy**: crop prices drift each season, cards shift the market, and infrastructure investments improve your yields and margins.
- **Deterministic rules engine** shared by local and online play, so the same game logic runs everywhere.

## Board

The board has **40 tiles** in the classic perimeter layout. Tile 0 is the Village Hall (the "GO" corner); passing it pays harvest dues, while landing on it opens a "labour day" where you may work one of your fields if you own any.

| Type | Count | Purpose |
| --- | --- | --- |
| Farm | 22 | Buy or lease land, then run the farming cycle |
| Infrastructure | 4 | Tractor Stand, Cold Storage, Seed Bank, Market Yard |
| Utility | 2 | Irrigation Canal, Borewell Grid (water rights) |
| Farmer Card | 3 | Fate-of-the-fields event cards |
| Market Prices | 3 | Market swing event cards |
| Tax | 2 | Land Revenue and Market Tax |
| Farm Fair | 1 | Bonuses and demonstration plot trials |
| Food Warehouse | 1 | Sell ripe harvest at support price |
| Rural Bank | 1 | Crop loans and repayment |
| Village Hall (start) | 1 | Pass-and-collect corner |

Farms are grouped into eight regional belts. Owning every farm in a belt roughly doubles the rent on those tiles and grants a **+15% yield bonus** on harvests in that belt.

| Group | Belt | Rent multiplier |
| --- | --- | --- |
| arid | Arid Belt | 1.00 |
| oil | Oilseed Belt | 1.10 |
| cotton | Cotton Belt | 1.15 |
| gangetic | Gangetic Plains | 1.20 |
| wheat | Wheat Belt | 1.30 |
| spice | Spice Coast | 1.40 |
| hill | Hill Gardens | 1.50 |
| orchard | Orchard Belt | 1.70 |

## The Farming Cycle

This is the heart of the game. Each farm tracks its own state machine:

```
idle -> prepared -> seeded -> ripe -> (harvest) -> idle
```

1. **Acquire** - Land on an unowned farm and either **buy** it outright or **lease** it for three circuits around the board. Leasing is cheaper but temporary.
2. **Prepare** - Pay the land preparation cost to move the field from `idle` to `prepared`. Preparation also nudges fertility up slightly.
3. **Sow** - Choose one of the crops the tile supports. Sowing out of the crop's natural season costs a **35% seed surcharge** and dents fertility. Sowing returns the farm to `idle` work state but sets the crop growing.
4. **Grow** - At the start of your turn, each of your seeded fields advances its growth counter. When it reaches zero the crop becomes `ripe`.
5. **Harvest** - Collect a yield and get paid. The engine computes yield from crop base yield, field fertility, weather, irrigation, knowledge, group ownership, and a volatility roll. Price comes from the current market. The log reports profit or loss against the seed and preparation cost basis.

You may also **tend** a growing crop to raise fertility, **irrigate** a field, or **insure** it against disaster. After your main action has resolved, you get one free "labour" farm action per turn (working one of your fields).

### Yield formula (harvest)

Roughly, yield is computed as:

```
yield = crop.yield
      * field.fertility
      * weather.mod
      * [1.2 if irrigated, else rainFit * droughtTolerance]
      * [1.12 if know-how active]
      * [1.15 if entire group owned]
      * [1.08 if owns Seed Bank]
      * [1.06 if owns Tractor Stand]
      * randomVolatility(crop.vol)
      -> disaster modifiers (hail, flood, pests, spoilage)
```

Revenue is `yield * currentPrice`, and profit/loss is revenue minus the seed and preparation cost basis.

### Weather

Every full circuit updates the season and rolls new weather. Weather scales both growth and water availability.

| Weather | Growth | Water | Notes |
| --- | --- | --- | --- |
| Fair Skies | 1.00 | 1.00 | Average growing weather |
| Good Monsoon | 1.25 | 1.30 | Water-loving crops thrive |
| Drought | 0.65 | 0.45 | Yields fall unless irrigated or drought-hardy |
| Flooding | 0.70 | 1.60 | Paddy mixed; alluvial lowlands and non-water crops suffer |
| Hail Belt | 0.75 | 1.00 | Hill and orchard crops take a beating |

### Seasons

Seasons cycle **Monsoon -> Winter -> Summer** (kharif, rabi, zaid). Each crop has a natural season and a water requirement. Off-season sowing is allowed but penalized. The match ends after **18 seasons**, at which point the highest net worth wins.

### Infrastructure and utilities

- **Tractor Stand (5)** - +6% harvest quantity.
- **Cold Storage (15)** - removes the 12% post-harvest spoilage chance.
- **Seed Bank (25)** - +8% harvest quantity.
- **Market Yard (35)** - +6% sale price.
- **Irrigation Canal (12)** / **Borewell Grid (28)** - reduces irrigation cost from Rs 900 to Rs 400.
- Infrastructure rent scales with how many infrastructure tiles the owner holds.
- Utilities charge rent as a multiple of the dice roll (x40 for one, x80 for both).

### Farmer Cards (18)

Fate cards include support payments, timely monsoon boosts, dry spells, fall armyworm, diesel hikes, seed subsidies, soil health cards, hailstorms, export quota and ban, canal rotation, cooperative dividends, insurance claims, farm school training, cold storage failure, organic certification, support price hikes, and labour shortage.

### Market Cards (12)

Market cards include festival demand, market glut, government procurement, middleman fees, warehouse receipts, highway strike, commodity spikes, unseasonal rain, online market listing, interest relief, urea shortage, and a cane fructose order.

### Loans and insolvency

The Rural Bank offers crop loans in **Rs 3,000 steps** up to a **Rs 9,000 cap**, at **12% interest** applied each season. Interest relief cards can cut debt.

When a player cannot pay, the engine automatically mortgages their idle fields at half price. If they still cannot pay, they go **insolvent**: all their land and infrastructure revert to the Village Hall, and the last farmer standing wins.

## Crops

Eighteen crops are modeled, each with a season, seed cost, grow time (in turns), base yield, base price, price volatility, drought tolerance, and water need.

| Crop | Season | Seed | Grow | Yield | Price |
| --- | --- | --- | --- | --- | --- |
| Pearl Millet | Monsoon | 400 | 1 | 18 | 55 |
| Sorghum | Monsoon | 450 | 1 | 20 | 52 |
| Groundnut | Monsoon | 800 | 1 | 16 | 90 |
| Cotton | Monsoon | 1200 | 2 | 14 | 140 |
| Sugarcane | Summer | 1600 | 2 | 28 | 48 |
| Paddy | Monsoon | 900 | 1 | 24 | 62 |
| Jute | Monsoon | 700 | 1 | 15 | 85 |
| Wheat | Winter | 1000 | 1 | 26 | 70 |
| Mustard | Winter | 650 | 1 | 12 | 110 |
| Apple | Winter | 2200 | 2 | 10 | 260 |
| Spices | Monsoon | 1800 | 2 | 8 | 340 |
| Coffee | Monsoon | 2000 | 2 | 9 | 300 |
| Tea | Monsoon | 2100 | 2 | 11 | 280 |
| Mango | Summer | 2400 | 2 | 12 | 250 |
| Grapes | Winter | 2300 | 2 | 13 | 240 |
| Cumin | Winter | 1400 | 1 | 7 | 380 |
| Saffron | Winter | 3200 | 2 | 4 | 900 |
| Mung Bean | Summer | 500 | 1 | 10 | 120 |

## Winning

A player wins immediately by reaching a **net worth of Rs 75,000**. Net worth counts cash minus debt, plus farm value, plus infrastructure and utility value, with bonuses for irrigated fields, insured fields, and fields holding a standing crop.

If no one reaches that threshold, the game ends after **18 seasons** and the richest living player is crowned Harvest King. Becoming the last solvent farmer also wins.

## Landing Pop-up and Farm Diary

Every dice roll in the UI is followed by a **landing pop-up** and a **farm diary** entry, so players always understand what just happened and why their cash changed.

### Landing pop-up

When a player lands on a tile, a modal appears showing:

- The player's coin color and name, in the form "Green lands on".
- The tile icon in a circular badge, plus the tile name and its region or description.
- The **full list of events** the landing triggered, in order (for example, a card drawn and then the payment it caused).
- A **net cash badge** for that landing: green with `+Rs ...` for a net gain, red with `-Rs ...` for a net loss, or a neutral "No cash change" when nothing moved.

The pop-up is dismissed with a **Continue** button. It is displayed before any follow-up action modal (such as buying land), so the player sees the outcome first and then chooses what to do.

### Color-coded diary

The **Farm diary** panel keeps the last 12 entries and colors each one by its outcome:

| Kind | Color | Meaning |
| --- | --- | --- |
| `gain` | Green | Money or value received (prizes, harvest revenue, subsidies, insurance) |
| `loss` | Red | Money paid out (tax, seed and preparation costs, rent, interest, damage) |
| `roll` | Navy | The dice roll and the tile reached |
| `card` | Saffron | A Farmer Card or Market Prices card drawn |
| `season` | Gold | A new season, its weather, and market drift |
| `grow` | Dark green | A crop reaching ripeness |
| `info` | Neutral | Everything else |

### Structured log entries

To support this, `src/engine.js` writes log entries as objects rather than plain strings:

```js
{ id: 42, kind: 'gain', text: 'Green receives Rs 677 — Farm Fair prize.', meta: { amount: 677, pid: 0 } }
```

- `id` is a monotonically increasing counter (`state.logId`) used by the client to detect new entries.
- `kind` drives the color and icon styling.
- `meta` carries machine-readable data (`amount`, `pid`, `tileId`, `dice`, `pnl`) used for the net-change badge and to group the events belonging to a single landing.

Because entries are created inside the shared rules engine, the pop-up and colored diary work identically in local pass-and-play, vs computer, and online play. In vs computer, a rival's landing pop-up waits for **Continue** before the computer acts. In online games every client sees the same landing announcement.

## Vs Computer

Local **vs computer** seats you as farmer 0 against one to three scripted rivals. Online rooms stay human-only.

Rivals are **heuristic farmers**, not an LLM. They use the same legal actions as a human (`roll`, buy/lease, prepare, sow, harvest, irrigate, insure, tend, warehouse, loans, extra labour, end turn). The engine remains the referee; `src/ai.js` only chooses among legal moves.

| Persona | Table name | Habit |
| --- | --- | --- |
| Thrifty | Malwa | Leases more than it buys, prefers millets and a cash buffer |
| Landlord | Kaveri | Buys land and hunts full regional belts |
| Gambler | Idukki | Chases spices, orchards, and market swings |
| Banker | Narmada | Buys canal and cold store, uses crop loans |

Difficulty (`easy` / `normal` / `hard`) changes the cash reserve the AI tries to keep, how often it misses a good move, and how often it takes a speculative crop. Easy rivals skip more; hard rivals almost never miss and keep a larger buffer.

The sidebar labels the current rival, shows a short status line for each computer action, and still presents the 3D dice plus landing pop-up so CPU turns stay visible.

## Tech Stack

- **Frontend**: vanilla ES modules, no framework. Custom CSS (checkerboard board, grid layout, 3D dice), inline SVG icons.
- **Backend**: Node.js built-in `http` server. No runtime dependencies.
- **Transport**: REST with HTTP long-polling for turn sync (20-second hold, resolved immediately on any state change).
- **Build tool**: Vite 5 for dev server and bundling.
- **State**: a single plain-JavaScript game object, cloned as JSON between client and server.

The only dependency is Vite (dev dependency). The server runs on the Node standard library alone.

## Project Structure

```
.
├── index.html          # Entry HTML, fonts, title
├── start.mjs           # Runs backend + frontend together
├── vite.config.js      # Dev server, allowedHosts, /api reverse proxy
├── package.json
├── server/
│   └── index.js        # Session rooms, REST API, action validation, long-poll
└── src/
    ├── main.js         # UI, lobby, board, vs computer loop, landing pop-up, diary, online sync
    ├── engine.js       # Game rules, farming cycle, cards, seasons, structured log, win logic
    ├── ai.js           # Heuristic farmer: personas, difficulty, chooseAction
    ├── data.js         # Tiles, crops, groups, cards, weather, constants
    ├── net.js          # Client fetch wrappers for the session API
    ├── dice.js         # CSS 3D dice rendering and animation
    ├── icons.js        # Inline SVG tile icons
    └── style.css       # Layout, board, special fills, coin tokens, sidebar, dice, modals
```

## Getting Started

Requires Node.js 18 or newer.

```bash
# Install dependencies
npm install
```

```bash
# Start backend (port 3001) and frontend (port 5173) together
npm run dev
```

Then open `http://localhost:5173`.

### Individual scripts

```bash
# Backend only
npm run server
```

```bash
# Frontend only
npm run frontend
```

```bash
# Production build
npm run build
```

```bash
# Preview the production build
npm run preview
```

## How to Play Online

1. One player opens the game and **creates a room**. A 4-letter code is generated.
2. Other players open the same URL, choose **join**, and enter the code.
3. The host starts the game once at least two farmers are seated. Up to four can join.
4. Players act in turn order. Only the player whose turn it is can roll and act; everyone else watches the shared state update in near real time.
5. Closing and reopening the tab keeps your seat via a token stored in `sessionStorage`.

### Local play

- **Pass-and-play**: 2 to 4 named farmers on one device; every seat is human.
- **Vs computer**: enter your name, pick 1 to 3 rivals and a difficulty, then **Play vs computer**. You always sit first.

## Architecture Notes

### Shared rules engine

`src/engine.js` is imported by both the browser UI and the Node server. Online play is authoritative on the server: the server owns the room state, validates every action, and broadcasts snapshots. This means an online client cannot invent moves, and the same rules apply to local play.

Vs computer never talks to the room API. `src/ai.js` calls the same move helpers the human UI uses (`applyMove`, `buyFarm`, `seedLand`, and so on). `createGame` stores `cpu` and `persona` on each player so the lobby and sidebar can label rivals.

### Long-poll sync

The client calls `GET /api/session?code=...&token=...&seq=N`. If the room sequence is newer than `N`, the server replies immediately; otherwise it holds the request for up to 20 seconds and resolves as soon as any player changes state. The client loops on this to stay in sync without WebSockets.

### Reverse proxy

The frontend dev server proxies `/api` to the backend at `http://localhost:3001`:

```js
// vite.config.js
server: {
  proxy: {
    '/api': { target: 'http://localhost:3001', changeOrigin: true, timeout: 30000 }
  }
}
```

This keeps a single exposed port for preview environments and avoids cross-origin issues in development.

## API Reference

Base URL: `/api` (proxied to port 3001).

| Method | Path | Body / Query | Description |
| --- | --- | --- | --- |
| GET | `/api/health` | - | Health check, returns `{ ok: true }` |
| POST | `/api/create` | `{ name }` | Create a room. Returns a snapshot plus your `token`. Seat 0 is host. |
| POST | `/api/join` | `{ code, name }` | Join an existing, unstarted room. Fails if full or already started. |
| POST | `/api/start` | `{ code, token }` | Host-only. Starts the game; requires at least 2 players. |
| POST | `/api/action` | `{ code, token, action }` | Submit a validated game action for the current turn. |
| GET | `/api/session` | `?code&token&seq` | Long-poll for the latest snapshot when `seq` changes. |

### Action types

The action endpoint accepts these `action.type` values, each validated against the current phase and pending state:

`roll`, `endTurn`, `skip`, `buy`, `lease`, `buyinfra`, `prepare`, `tend`, `harvest`, `irrigate`, `insure`, `unmortgage`, `fci`, `loan`, `repay`, `seed`, `work`.

## Game Constants

All defined in `src/data.js` and used by the engine:

| Constant | Value | Meaning |
| --- | --- | --- |
| `START_CASH` | 12000 | Starting cash per player |
| `PASS_GO` | 1500 | Payment for passing Village Hall |
| `WIN_NET` | 75000 | Net worth needed for an instant win |
| `MAX_SEASONS` | 18 | Season limit before net-worth tiebreak |
| `LOAN_STEP` | 3000 | Crop loan increment |
| `LOAN_CAP` | 9000 | Maximum outstanding debt |
| `INTEREST` | 0.12 | Per-season interest on debt |

## Design Palette

Player tokens still use the Indian flag palette from `src/data.js`. The board itself uses high-contrast fills so short labels stay readable: farms are white with a colored belt; specials are solid (GO orange, Fair green, Warehouse blue, Bank amber, Farmer Card magenta, Market teal, Tax red, infra slate, canal/well sky).

| Token | Hex | Use |
| --- | --- | --- |
| Saffron | `#FF9933` | Primary accent, player one |
| White | `#FFF8F0` | Backgrounds |
| Green | `#138808` | Secondary accent, player two |
| Navy | `#000080` | Text and structure, player three |
| Gold | `#C9A227` | Player four, ornamentation |
| Earth / Soil | `#5C3A1E` / `#8B5A2B` | Field tones |

## Notes and Limitations

- Room state lives in server memory only. Restarting the backend clears all active rooms.
- There is no authentication or persistence; tokens identify seats within a room.
- Designed for casual session play, not for high concurrency.
- All in-game text is in English. Internal tile ids (`kisan`, `mandi`, `nabard`) stay in code only.
- Vs computer is local-only in v1; online rooms do not host CPU seats.

## License

No license file is currently included. All rights reserved unless a license is added by the repository owner.
