# Evolutionary Engine Plan

Purpose: plan a small, independently trainable evolutionary engine and its offline Node.js CLI, including initial GitHub Actions execution and later local training. This document defines intended investigation and staged work; it is not an implementation specification or evidence that the engine or trainer exists.

## Status

**Status: Planned.** The user selected an evolutionary engine as the next engine direction and approved the initial v1 model decisions recorded below. Initial training is offline and separate from normal PWA gameplay. No engine, trainer, or evolutionary-training workflow has been implemented or authorized by this plan update.

## Goal

Add a third engine whose evaluation parameters are improved through evolutionary competition. Start with small, controlled experiments on GitHub Actions; support local Node.js execution on the user's Mac mini M1 later. Keep the first implementation modest and measurable.

The first useful result should be a versioned parameter package that the game can load. Training infrastructure, historical data, and checkpoints must not become runtime dependencies of the offline PWA.

## Agreed direction

- The third engine is evolutionary: candidate evaluation parameters are evolved by playing automated matches and comparing outcomes.
- Start with evolution of a bounded set of evaluation weights. Do not start with neural networks, evolved complete programs, or a general machine-learning framework.
- The runtime search algorithm is a dedicated MinMax/Alpha-Beta implementation. Evolution optimizes its evaluation weights; it does not evolve the search algorithm, search depth, or search budget in v1.
- Initial training is offline in a separate Node.js CLI environment. Normal gameplay consumes a prepared parameter package and does not run training.
- The initial execution environment is a manually started GitHub Actions workflow, operable from the GitHub mobile interface. Start with small pilot runs and increase population/generation counts only after measuring actual runtime and resource use. Local Node.js execution on the Mac mini M1 is a later supported environment, not a prerequisite.
- Keep the trainer separate from the engine runtime. The engine receives validated parameters; it does not need to know whether they were evolved offline, edited manually, or supplied by a future training source.
- The first exported package represents baseline competence and uses the `Default` profile identity. Engine personality/style remains a separate later layer; do not encode personalities as separate weight genomes in v1.
- Training must be seedable and record enough run metadata to interpret and reproduce an experiment within the limits of runtime-dependent search timing.
- Use a selectable, seed-based PRNG in the training environment. When MCTS is used as a training opponent, make its randomness controllable through the training path without changing its normal default behavior.
- Training should be restartable: preserve progress at generation boundaries and support resuming an interrupted run from a validated checkpoint.
- Store training history, run metadata, and checkpoints outside the shipped game. Use GitHub Actions artifacts for initial run outputs/checkpoints; document artifact retention and how a prior artifact is supplied when resuming. Do not commit checkpoints or raw training history to the game repository by default.
- Export selected results as small, versioned JSON parameter packages. Include schema version, engine identity/version, supported variant identity/version, profile identity, parameter values, and provenance needed to identify the training run.
- Keep the architecture open to future in-game evolution, but do not implement it in the first version. Do not make the runtime depend on offline-only assumptions that would prevent a later source of updated parameters.
- GitHub Actions is the first execution environment, not a distributed training architecture. Keep CPU and memory use modest and make the trainer runnable locally with Node.js later; do not require a GPU, database server, external training service, or distributed workers.

## Relationship to existing architecture

- Integrate as an ordinary engine through the existing Engine Contract protocol v1 and static engine registry unless code inspection demonstrates a concrete contract gap.
- Use the dedicated MinMax/Alpha-Beta runtime search with bounded search, cancellation, and the existing engine lifecycle guarantees.
- Declare supported variants and capabilities explicitly. The first target is the current `jester-moat` v1 variant; do not imply support for future board geometries.
- Respect the current schema-v2 engine configuration model. Engine-specific strengths, Advanced settings, and supported personalities remain engine-owned and must be declared and validated rather than assumed to match MinMax or MCTS.
- Treat the `Default` parameter package as the evolutionary engine's baseline competence. Personality is a separate style layer to consider later; do not overload `personalityId` with arbitrary weight data.
- Reuse the existing calibration runner only where inspection proves a component is suitable. Its current MinMax/MCTS comparison purpose does not make it an evolutionary trainer or guarantee that its harness can be reused unchanged.
- Preserve the game's canonical rules, legal-move validation, immutable search snapshots, cancellation, stale-result rejection, worker failure handling, and offline PWA deployment boundaries.

## Representation-independent evaluation boundary

The evolutionary model must not depend on the game's current internal board representation. The canonical game state remains authoritative, but the trainer and the engine's evaluation model should consume a stable, semantic feature interface rather than reading matrix cells, bitboards, or other storage details directly.

- Define evaluation features in terms of game meaning (for example, material balance, piece activity, mobility, king safety, or variant-specific positional concepts), not in terms of how pieces are stored or indexed.
- Keep feature extraction in a standalone, pure module behind a narrow game-rules adapter. The adapter may call canonical game-state/rule helpers, but the feature module must not mutate the caller's position or leave turn, board, moat, or history state changed.
- The evolutionary algorithm operates only on named semantic feature values and bounded weights; it does not inspect or mutate the underlying board representation.
- Treat the current 10×8 matrix as the initial adapter source. A future bitboard implementation may accelerate feature extraction internally, but must produce the same feature semantics and compatible values for equivalent positions.
- Keep variant-specific features explicit and versioned. Do not assume that a feature is meaningful or supported for every future board geometry or variant; validate compatibility rather than silently substituting or omitting it.
- Version the feature schema separately from the exported parameter-package schema. The ten v1 feature definitions, meaning, scale, normalization, and availability are fixed for schema v1. A semantic or normalization change requires an explicit schema-version change and compatibility decision; old weights must not be silently applied to changed features.
- Measure each feature's computation cost separately before full-scale training. In particular, measure legal-move-based mobility and Jester activity; use the results to identify expensive extraction paths before increasing training budgets.
- Add equivalence tests before changing the representation used by feature extraction: equivalent positions represented through different internal encodings must yield equivalent feature vectors within explicitly defined numeric tolerances.

This boundary allows bitboards or another internal representation to be introduced independently, without making the evolutionary algorithm, training history, or parameter packages depend on that implementation choice. It does not authorize or require bitboard implementation.

## Initial evolutionary model specification

This is the approved v1 model direction for planning and design before trainer implementation. Numerical defaults below are deliberately small starting values, not measured optima or strength claims. Keep the model fixed during an experiment; do not evolve search settings and evaluation weights at the same time.

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
- Initialize one equal-weight candidate as the frozen primary reference for the run. Initialize the remaining candidates with seeded random non-negative weights normalized to sum to one. Record the initialization method and seed. The frozen reference is a separate control and is never mutated or selected as an evolving candidate. Stage 2 must make explicit whether the reported population count includes or excludes this control; do not leave that accounting implicit.
- Do not copy current MinMax constants into the genome unless a mathematically equivalent mapping to this feature schema is demonstrated. Existing MinMax Medium is a separate secondary comparison reference, not automatically a compatible candidate.

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

The first GitHub Actions pilot must use a smaller, explicitly recorded run budget where appropriate. The population and generation limits above remain the initial model defaults, not a requirement to run a full experiment before measuring cost. Keep all limits configurable within documented bounds and record the effective values. Each individual run keeps its configuration fixed.

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

At the end of a run, evaluate the best candidates on a separate holdout set of seeds not used for selection. The holdout result must not feed back into that run's selection. Include the same opponent and colour balance, and vary the opening layout/seed fixtures. Use two explicit references during validation:
1. **Primary reference:** the new MinMax/Alpha-Beta engine with the frozen equal-weight start parameters. This isolates the effect of evolution while keeping the search algorithm and settings the same.
2. **Secondary reference:** the existing MinMax Medium engine. This indicates whether the evolutionary engine is competitive with the current baseline implementation.

A candidate is eligible for export only if it demonstrates a statistically supported improvement over the primary frozen-weight reference on the independent holdout set. Define the statistical method, confidence level, and minimum practical improvement before the trainer implementation/first confirmatory run; do not choose them after inspecting holdout outcomes. Always report the secondary MinMax Medium comparison, but do not substitute it for the primary test of whether evolution improved the new engine. Treat all results as estimates with uncertainty, not definitive strength ratings.

The existing calibration runner is useful as a source of match-scheduling and reporting concepts, but it currently compares only the six shipped MinMax/MCTS presets. Do not assume it can evaluate evolutionary candidates or be reused unchanged. Inspect its harness and the candidate engine interface before deciding what can be shared.

### Reproducibility and stopping

- A run has a unique run ID and records its base seed, Git commit/code version, feature-schema version, parameter-package schema version, population and mutation settings, opponent identities/configurations, fixture schedule, search limits, game termination rules, runtime/runner environment, and start/end status.
- Use a seeded PRNG for initialization, parent selection, mutation, fixture seeds, and any candidate search randomness that can be controlled. Training-time MCTS randomness must be injectable/seedable without changing normal MCTS defaults.
- Re-running the same experiment configuration should reproduce the same candidate sequence and fixture schedule. Record any runtime-dependent search behavior that prevents bit-for-bit identical match outcomes.
- The default run stops after the configured generation limit. Do not add automatic convergence stopping in v1; small noisy samples can create false plateaus. A user may stop a run between games/generations, and restart behavior is specified in the CLI/persistence stage.
- Preserve the best candidate from each generation and the overall best candidate with its fitness breakdown. Final selection requires holdout review; do not export a candidate solely because it was last in the run.

### Model acceptance checks before trainer implementation

- Feature extraction has deterministic fixtures for material, mobility, central activity, Jester activity, and king-in-check semantics.
- Feature extraction is pure from the caller's perspective, leaves canonical state unchanged, and each feature has a separate measured cost.
- Equivalent positions represented through different internal board encodings produce equivalent feature vectors within defined tolerances.
- Feature values stay within their declared ranges, and extraction does not mutate its input position.
- Candidate weights always remain finite, bounded, and normalized after initialization and mutation.
- Fitness is colour-balanced, layout-balanced, opponent-balanced, seed-recorded, and handles draws and failures explicitly.
- A small dry-run can reproduce its initialization, generation sequence, and fixture schedule from its recorded configuration.
- The frozen-weight primary reference and MinMax Medium secondary reference are both reported on independent validation fixtures.
- The statistical acceptance method and practical improvement threshold are defined before confirmatory validation; no parameter package is exported without passing the primary comparison.
- No feature weights or strength targets are declared optimal until controlled experiments and holdout results support that conclusion.

## Data and artifact boundaries

| Data | Purpose | Initial direction |
| --- | --- | --- |
| Candidate parameters | Current population and selected candidates | Compact structured data managed by the CLI |
| Run history/results | Generations, seeds, match outcomes, fitness summaries, run metadata, and code version | JSONL; uploaded as a GitHub Actions artifact for initial runs |
| Resume checkpoint | Enough state to continue an interrupted run | Generation-boundary checkpoint, validated against the original run configuration; uploaded as a GitHub Actions artifact |
| Exported parameter package | Runtime input for the evolutionary engine | Versioned JSON; small, validated, and reviewed before being committed to the game repo |
| Temporary match data | Positions and per-game details needed for diagnostics | Keep only what is useful; avoid retaining every full trace by default |

Initial Actions runs are started manually through a dedicated `workflow_dispatch` workflow, separate from ordinary PR contract-test jobs. The workflow should expose only bounded run options, record the triggering commit and effective configuration, and upload run metadata/results and checkpoints as artifacts. A resume run must explicitly select/download a prior checkpoint artifact and verify that its schema, source commit compatibility, and experiment configuration match; it must not silently mix configurations. Artifact retention limits must be visible in the workflow/CLI guidance. A local Node.js run on the Mac mini M1 should use the same CLI and checkpoint format, with a user-controlled local storage location.

Training history and checkpoints must not be committed to the ordinary game repository by default. Only selected, reviewed runtime parameter packages belong in the game source/release path.

## Staged work

### 1. Define the evolutionary model

Specify:
- The initial semantic evaluation features and parameter bounds, based on inspected game rules and existing evaluation code. Define their meaning, scale/normalization, applicability, and feature-schema version; do not expose matrix indices or bitboard layout as model inputs.
- The feature-extraction boundary between canonical game state and the evolutionary model, including how variant-specific features are declared and validated.
- The compatibility rule for future board-representation changes: equivalent positions must yield equivalent feature vectors, or require an explicit feature-schema/version migration before existing weights can be reused.
- Candidate representation, initialization, and the frozen equal-weight primary reference.
- The runtime search algorithm and which parameters are, and are not, evolved.
- Selection, mutation, optional crossover, elitism, and population replacement.
- Fitness calculation, match scheduling, colour balance, termination conditions, and handling of draws.
- Primary and secondary references, holdout separation, and the statistical acceptance principle.
- How to avoid overfitting to one opening, colour, seed, or opponent.

**Progress:** Model v1 decisions approved on 2026-11-10. The semantic feature definitions, bounded normalized weights, MinMax/Alpha-Beta runtime search, seedable training design, opponent schedule, dual validation references, and package baseline identity are recorded above. Exact statistical test settings and CLI/persistence details remain for Stage 2.

### 2. Specify the CLI, GitHub Actions workflow, and persistence contract

Inspect the current Node.js scripts, test conventions, game loading approach, and calibration runner before choosing code reuse or file layout.

Define:
- CLI commands and bounded run options for smoke/pilot runs and larger experiments.
- Manual `workflow_dispatch` inputs, runner environment, concurrency/cancellation behavior, and separation from automatic PR gates.
- Seed handling, unique run IDs, and capture of commit/runtime/configuration metadata.
- JSONL record structure and compatibility/version fields.
- Checkpoint structure, generation-boundary write safety, resume validation, artifact selection/download, retention guidance, and behavior after a partial/corrupt record.
- Output summaries, statistical method/threshold fixed before confirmatory validation, and export validation.
- How to stop cleanly and resume without silently changing the experiment configuration.
- Local M1 execution using the same CLI and persistence format after the Actions path is established.

The trainer must use the canonical game rules and move application rather than implementing a second rules engine. The Actions workflow must not turn long evolutionary training into an automatic PR/CI gate.

### 3. Implement the offline trainer

Build a minimal CLI workflow with small default pilot limits and no network requirement for the trainer itself. Add focused tests for deterministic components, parameter bounds, match scoring, feature purity/performance, persistence, interrupted-run recovery, and export validation.

Use GitHub Actions for initial smoke and pilot execution. Keep long or confirmatory runs manually started and explicitly bounded; do not make full tournaments or long training runs an automatic CI gate. Add local M1 execution without changing the experiment or checkpoint semantics.

### 4. Implement the runtime engine

Add the evolutionary engine through the existing engine contract. Implement its own MinMax/Alpha-Beta search using the validated `Default` parameter package; enforce variant compatibility; provide bounded search and cancellation behavior; and test worker and main-thread paths.

The runtime engine must work without the trainer or training history being present. Its normal gameplay path must not use the training PRNG or require training-only dependencies.

### 5. Evaluate and package a first result

Run controlled, modest experiments. Begin with a small GitHub Actions pilot, measure runtime and feature costs, and increase the run budget only when the measurements justify it. Compare candidates with the frozen-weight primary reference and existing MinMax Medium secondary reference on balanced, independent fixtures. Record sample sizes, seeds, code/runtime conditions, and uncertainty; do not describe small samples as definitive strength ratings.

Export only a selected candidate that passes the predeclared primary holdout acceptance criterion. Store the resulting versioned `Default` parameter package in the game source/release path. Keep raw training data and checkpoints outside the shipped PWA and ordinary source history.

### 6. Explore further profiles and future training modes

After the engine has a stable baseline:
- Evaluate whether additional named personalities are useful and how this engine should declare support for them.
- Determine whether personality behavior should be applied as a separate engine-owned style layer rather than representing personalities as unrelated baseline genomes.
- Revisit in-game evolution as a separate design and approval step. It may require controlled persistence, user consent, reset/export behavior, and rules for preventing match results from silently changing a shipped baseline.

## Acceptance gates

- The engine can load and validate a versioned `Default` parameter package without access to the trainer or training data.
- Unsupported variants, malformed packages, incompatible schema versions, and invalid parameter values fail explicitly.
- The runtime engine uses its own MinMax/Alpha-Beta search and consumes semantic features through the pure adapter boundary.
- The CLI uses canonical game rules and produces bounded, inspectable runs.
- A run records its effective configuration, seed, commit, and runtime environment; interrupted runs can resume from a validated checkpoint without silently mixing configurations.
- Initial training and smoke execution work through a manually dispatched GitHub Actions workflow; local M1 execution can use the same CLI and artifact/checkpoint format.
- Training artifacts remain separate from PWA assets and normal runtime storage.
- Automated tests cover feature semantics/purity/performance, core evolutionary operations, scoring, persistence/recovery, package validation, engine contract behavior, and relevant worker lifecycle behavior.
- Export requires statistically supported improvement over the frozen-weight primary reference on independent holdout data; the existing MinMax Medium secondary comparison is reported.
- Any strength claims identify the exact opponents, sample size, seeds, runtime conditions, and limitations.
- Future in-game evolution and personality training remain possible design directions, but are not required or implemented by this plan's first version.

## Explicit non-goals for the first version

- Neural networks, GPU-based training, or a general machine-learning framework.
- Distributed workers, always-on training, or a separate cloud training service. GitHub Actions hosted runners are the initial manually triggered execution environment only.
- In-game learning or automatic mutation of the active shipped profile.
- User-created personality editor or a broad personality roster.
- A universal parameter schema shared by every engine.
- A database server or heavyweight training framework.
- Changes to board geometry, variant rules, or the canonical game-state representation.
- Replacing or rewriting the existing MinMax/MCTS engines.
- Automatically running long evolutionary training or confirmatory tournaments in CI.

## Related documents

- [Engine Extensibility Plan](ENGINE-EXTENSIBILITY-PLAN.md) — cross-engine, personality, variant, and board architecture.
- [Engine Plugins](ENGINE-PLUGINS.md) — current engine integration and verification record.
- [Engine Strength Calibration](ENGINE-STRENGTH-CALIBRATION.md) — existing MinMax/MCTS comparison runner and methodology.
- [Engine Testing Workflow](ENGINE-TESTING-WORKFLOW.md) — focused checks and optional full calibration policy.
- [Engine and Board Ideas](ENGINE-IDEAS.md) — exploratory ideas and future personality examples.

## Change log

- **2026-11-10:** Recorded the approved v1 decisions: MinMax/Alpha-Beta runtime search; pure, representation-independent feature extraction with per-feature cost measurement; seedable training; `Default` baseline parameters; GitHub Actions as the initial manual training environment; Actions artifacts for run outputs/checkpoints; dual validation references; independent holdout acceptance; reproducible run metadata; and locked feature-schema v1.
- **2026-11-09:** Added a representation-independent semantic feature boundary so future bitboard or other internal representation work can proceed without coupling evolutionary weights or training data to storage details.
