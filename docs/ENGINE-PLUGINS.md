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
| Worker dispatch | Contract tests exercise MinMax and MCTS through the generated worker, verify legal moves and unknown-selector errors, and verify that worker-construction and worker-runtime failures fall back to the selected plugin on the main thread. | Live-browser execution remains unverified. Runtime-error recovery terminates the failed worker and invalidates late responses before retrying the active request once. |
| Phase policy and ratings | Thresholds and provisional MCTS presets/labels are defined. | Validate phase boundaries against representative games; calibrate strength before presenting ELO-like values as measured ratings. |

## Decisions to preserve

- Default both sides to MinMax in every phase unless the user opts into MCTS.
- Classify phases using total piece count plus the existing ply condition, not material score.
- Keep thresholds provisional: opening = ply < 10 OR pieces >= 34; endgame = pieces <= 16; otherwise midgame.
- Treat MCTS ELO-like labels as estimates until repeatable calibration exists.
- Do not infer test completion from merged PRs. Record only checks actually performed.

## Remaining plan

1. **Runtime worker test:** automated contracts cover MinMax and MCTS dispatch, legal moves, unknown-selector errors, and fallback for worker-construction/runtime failures. Still verify both engines and recovery behavior in a real browser.
2. **Configuration test:** test White/Black independently, selected-phase-only MCTS, MinMax in other phases, and settings after reload. Fix initialization/persistence if needed.
3. **Phase test:** exercise opening/midgame/endgame boundaries, especially ply < 10, 34+ pieces, and 16 or fewer pieces.
4. **Strength calibration:** measure repeatable results and ensure UI labels match configured strength.
5. **Regression checks:** promotions, swaps, moats, legal moves, no-legal-move/game-over handling, worker errors, and responsive performance.
6. After each task, record the fix/verification PR and actual results in `docs/HISTORY.md`, then refresh this status document.

## Manual browser verification checklist

Run these checks against the multi-file app served from localhost or HTTPS. Keep the browser console and Network panel open and record observed results; automated VM tests are not a substitute.

1. **Normal engine dispatch:** start an AI game with MinMax, then select MCTS for one side and make several moves. Confirm both engines return legal moves, the board continues responding, and the console has no engine errors.
2. **Side and phase isolation:** set White to MCTS for midgame only and Black to MinMax. Confirm White uses MinMax in opening/endgame and MCTS in midgame. Repeat with Black configured for a different phase.
3. **Reload persistence:** set different engine/phase options for White and Black, reload, and confirm each side's choices are restored independently.
4. **MCTS load failure:** block `engines/mcts-engine.js` in DevTools Network request blocking, reload, and confirm startup warns while the board and MinMax remain usable. Confirm MCTS cannot run while its module is absent.
5. **Worker-construction fallback:** use a test server policy that blocks Blob workers, then confirm the chosen engine still makes a legal move via the main thread. Test MinMax and MCTS separately.
6. **Worker runtime error:** induce a worker runtime failure if practical and confirm the selected engine retries once on the main thread, the failed worker is terminated, and no stale worker response is applied.
7. **Offline/service worker:** after a successful online load, reload offline and confirm the app shell and MCTS asset are available from cache.

Do not mark these checks complete until they have actually been observed in a browser. The optional single-file build is outside this checklist unless a built artifact is already available or the user explicitly requests building it.

## Progress log

- **2026-10-22:** Initial design draft on `engine-plugins-design`.
- **2026-10-23:** Engine investigation and initial decisions; MCTS merged via PR #16.
- **2026-10-24:** MinMax adapter and registry groundwork landed.
- **2026-10-26:** PRs #20–#24 added per-side/per-phase controls and integration/loading fixes. Audit found unconditional MinMax worker dispatch; the fix was recorded on `fix/engine-worker-dispatch`. Browser/runtime verification and rating calibration remain unconfirmed.
