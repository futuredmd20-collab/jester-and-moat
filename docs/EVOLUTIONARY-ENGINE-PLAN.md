# Evolutionary Engine Plan

Purpose: plan a small, independently trainable evolutionary engine and its offline CLI training workflow. This document defines intended investigation and staged work; it is not an implementation specification or evidence that the engine or trainer exists.

## Status

**Status: Planned.** The user selected an evolutionary engine as the next engine direction. Initial training is offline and separate from normal PWA gameplay. No engine or training implementation is included in this plan approval.

## Goal

Add a third engine whose evaluation parameters are improved through evolutionary competition, while keeping the first implementation modest enough to develop and run on a Mac mini M1.

The first useful result should be a versioned parameter package that the game can load. Training infrastructure and historical data must not become runtime dependencies of the offline PWA.

## Agreed direction

- The third engine is evolutionary: candidate evaluation parameters are evolved by playing automated matches and comparing outcomes.
- Start with evolution of a bounded set of evaluation weights. Do not start with neural networks, evolved complete programs, or a general machine-learning framework.
- Initial training is offline in a separate Node.js CLI environment. Normal gameplay consumes a prepared parameter package and does not run training.
- Keep the trainer separate from the engine runtime. The engine receives validated parameters; it does not need to know whether they were evolved offline, edited manually, or supplied by a future training source.
- Begin with small populations, limited generations, and short, controlled match batches. Scale only when measurements justify it.
- Training must be seedable and record enough run metadata to interpret and reproduce an experiment within the limits of runtime-dependent search timing.
- Training should be restartable: preserve progress at generation boundaries and support resuming an interrupted run.
- Store training history and experiment output separately from the shipped game. JSONL is the initial lightweight candidate for append-only run history/results; define the checkpoint representation and safe-write behavior during design.
- Export selected results as small, versioned JSON parameter packages. Include schema version, engine identity/version, supported variant identity/version, profile identity where applicable, parameter values, and provenance needed to identify the training run.
- Keep the architecture open to future in-game evolution, but do not implement it in the first version. Do not make the runtime depend on offline-only assumptions that would prevent a later source of updated parameters.
- The Mac mini M1 is the intended first local training target. Keep CPU and memory use modest; do not assume a powerful GPU or dedicated accelerator.
- No cloud training, distributed workers, database server, or external runtime dependency is required for the first version.

## Relationship to existing architecture

- Integrate as an ordinary engine through the existing Engine Contract protocol v1 and static engine registry unless code inspection demonstrates a concrete contract gap.
- Declare supported variants and capabilities explicitly. The first target is the current `jester-moat` v1 variant; do not imply support for future board geometries.
- Respect the current schema-v2 engine configuration model. Engine-specific strengths, Advanced settings, and supported personalities remain engine-owned and must be declared and validated rather than assumed to match MinMax or MCTS.
- Treat evolutionary parameter weights as the engine's evaluation model, not automatically as the shared personality contract. Decide separately whether a trained parameter package represents the engine's baseline competence or a named personality. Do not overload `personalityId` with arbitrary weight data.
- Reuse the existing calibration runner only where inspection proves a component is suitable. Its current MinMax/MCTS comparison purpose does not make it an evolutionary trainer or guarantee that its harness can be reused unchanged.
- Preserve the game's canonical rules, legal-move validation, immutable search snapshots, cancellation, stale-result rejection, worker failure handling, and offline PWA deployment boundaries.

## Data and artifact boundaries

| Data | Purpose | Initial direction |
| --- | --- | --- |
| Candidate parameters | Current population and selected candidates | Compact structured data managed by the CLI |
| Run history/results | Generations, seeds, match outcomes, fitness summaries, and run metadata | JSONL candidate; append-only and stored outside the shipped app |
| Resume checkpoint | Enough state to continue an interrupted run | Format and atomic-write strategy to be specified before trainer implementation |
| Exported parameter package | Runtime input for the evolutionary engine | Versioned JSON; small and validated |
| Temporary match data | Positions and per-game details needed for diagnostics | Keep only what is useful; avoid retaining every full trace by default |

Training history and checkpoints must not be committed to the ordinary game repository by default. Decide a user-controlled local storage location and optional export/archive workflow during CLI design. Only selected, reviewed runtime parameter packages belong in the game source/release path.

## Staged work

### 1. Define the evolutionary model

Before implementing the engine, specify:
- The initial evaluation features and parameter bounds, based on inspected game rules and existing evaluation code.
- Candidate representation and initialization.
- Selection, mutation, optional crossover, elitism, and population replacement.
- Fitness calculation, match scheduling, colour balance, termination conditions, and handling of draws.
- How to avoid overfitting to one opening, colour, seed, or opponent.
- Whether training uses a fixed baseline opponent, candidate-vs-candidate matches, or a small mixture.
- What constitutes a useful minimum result and how it will be compared with MinMax/MCTS.

Do not select feature weights or claim a strength target without evidence. Keep the first model interpretable and small.

### 2. Specify the CLI and persistence contract

Inspect the current Node.js scripts, test conventions, game loading approach, and calibration runner before choosing code reuse or file layout.

Define:
- CLI commands and bounded run options.
- Seed handling and run identifiers.
- JSONL record structure and compatibility/version fields.
- Checkpoint structure, write safety, resume validation, and behavior after a partial/corrupt record.
- Output summaries and export validation.
- How to stop cleanly and resume without silently changing the experiment configuration.

The trainer must use the canonical game rules and move application rather than implementing a second rules engine.

### 3. Implement the offline trainer

Build a minimal CLI workflow with small default limits and no network requirement. Add focused tests for deterministic components, parameter bounds, match scoring, persistence, interrupted-run recovery, and export validation.

Do not make full tournaments or long training runs an automatic CI gate. Use short smoke runs for routine verification and reserve longer experiments for explicit execution.

### 4. Implement the runtime engine

Add the evolutionary engine through the existing engine contract. Load a validated, selected parameter package; enforce variant compatibility; provide bounded search and cancellation behavior appropriate to its algorithm; and test worker and main-thread paths.

The runtime engine must work without the trainer or training history being present.

### 5. Evaluate and package a first result

Run controlled, modest experiments on the intended hardware. Compare candidates against relevant baselines with balanced colours and varied starting positions/seeds. Record sample sizes and uncertainty; do not describe small samples as definitive strength ratings.

Export only a selected, reviewed parameter package. Keep raw training data outside the shipped PWA and ordinary source history.

### 6. Explore further profiles and future training modes

After the engine has a stable baseline:
- Evaluate whether additional named personalities are useful and how this engine should declare support for them.
- Determine whether multiple parameter packages should represent distinct built-in profiles or whether personality behavior should be applied as a separate engine-owned layer.
- Revisit in-game evolution as a separate design and approval step. It may require controlled persistence, user consent, reset/export behavior, and rules for preventing match results from silently changing a shipped baseline.

## Acceptance gates

- The engine can load and validate a versioned parameter package without access to the trainer or training data.
- Unsupported variants, malformed packages, incompatible schema versions, and invalid parameter values fail explicitly.
- The CLI uses canonical game rules and produces bounded, inspectable runs.
- A run records its effective configuration and seed; interrupted runs can resume from a validated checkpoint without silently mixing configurations.
- Training artifacts remain separate from PWA assets and normal runtime storage.
- Automated tests cover core evolutionary operations, scoring, persistence/recovery, package validation, engine contract behavior, and relevant worker lifecycle behavior.
- Any strength claims identify the exact opponents, sample size, seeds, runtime conditions, and limitations.
- Future in-game evolution remains possible by design, but is not required or implemented by this plan's first version.

## Explicit non-goals for the first version

- Neural networks or GPU-based training.
- Cloud, distributed, or always-on training.
- In-game learning or automatic mutation of the active shipped profile.
- User-created personality editor or a broad personality roster.
- A universal parameter schema shared by every engine.
- A database server or heavyweight training framework.
- Changes to board geometry, variant rules, or the canonical game-state representation.
- Replacing or rewriting MinMax/MCTS.
- Automatically running long training tournaments in CI.

## Related documents

- [Engine Extensibility Plan](ENGINE-EXTENSIBILITY-PLAN.md) — cross-engine, personality, variant, and board architecture.
- [Engine Plugins](ENGINE-PLUGINS.md) — current engine integration and verification record.
- [Engine Strength Calibration](ENGINE-STRENGTH-CALIBRATION.md) — existing MinMax/MCTS comparison runner and methodology.
- [Engine Testing Workflow](ENGINE-TESTING-WORKFLOW.md) — focused checks and optional full calibration policy.
- [Engine and Board Ideas](ENGINE-IDEAS.md) — exploratory ideas and future personality examples.

## Change log

- **2026-11-09:** Created the plan after the user selected an evolutionary third engine, offline CLI training, small initial runs, separate training data, JSON parameter exports, and future compatibility with in-game evolution.
