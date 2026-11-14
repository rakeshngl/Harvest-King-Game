# LLM plan — 14 Nov 2026

Where Harvest King can use an LLM without making it the referee. Engine logs stay English for goldens. Cosmetic RNG stays unseeded. The model never chooses a legal move.

Keys live in the **user** project (`USER_LLM_API_KEY`, `USER_LLM_BASE_URL`, `USER_LLM_MODEL`). They are not Agent environment variables. Copy `.env.example` and fill them on the Coolify box if you want polish; the game must still run with them unset.

## Top 3

### 1. Rival voice on trades (not started)

CPU still picks legal offers, accepts, and rejects from `src/ai.js` list-price arithmetic. An LLM only writes persona-flavoured lines: why Kaveri wants that Baghpat closer, why Malwa turns the deal down. UI chrome, not engine state.

### 2. Village gazette (this drop)

After each **season wrap**, show a 2–3 sentence village notice from weather, mandi, and who leads. Template first so play never waits on a model. Optional `POST /api/gazette` rewrites the same facts in EN/HI/TA when keys are set. Dispatch is **UI-only** — it is not appended to `state.log`.

### 3. Post-turn coach (not started)

Optional “why that harvest paid” / “why the auction was a trap” from the last landing. Advice only. Never the referee; never a hidden modifier.

## Gazette rules

- Trigger: `seasonIndex` ticks in `nextTurn` / an online snapshot. Skip rematch, first look, and match-over (win modal wins).
- Facts: season, weather, `marketMod`, two biggest price moves vs list, current leader net worth. Numbers come from the engine; the model may not invent them.
- Fallback: `gazetteTemplate` in `src/gazette.js`. Missing key, timeout, or bad reply → keep the template.
- Overlay like a landing pop-up (`#gazetteok`). Escape dismisses. CPU and roll wait while it is open, same as landing.
- Do not persist the dispatch. Do not log API keys.

## Do not do

LLM as harvest/auction/trade referee. Multi-replica. WebSockets. Mid-game seat late-join.
