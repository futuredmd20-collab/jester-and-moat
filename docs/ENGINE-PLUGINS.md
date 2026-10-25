# ENGINE-PLUGINS.md — Plugin System for AI Engines

Purpose: holds the design draft, scope, plan, and progress log for the per-side, per-phase AI engine plugin system. It is a living design document, not finished specification; implementation details change here first.

## Idea
Today a single MinMax engine drives AI play. Goal: a plugin system where each side (White, Black) has its own set of engines, mapped to the three game phases — opening, midgame, endgame — plus configurable strength levels with score-like ratings.

## Plugin Interface
Each engine is a plugin object:

```
{ name, phases, strength, getMove(gameState) }
```

* `name`: display label (UI).
* `phases`: which phases the plugin can serve.
* `strength`: level parameter (search depth + moveselection temperature/randomness), labelled with an estimated rating.
* `getMove(gameState)`: returns the chosen move; same signature for all plugins.

The existing MinMax engine becomes plugin #1, unchanged in behavior.

## Phase Model
* Phases: opening, midgame, endgame.
* Detection by board state (material/piece count), not fixed move numbers — Jester & Moat's extra pieces (Jester, extra squares) require calibrated thresholds.
* A small `PhasePolicy` component decides, per move, which plugin to call for a side.

## Per-Side Configuration
* Each side holds an ordered engine pipeline.
* Modes supported:
  1. Single engine for all phases (simplest; current behavior).
  2. One engine per phase (specialized opening/midgame/endgame plugins).
  3. Weighted blending between plugins (future extension).

## Strength Levels
* Level = search depth + deliberate randomness temperature, not depth alone.
* Each side's configuration gets an approximate rating label (ELO-like), shown in UI, similar to player scores in classic games.


## Current Engine — Investigation Findings (script.js, v0.6.x)
* All engine code lives inline in script.js (~1657 lines): `evaluateBoard` (L541), `minimax` alpha-beta (L564), `getBestMove` (L613), `aiMove` (L710).
* Strength today = search depth only, keyed by mode: ai_easy 1, ai_medium/ai_vs_ai 2, ai_hard 3 (`aiMove` L716-719).
* No per-side engine identity: one global engine serves whichever side the AI plays; modes are pvp / ai_easy / ai_medium / ai_hard / ai_vs_ai.
* **Worker constraint:** `ensureAIWorker` (L663) builds the worker source via `fn.toString()` over an explicit `engineFunctions` list and runs `getBestMove(state, depth)` inside the worker. Any plugin engine must be a self-contained serializable function (or the worker message protocol must be extended to carry a plugin id + per-side config).
* `getJesterValue` (L521) already contains implicit phase logic: ply < 10 -> 4.0, pieceCount > 18 -> 5.5, else 3.5 — a natural seed for the PhasePolicy thresholds.
* Promotion sentinel: AI passes promoChoice 'pending'; applyRaw falls back to queen. Plugins must keep this contract.
* AI scheduling is spread across play()/setup()/side-switch handlers via `setTimeout(aiMove, getSpeed())`; the plugin system should replace the body of aiMove, not its call sites.

## Scope
In:
* Plugin interface, phase detection, per-side mapping, strength levels, UI labels.
Out (for now):
* Opening book, tablebase-driven endgame, neural engines, engine-vs-engine self-play tuning.

## Plan
1. Investigation: read current engine code, map call sites (this document, updated as findings land).
2. Design review: finalize interface and phase thresholds with the user.
3. Implementation step 1: plugin interface + MinMax wrapped as plugin.
4. Implementation step 2: PhasePolicy + per-side pipeline.
5. Implementation step 3: strength levels + UI rating labels.
6. Verification pass per step; PR per implementation step.

## Progress Log
* 2026-10-22: Draft created on branch engine-plugins-design from design discussion (interface, phases, per-side mapping, levels).
* 2026-10-23: Investigation of script.js complete; findings section added (worker toString constraint, depth-by-mode, getJesterValue phase seed, promotion sentinel).
* 2026-10-23: Drafted answers added for Q1 (ship with MinMax per side, MCTS opt-in) and Q2 (piece-count thresholds, constants provisional) — confirmed by the user. First plugin #2 (MCTS) merged to main via PR #16.
* 2026-10-24: Implementation step 3 done on branch engine-plugins-design — plugin interface + MinMax wrapped as plugin #1 (MinMaxLegacy) landed in script.js (ENGINE_PHASES, MinMaxLegacy, enginePlugins Map, defaultEngineForSide). Behaviour unchanged: MinMaxLegacy reads modeSelect and replicates aiMove's depth buckets, so AI play is identical until step 4 reroutes aiMove through the pipeline. The wrapper is inline in script.js (not in engines/) because it is an adapter around getBestMove() that must read modeSelect from the DOM to keep behaviour identical; engines/ is reserved for self-contained, worker-serializable engine implementations (MCTS, future engines) that take config from strength at construction time. Plugin #2 (MCTS) is not yet wired into enginePlugins or the worker — that is steps 4-5.
* Open questions (decided):
  * Q1: Default configuration per side when the system ships? Decision: both sides ship in single-engine mode with plugin #1 (MinMax) at the current mode depths — shipped behavior identical to today; MCTS selectable per side but default-off until its ratings are calibrated. Rationale: zero-risk rollout, every new option is opt-in.
  * Q2: Phase thresholds in material points or piece count? Decision: piece count (total pieces on board), seeded from getJesterValue's existing pieceCount logic; proposed opening = ply < 10 OR total >= 34, endgame = total <= 16, else midgame. Rationale: material points are circular here (the jester's own value is phase-dependent, and moats distort material), while piece count is cheap, capture-driven, and already computed in the hot path; calibrate the two constants from real games later.
