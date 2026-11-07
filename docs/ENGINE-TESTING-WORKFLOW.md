# Engine Testing Workflow

Purpose: define the practical test strategy for ongoing MinMax/MCTS development, including quick feedback, reduced comparisons, and optional full calibration.

## Objective

Optimise the time from an engine change to useful feedback. During active development, tests should provide enough evidence to decide the next step without requiring a complete strength tournament after every change.

The accepted trade-off is that reduced testing carries more uncertainty. It is intended to identify obvious regressions and directional changes, not to certify overall engine strength or quality.

## Test levels

| Level | What to run | When | What it can establish |
| --- | --- | --- | --- |
| 1. Contract / smoke checks | Relevant automated tests, plus the calibration runner's `--self-test` when useful. | After changes to affected engine contracts, dispatch, game rules, or worker paths. | Basic correctness, protocol compatibility, legal-move behavior, and obvious runtime failures covered by the tests. |
| 2. Reduced comparison | A selected subset of relevant engine pairings, with a small even number of games per pairing and balanced colours. | When a change may affect strength, search behaviour, or relative performance. | A quick directional signal and obvious regressions in the matchups tested. Results carry accepted uncertainty. |
| 3. Full calibration | All 15 pairings, 20 games per pairing, full configured budgets. | Only when the user explicitly requests a full measurement, for example as an overnight run. | A broader comparison of the six presets under the documented tournament conditions. It still does not establish universal or official Elo ratings. |

Level 1 contract tests remain automatic in the GitHub Actions workflow for relevant pushes and pull requests. The full calibration matrix is manual-only and starts through the workflow's `workflow_dispatch` action. It is not an automatic PR gate.

## Reduced comparison guidance

- Select pairings that are relevant to the changed engine, preset, or suspected interaction. Do not run every pairing by default.
- Start with a small even sample, for example 4 games per selected pairing (two games per colour). Increase it only when the result is ambiguous or the decision warrants more confidence.
- Keep the configured time budgets at full scale (`--budget-scale 1`) when comparing with previous full-budget measurements. Reduce the number of pairings and/or games to save time; do not silently change the budget and compare the resulting estimates as if they were equivalent.
- Keep the same seed, opening-layout rotation, ply cap, budget scale, and runtime environment when making a before/after comparison where practical.
- Run the same selected pairings before and after a material change when a baseline is available.
- Record which pairings and game count were run. Label the result as reduced and directional; do not imply that untested combinations were verified.
- If a reduced result is surprising, inconsistent, or close to the decision threshold, expand the sample or defer the question to a full run on request.

Example focused run:

```sh
node scripts/engine-strength-calibration.js --pair minmax-2,mcts-2 --games-per-pair 4 --budget-scale 1 --seed 20261106 --json
```

Choose the pair and seed to suit the change. The example is illustrative, not a mandatory fixed test.

## Full calibration on request

The full run is separate from ordinary development work. It does not need to be part of a specific engine plan, PR, or feature checklist.

When requested, manually dispatch the **Engine contract tests** GitHub Actions workflow. The contract-test job and all 15 full-budget calibration jobs run; each pairing plays 20 games with colour balance. Review the completed job logs and preserve the results if they are to inform future preset or rating decisions.

A cancelled, skipped, or incomplete matrix is not a completed calibration. Do not infer results from the number of jobs created or from a workflow starting.

## Reporting rules for agents

- State exactly which level was run and which pairings/sample counts were included.
- Separate automated contract-test results from comparative game results.
- Distinguish observed facts from directional interpretation and statistical uncertainty.
- Never describe a reduced subset as a full calibration or extrapolate its result as proof about untested pairings.
- Do not block ordinary engine iteration on a full tournament unless the user explicitly makes it a requirement for that task.
- Do not launch a full tournament automatically. It requires an explicit user request.
- Keep full-run results and decisions separate from the methodology document; update the recorded results only when actual output is available and the user wants it preserved.
