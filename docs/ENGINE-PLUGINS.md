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
* `strength`: level parameter (search depth + move-selection temperature/randomness), labelled with an estimated rating.
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
* Open questions:
  * Q1: Default configuration per side when the system ships?
  * Q2: Phase thresholds in material points or piece count?
