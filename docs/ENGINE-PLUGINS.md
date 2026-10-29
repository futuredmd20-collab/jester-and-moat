# Engine Plugins

Purpose: record design decisions, repository implementation, verification gaps, and remaining work. Source presence or a merged PR is not proof of runtime behavior.

## Goal and contract

Allow independently configured AI engines for White and Black, optionally limited to one game phase. MinMax remains the default; MCTS is opt-in.

```js
{ name, phases, strength, getMove(gameState) }
``

- `name`: display label; `phases`: supported phases; `strength`: engine-specific settings; `getMove(gameState)`: a move in the game's existing format.
- MinMax is a legacy adapter around `getBestMove`, preserving Easy/Medium/Hard depths 1/2/3 (AI vs AI uses 2). MCTS is implemented in `engines/mcts-engine.js`.
- White and Black have engine and phase selectors. The selected engine applies only in the selected phase; other phases fall back to MinMax. Settings are stored in `localStorage` under `engineConfig`; reload restoration and UX need runtime checks.
- Phase detection is `getGamePhase()` in `script.js`: opening if ply < 10 OR total pieces >= 34; endgame if total pieces <= 16; otherwise midgame. This policy is provisional and needs representative-game validation.
- MCTS presets (in `engines/mcts-engine.js`): 200/700/2000 playouts, depth caps 10/14/18 plies, temperatures 0.35/0.15/0.00. Labels around 800/1200/1600 are estimates, not calibrated ratings. The UI exposes “MCTS (~1200 ELO)”; other levels follow game-mode difficulty. No calibrated, independently configurable rating system is established.
- Out of scope: weighted blending, opening books, tablebases, neural engines, and self-play tuning.

## Implementation and verification status

| Area | Present in repository / source-reviewed | Still unverified or remaining |
| --- | --- | --- |
| Plugin setup | Registry/default-selection groundwork; MinMax adapter; MCTS module. PRs #12, #16, #18. | Confirm each engine is selected and returns moves correctly at runtime. |
| Side/phase UI | White/Black engine and phase selectors; phase-specific selection and MinMax fallback. PRs #20–#22. | Test both sides independently, all phases, fallback behavior, UX, and reload persistence. |
| Loading/build | MCTS script loading, service-worker precache and version alignment (PR #23); loading fix (PR #24); single-file builder embeds MCTS before `script.js`. | Exercise multi-file and built single-file pages. If MCTS fails to load on the multi-file page, startup warns and keeps board/MinMax available; MCTS selection falls back to MinMax. Confirm this recovery path in a browser. |
| Worker dispatch | Handler dispatches `mctsGetMove` to MCTS and `getBestMove` or omitted legacy selector to MinMax; unknown selectors return an explicit error. Static review confirms both functions are serialized and the selector is used. Main-thread fallback calls selected plugin's `getMove`. | Browser/runtime execution of worker dispatch and fallback has not been recorded as complete. |
| Phase policy and ratings | Thresholds and provisional MCTS presets/labels are defined. | Validate phase boundaries against representative games; calibrate strength before presenting ELO-like values as measured ratings. |

## Decisions to preserve

- Default both sides to MinMax in every phase unless the user opts into MCTS.
- Classify phases using total piece count plus the existing ply condition, not material score.
- Keep thresholds provisional: opening = ply < 10 OR pieces >= 34; endgame = pieces <= 16; otherwise midgame.
- Treat MCTS ELO-like labels as estimates until repeatable calibration exists.
- Do not infer test completion from merged PRs. Record only checks actually performed.

## Remaining plan

1. **Runtime worker test:** run MinMax and MCTS through the worker and main-thread fallback; check unknown-selector errors.
2. **Configuration test:** test White/Black independently, selected-phase-only MCTS, MinMax in other phases, and settings after reload. Fix initialization/persistence if needed.
3. **Phase test:** exercise opening/midgame/endgame boundaries, especially ply < 10, 34+ pieces, and 16 or fewer pieces.
4. **Strength calibration:** measure repeatable results and ensure UI labels match configured strength.
5. **Regression checks:** promotions, swaps, moats, legal moves, no-legal-move/game-over handling, worker errors, and responsive performance.
6. After each task, record the fix/verification PR and actual results in `docs/HISTORY.md`, then refresh this status document.

## Progress log

- **2026-10-22:** Initial design draft on `engine-plugins-design`.
- **2026-10-23:** Engine investigation and initial decisions; MCTS merged via PR #16.
- **2026-10-24:** MinMax adapter and registry groundwork landed.
- **2026-10-26:** PRs #20–#24 added per-side/per-phase controls and integration/loading fixes. Audit found unconditional MinMax worker dispatch; the fix was recorded on `fix/engine-worker-dispatch`. Browser/runtime verification and rating calibration remain unconfirmed.
