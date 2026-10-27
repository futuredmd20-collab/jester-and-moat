# ENGINE-PLUGINS.md — Plugin System for AI Engines

Purpose: records the engine-plugin design decisions, current implementation status, verification gaps, and remaining plan. It is a working status document, not proof that runtime behavior has been tested.

## Goal and design

Provide independently configurable AI engines for White and Black, with an engine choice that can be limited to a selected game phase. The initial rollout keeps MinMax as the default and makes MCTS opt-in.

### Plugin shape

The intended plugin contract is:

```
{ name, phases, strength, getMove(gameState) }
```

- `name`: display label.
- `phases`: phases supported by the engine.
- `strength`: engine-specific configuration; any ELO-like rating is an estimate until measured.
- `getMove(gameState)`: returns a move in the game's existing move format.

The current MinMax plugin is a legacy adapter around `getBestMove`, preserving the existing Easy/Medium/Hard depth mapping. MCTS is a separate implementation in `engines/mcts-engine.js`.

## Phase model and configuration

- Phases are opening, midgame, and endgame, selected by `getGamePhase()` in `script.js`.
- The current threshold policy is provisional. The design decision was to use ply and total piece count rather than material points: opening when ply < 10 or total pieces >= 34; endgame when total pieces <= 16; otherwise midgame. These constants still need validation against real games.
- White and Black each have engine and phase selectors in the Options UI.
- The current UI maps the chosen engine to the selected phase; the other phases fall back to MinMax. Configuration is written to `localStorage` under `engineConfig`; reload restoration and the actual UX should be verified.
- Weighted blending, opening books, tablebases, neural engines, and self-play tuning remain out of scope.

## Strength and ratings

- MinMax retains the legacy mode depths: Easy 1, Medium 2, Hard 3 (AI vs AI uses 2).
- MCTS has three provisional presets in `engines/mcts-engine.js`: 200 / 700 / 2000 playouts, caps of 10 / 14 / 18 plies, and temperatures of 0.35 / 0.15 / 0.00. Its labels (~800 / ~1200 / ~1600) are estimates, not calibrated ratings.
- The current engine selector exposes MCTS as “MCTS (~1200 ELO)”; the other MCTS levels are mapped from the game-mode difficulty. There is not yet evidence of a calibrated, independently configurable rating system for both engines.

## Implementation status (reconciled against main)

### Landed in the repository

- **PR #12** — plugin interface and MinMax legacy wrapper; engine registry/default selection groundwork.
- **PR #16** — standalone MCTS engine implementation.
- **PR #18** — plugin design and legacy MinMax adapter work.
- **PRs #20, #21, #22** — integration work for engine selection, per-side/per-phase UI, and engine configuration.
- **PR #23** — service-worker precache and version alignment.
- **PR #24** — fix for loading `engines/mcts-engine.js`.

Current files show `getGamePhase()`, an `enginePlugins` registry containing MinMax and MCTS when the module is available, per-side configuration, engine/phase selectors, MCTS script loading, and MCTS in the service-worker precache. The single-file builder now embeds the MCTS module before `script.js`. If MCTS fails to load on the multi-file page, startup logs a warning and keeps the board/MinMax path available; MCTS selection then falls back to MinMax until the module is restored. These source changes do not establish that every path works at runtime.

### Worker dispatch fix and verification status

The worker's `onmessage` handler now dispatches `workerFn: 'mctsGetMove'` to `mctsGetMove` and `workerFn: 'getBestMove'` (or an omitted legacy selector) to `getBestMove`. Unknown selectors return an explicit worker error rather than silently running the wrong engine. The main-thread fallback continues to call the selected plugin's `getMove`.

Static source review confirms both MCTS functions are serialized into the worker source and the message selector is now used. Browser/runtime execution has not been performed in this task, so actual worker execution, engine choice, and fallback behavior remain to be verified. The stale MCTS integration comments were updated to reflect the existing HTML and service-worker wiring.

## Revised remaining plan

1. **Verify worker dispatch at runtime:** source dispatch now honors the requested engine function and rejects unknown selectors; confirm MinMax and MCTS actually run through the worker and fallback in a browser.
2. **Verify configuration behavior:** test White and Black independently, selected-phase-only MCTS behavior, MinMax fallback in other phases, and whether choices survive reload. Fix persistence/initialization if needed.
3. **Verify phase classification:** exercise opening/midgame/endgame boundaries, including ply < 10, 34+ pieces, and 16 or fewer pieces. Keep thresholds provisional until reviewed against representative games.
4. **Calibrate strength labels:** measure repeatable results before presenting ELO-like numbers as anything beyond rough estimates. Ensure UI labels accurately describe the configured strength.
5. **Regression verification:** check promotions, swaps, moats, legal moves, no-legal-move/game-over handling, worker errors, and responsive performance. Record which checks were actually run; do not infer test completion from merged PRs.
6. **Update implementation history after each task:** record the fixing/verification PR and results in `docs/HISTORY.md` and keep this document's status current.

## Decisions already made

- **Default:** both sides default to MinMax for every phase, preserving existing behavior unless the user opts into MCTS.
- **Phase basis:** piece count plus the existing ply condition, not material score.
- **Thresholds:** opening = ply < 10 OR total pieces >= 34; endgame = total pieces <= 16; otherwise midgame. Provisional pending calibration.
- **Ratings:** MCTS estimates are provisional; do not describe them as calibrated ELO.

## Progress log

- **2026-10-22:** Initial design draft created on `engine-plugins-design`.
- **2026-10-23:** Engine investigation and initial decisions recorded; MCTS implementation merged via PR #16.
- **2026-10-24:** MinMax legacy adapter and registry groundwork landed.
- **2026-10-26:** PRs #20–#24 added per-side/per-phase controls and integration/loading fixes. Current code contains the registry, phase selector logic, MCTS loader, and precache entry. Follow-up audit identified the worker handler's unconditional MinMax call; the dispatch code fix is now on `fix/engine-worker-dispatch`, but browser/runtime verification and rating calibration are not recorded as complete.
