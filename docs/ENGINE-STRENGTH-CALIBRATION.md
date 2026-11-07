# Engine Strength Calibration

Purpose: define the reproducible head-to-head method, command-line runner, and limits of relative MinMax/MCTS strength estimates. This document is methodology and usage, not a record of completed calibration results.

## Scope

The runner compares the six shipped presets:

- MinMax levels 1–3, using request depths 1/2/3 and the existing 3s/6s/10s search budgets.
- MCTS levels 1–3, using the existing 200/700/2000 playout presets, depth caps, temperatures, and 2.5s/5s/10s budgets.

It does not change engine presets, evaluation functions, search algorithms, UI labels, or default engine selection. It measures the current implementation; it does not tune it.

## Method

- Every game starts from one of two fixed 10×8 opening layouts already supported by the game: the standard Jester back rank or the centered-Jester back rank.
- The runner loads the canonical rule/search code from `script.js` and both engine modules in a Node VM. It calls the same protocol-v1 search entry points and game move application used by the app; it does not reimplement move legality.
- Moat placement after the fourth move by each side and moat redeployment use the game's existing AI placement routine. The seeded PRNG controls search randomness and moat placement.
- Each pair plays an even number of games with colours alternated. Starting layouts alternate between games. Each game receives a deterministic seed derived from the base seed and game index.
- Checkmate, stalemate, repetition, the 50-move rule, and insufficient material use the game's terminal-state logic. A game still running at the configured ply cap is scored as a draw.
- The runner records game result, termination, plies, per-engine search count, mean/median search time, and the fraction of searches reported as budget-limited.

A fixed seed makes random choices repeatable within the same runtime conditions. It does not make timed searches identical across devices: execution speed can change how many nodes/playouts fit inside a time budget, so results may differ between phones, desktops, and Node versions.

## Run

Requires Node.js (18 or newer recommended). No dependencies or network access are needed.

```sh
node --test tests/*.test.js
node scripts/engine-strength-calibration.js --self-test
node scripts/engine-strength-calibration.js --pair minmax-2,mcts-2 --games-per-pair 4 --budget-scale 1
node scripts/engine-strength-calibration.js --games-per-pair 20 --seed 20261106 --json
```

See [Engine Testing Workflow](ENGINE-TESTING-WORKFLOW.md) for when to use contract tests, reduced comparisons, and the full on-demand tournament.

The default tournament runs all 15 pairings among the six profiles, with two colour-balanced games per pair. Increase `--games-per-pair` for more evidence; 20 games per pairing is the configured full-run sample, not a guarantee of statistical power.

Options:

| Option | Default | Meaning |
| --- | ---: | --- |
| `--pair ID,ID` | all pairs | Run one matchup, e.g. `minmax-2,mcts-2`. |
| `--games-per-pair N` | 2 | Even game count per matchup; colours alternate. |
| `--max-plies N` | 120 | Adjudicate a game still in progress as a draw. |
| `--seed N` | 20261106 | Base deterministic PRNG seed. |
| `--budget-scale N` | 1 | Multiply all existing per-level time budgets by this factor. |
| `--json` | off | Emit the complete results as JSON. |
| `--self-test` | off | Run a short two-ply MinMax/MCTS smoke game. |

Use full budgets (`--budget-scale 1`) when comparing results with the full-run baseline. A reduced scale is useful only for checking the runner; do not compare its ratings with full-budget results.

## Reading the results

Each matchup reports wins-draws-losses from the first profile's perspective, score percentage, and the pairwise Elo difference:

`400 × log10(score / (1 − score))`

A 50% score corresponds to 0 Elo difference; positive values favour profile A. The approximate 95% interval is calculated from a Wilson score interval and transformed to Elo. Draws contribute half a point. Because this is a compact approximation for fractional scores—not a full Bradley–Terry model—the interval should be treated as indicative, especially with small samples.

These are relative, matchup-specific estimates, not official or independently calibrated Elo ratings. Reduced samples and selected matchups provide directional evidence only. They cannot establish that untested pairings behave the same way. Do not convert the results into UI labels or claim a universal rating without a larger, representative tournament and a documented statistical model. Compare only runs with the same budgets, start layouts, ply cap, and runtime environment.

## Recorded calibration context

A previous run covering all 15 pairings with 20 games per pairing was completed, and adjustments were made based on its results (user-confirmed on 2026-11-07). The detailed raw output and individual decisions are not recorded in this document.

The separate 15-job CI matrix added in PR #133 was cancelled during merge. Its cancelled jobs produced no results and must not be confused with the earlier completed run.

Future full tournaments are optional follow-up measurements. They are not a prerequisite for ordinary engine development and should be run manually when requested.

## Current status

The runner and methodology are available. The earlier 15-pair × 20-game run is user-confirmed; PR #133's later CI matrix run was cancelled. No new full tournament is implied by this document change.

## Progress log

- **2026-11-06:** Added `scripts/engine-strength-calibration.js` and this methodology. The runner's initial verification used a smoke test; raw output from the earlier full tournament is not preserved here.
