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

## Representation-independent evaluation boundary

The evolutionary model must not depend on the game's current internal board representation. The canonical game state remains authoritative, but the trainer and the engine's evaluation model should consume a stable, semantic feature interface rather than reading matrix cells, bitboards, or other storage details directly.

- Define evaluation features in terms of game meaning (for example, material balance, piece activity, mobility, king safety, or variant-specific positional concepts), not in terms of how pieces are stored or indexed.
- Keep feature extraction behind a narrow adapter owned by the engine/game integration. The evolutionary algorithm operates on feature values and bounded weights; it does not inspect or mutate the underlying board representation.
- Treat the current 10×8 matrix as the initial adapter source. A future bitboard implementation may accelerate feature extraction internally, but must produce the same feature semantics and compatible values for equivalent positions.
- Keep variant-specific features explicit and versioned. Do not assume that a feature is meaningful or supported for every future board geometry or variant; validate compatibility rather than silently substituting or omitting it.
- Version the feature schema separately from the exported parameter-package schema. A change to feature meaning, scale, normalization, or availability requires an explicit compatibility decision; old weights must not be silently applied to semantically changed features.
- Add equivalence tests before changing the representation used by feature extraction: equivalent positions represented through different internal encodings must yield equivalent feature vectors within explicitly defined numeric tolerances.

This boundary allows bitboards or another internal representation to be introduced independently, without making the evolutionary algorithm, training history, or parameter packages depend on that implementation choice. It does not authorize or require bitboard implementation.


## Initial evolutionary model specification

This is the proposed v1 model for review before trainer implementation. Numerical defaults below are deliberately small starting values, not measured optima or strength claims. Keep the model fixed during an experiment; do not evolve search settings and evaluation weights at the same time.

### Evaluation feature schema v1

- **Identity:** variant `jester-moat` v1, feature schema version `1`. The feature schema is versioned independently of the exported parameter-package schema.
- **Perspective:** every feature is a signed White-minus-Black advantage. Positive values favour White; negative values favour Black.
- **Range:** each feature is normalized and clamped to `[-1, 1]`. The adapter owns the normalization; the evolutionary algorithm sees only named semantic values.
- **Evaluation:** `score(position) = Σ(weight[i] × feature[i])`. Terminal wins, losses, checkmate, stalemate, and draws are resolved by game/search rules, not learned as ordinary features.

| Feature ID | Meaning and v1 extraction | Normalization |
| --- | --- | --- |
| `material.pawn` | Difference in pawn count | Divide each side's count by the initial count of 10, subtract Black from White, clamp |
| `material.knight` | Difference in knight count | Initial count 2 per side |
| `material.bishop` | Difference in bishop count | Initial count 2 per side |
| `material.rook` | Difference in rook count | Initial count 2 per side |
| `material.queen` | Difference in queen count | Initial count 1 per side |
| `material.jester` | Difference in Jester count | Initial count 2 per side |
| `activity.mobility` | Difference in total legal move count for each side; includes special legal moves such as castling and Jester swaps | Cap each side at 40 legal moves, divide by 40, subtract |
| `activity.central` | Difference in non-pawn piece count occupying the central 4×4 area of the current 10×8 variant | Cap each side at 16, divide by 16, subtract |
| `activity.jester` | Difference in legal moves originating from each side's Jester, including legal Jester swaps | Cap each side at 24, divide by 24, subtract |
| `safety.king-in-check` | Whether each side's king is currently in check; a checked king is less safe | `Black-in-check − White-in-check` |

The central area and the numeric caps are part of this variant-specific feature definition, not board indices exposed to the model. Validate the caps against legal positions before implementing extraction. If a cap or feature meaning changes, increment the feature schema version or provide an explicit migration; do not silently reinterpret existing weights.

Moats, castling rights as a standalone feature, pawn structure, and positional interactions are **not** separate v1 features. Moats still affect legal moves and attacks through the canonical rules used by the adapter. A moat's ownership alone is not a reliable measure of its strategic value, so do not add a direct moat bonus without a defined semantic measure and tests. Castling, en passant, promotion, moved-state, and moat effects can already influence legal mobility and king safety. Additional features require evidence and a new reviewed schema decision.

The adapter must use canonical state/rule helpers for legal moves, attacks, and check status. It must not implement a second rules engine. Feature extraction must be read-only from the caller's perspective and must not leave turn, board, moat, or history state mutated.

### Candidate and parameter representation

A candidate is a stable ID plus one weight for each feature ID above, in a fixed schema-defined order.

- Each weight is finite and bounded to `[0, 1]`.
- The weights are normalized to sum to `1`; a zero-sum or malformed vector is invalid.
- There is no bias term, no per-colour weight set, and no phase-specific weight set in v1. The feature vector itself is colour-relative; the same weights evaluate either side.
- Search algorithm, search depth/budget, and engine configuration are held constant across candidates in a run. They are not genes.
- Initialize one equal-weight candidate as a simple reference and the remaining candidates with seeded random non-negative weights normalized to sum to one. Record the initialization method and seed.
- Do not copy current MinMax constants into the genome unless a mathematically equivalent mapping to this feature schema is demonstrated. The existing MinMax evaluation is a comparison reference, not automatically a compatible candidate.

### Population and evolutionary operators

Initial bounded defaults for a first CLI experiment:

| Setting | Starting value | Rule |
| --- | ---: | --- |
| Population | 8 candidates | Fixed for the entire run |
| Elites | 2 | Copy the two highest-fitness candidates unchanged |
| Parent selection | Tournament of 3 | Select the highest fitness from three seeded random candidates |
| Mutation probability | 0.20 per weight | Apply independently to each weight |
| Mutation step | Up to ±0.10 | Perturb, clamp to bounds, then renormalize the vector |
| Crossover | Disabled | Keep v1 simple; reconsider only if mutation-only runs show a clear limitation |
| Generations | 8 | Hard upper bound for the default run; configurable within a documented small limit |

After elitism, fill the next generation with mutated copies of selected parents. If normalization or bounds cannot be satisfied, reject and regenerate that child using the run's seeded PRNG. Candidate IDs and tie-breaking order must be stable so identical inputs produce the same generation sequence.

These values are resource-conscious experiment defaults, not claims that eight candidates or generations are statistically sufficient. Keep all limits configurable and record the effective values.

### Fitness and match schedule

Use game results, not the candidate's own evaluation score, as fitness.

- Win = 1 point, draw = 0.5, loss = 0. The candidate's fitness is its mean score across the fixed fixtures; report the score against each opponent separately as well.
- Each candidate plays eight games per generation: four against MinMax Medium (`minmax-2`) and four against MCTS Medium (`mcts-2`). For each opponent, cover both supported opening layouts (`edges` and `center`) and both colours once. This balances opponent, layout, and colour without a full round robin.
- All candidates in the same generation use the same fixture definitions and base seeds (common random numbers) to reduce noise. Derive each game seed deterministically from the run seed, generation, opponent, layout, and colour.
- Keep opponent versions, settings, search budgets, runtime, and game rules fixed within a run. Prefer deterministic work limits where the engine supports them; if time budgets are required, record the runtime/device because fixed seeds do not make timed searches identical across machines.
- Use the canonical game terminal-state logic. A game still running at the fixed ply cap is a draw. An engine failure, invalid move, or protocol violation invalidates that candidate's evaluation and is recorded as an error; it is not silently scored as a draw.
- Do not use candidate-vs-candidate matches in v1. Fixed opponents make fitness easier to interpret and reduce generation-to-generation opponent drift.

At the end of a run, evaluate the best candidates on a separate holdout set of seeds not used for selection. The holdout result must not feed back into that run's selection. Include the same opponent and colour balance, and vary the opening layout/seed fixtures. Treat both training and holdout results as estimates with uncertainty, not definitive strength ratings.

The existing calibration runner is useful as a source of match-scheduling and reporting concepts, but it currently compares only the six shipped MinMax/MCTS presets. Do not assume it can evaluate evolutionary candidates or be reused unchanged. Inspect its harness and the candidate engine interface before deciding what can be shared.

### Reproducibility and stopping

- A run has a unique run ID, a recorded base seed, feature-schema version, parameter-schema version, population settings, mutation settings, opponent identities/configurations, fixture schedule, search limits, and game termination rules.
- Use a seeded PRNG for initialization, parent selection, mutation, fixture seeds, and any candidate search randomness that can be controlled.
- Re-running the same experiment configuration should reproduce the same candidate sequence and fixture schedule. Record any runtime-dependent search behavior that prevents bit-for-bit identical match outcomes.
- The default run stops after the configured generation limit. Do not add automatic convergence stopping in v1; small noisy samples can create false plateaus. A user may stop a run between games/generations, and restart behavior is specified in the CLI/persistence stage.
- Preserve the best candidate from each generation and the overall best candidate with its fitness breakdown. Final selection requires holdout review; do not export a candidate solely because it was last in the run.

### Model acceptance checks before trainer implementation

- Feature extraction has deterministic fixtures for material, mobility, central activity, Jester activity, and king-in-check semantics.
- Equivalent positions represented through different internal board encodings produce equivalent feature vectors within defined tolerances.
- Feature values stay within their declared ranges, and extraction does not mutate its input position.
- Candidate weights always remain finite, bounded, and normalized after initialization and mutation.
- Fitness is colour-balanced, layout-balanced, opponent-balanced, seed-recorded, and handles draws and failures explicitly.
- A small dry-run can reproduce its initialization, generation sequence, and fixture schedule from its recorded configuration.
- No feature weights or strength targets are declared optimal until controlled experiments and holdout results support that conclusion.

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
- The initial semantic evaluation features and parameter bounds, based on inspected game rules and existing evaluation code. Define their meaning, scale/normalization, applicability, and feature-schema version; do not expose matrix indices or bitboard layout as model inputs.
- The feature-extraction boundary between canonical game state and the evolutionary model, including how variant-specific features are declared and validated.
- The compatibility rule for future board-representation changes: equivalent positions must yield equivalent feature vectors, or require an explicit feature-schema/version migration before existing weights can be reused.
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

- **2026-11-09:** Added a representation-independent semantic feature boundary so future bitboard or other internal representation work can proceed without coupling evolutionary weights or training data to storage details.
