# Evolutionary Engine Plan

Purpose: record the staged plan, approved model decisions, and implementation progress for a small, independently trainable evolutionary engine and its offline Node.js CLI. This is not a substitute for inspecting the current implementation and tests.

## Status

**Status: In progress.** Stage 3A trainer core and Stage 3B CLI/persistence are merged (PR #157; CI passed 182 tests). Stage 4 runtime-engine integration is underway on `feat/evolutionary-runtime-engine`. The shipped `Default` package is a frozen equal-weight control, not an empirically calibrated or evolved result. No training pilot, baseline measurement, holdout evaluation, or model export has been completed.

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

After training, select one candidate for explicit final evaluation; do not use holdout results for evolutionary selection. Each candidate submitted for final evaluation receives its own pre-generated, independent holdout fixture set. Never reuse a candidate's holdout set for another candidate. If a candidate fails, a later candidate requires a newly generated holdout set. Keep each candidate's holdout fixtures balanced across opponent, colour, and opening layout. Use two explicit references during validation:
1. **Primary reference:** the new MinMax/Alpha-Beta engine with the frozen equal-weight start parameters. This isolates the effect of evolution while keeping the search algorithm and settings the same.
2. **Secondary reference:** the existing MinMax Medium engine. This indicates whether the evolutionary engine is competitive with the current baseline implementation.

A candidate does not need to beat either reference. It must meet a predeclared minimum performance floor against both the primary frozen equal-weight reference and the secondary MinMax Medium reference. Establish the floors empirically from balanced baseline measurements completed before the first evolutionary run. Before any confirmatory holdout is inspected, lock the statistical method, confidence level, minimum practical floor, and candidate-specific holdout schedule. Apply the same candidate-specific fixtures to the candidate and both references. Report uncertainty and both comparisons; do not present a small sample as a definitive strength rating.

The existing calibration runner is useful as a source of match-scheduling and reporting concepts, but it currently compares only the six shipped MinMax/MCTS presets. Its seeded PRNG, Node VM setup, initial-position construction, and canonical game loop are potential reuse points; its fixed profile lookup and tournament orchestration are not directly reusable for evolutionary candidates. Factor shared helpers only where doing so avoids duplication and remains covered by focused tests; do not build a second rules engine.

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
- Empirical minimum performance floors against both references are established from baseline measurements before the first evolutionary run; the statistical method, confidence level, and practical margins are locked before confirmatory holdout evaluation. A candidate that fails either floor is not exportable.
- No feature weights or strength targets are declared optimal until controlled experiments and holdout results support that conclusion.

## Data and artifact boundaries

| Data | Purpose | Initial direction |
| --- | --- | --- |
| Candidate parameters | Current population and selected candidates | Compact structured data managed by the CLI |
| Run history/results | Generations, seeds, match outcomes, fitness summaries, run metadata, and code version | Append-only JSONL plus a machine-readable JSON report and Markdown summary; uploaded as a GitHub Actions artifact for initial runs |
| Resume checkpoint | Enough state to continue an interrupted run | Full generation-boundary checkpoint, atomically written and validated against the original run configuration; uploaded as a separate GitHub Actions artifact |
| Exported parameter package | Runtime input and permanent record of an approved model | Versioned JSON plus provenance metadata, attached to a versioned GitHub Release after manual approval; the exact approved package is also included in the PWA source/precache when adopted for offline runtime |
| Temporary match data | Positions and per-game details needed for diagnostics | Keep only what is useful; avoid retaining every full trace by default |

Initial Actions runs use a dedicated manual `workflow_dispatch` workflow, separate from ordinary PR contract-test jobs. It invokes the same Node.js CLI as local runs and supports bounded `train`, `resume`, and explicitly requested `evaluate` operations. Inputs expose only bounded population/generation limits, an explicit non-negative seed for new runs, and the source run/artifact and candidate identity required for resume/evaluation. Record the triggering commit, run ID, effective configuration, Node.js version, runner OS, and relevant runtime details. Upload run outputs and the latest checkpoint as separate artifacts with documented finite retention. A resume/evaluation operation must explicitly identify its source artifact. The workflow validates the artifact and run metadata before invoking the CLI. A local Node.js run on the Mac mini M1 uses the same CLI, schemas, and checkpoint format with a user-controlled local output directory; the trainer itself requires no network access.

Training history, reports, and checkpoints must not be committed to the ordinary game repository. Only a manually approved, validated model package and its provenance metadata are attached to a versioned GitHub Release as permanent experiment outputs. When a package is adopted by the offline PWA, the exact package is separately committed as a runtime asset and included in the service-worker precache; the app must not fetch its active model from GitHub at runtime.

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

**Progress:** Model v1 decisions approved on 2026-11-10. The semantic feature definitions, bounded normalized weights, MinMax/Alpha-Beta runtime search, seedable training design, opponent schedule, dual validation references, and package baseline identity are recorded above.

### 2. Specify the CLI, GitHub Actions workflow, and persistence contract

#### CLI contract

Use one Node.js CLI entry point with four subcommands:

| Command | Responsibility |
| --- | --- |
| `train` | Start a new, bounded evolutionary run from an explicit seed and immutable run configuration. |
| `resume` | Continue from an explicitly supplied, validated generation checkpoint. |
| `evaluate` | Run the separately requested final holdout evaluation for one named candidate; never run automatically at the end of training. |
| `export` | Validate and write a candidate's versioned JSON parameter package and provenance metadata after the user has reviewed and approved its evaluation. It does not publish a GitHub Release or modify the game source. |

The same CLI implementation and data formats are used locally and in GitHub Actions. The CLI has no network dependency. `train` requires an explicit non-negative safe-integer seed; it generates and records a unique run ID. All run options are validated against documented bounds before work begins. `--seed` is mandatory for `train`; `--population` is bounded to 4–8 evolving candidates and defaults to 8; `--generations` is bounded to 1–8 and defaults to 8; `--output-dir` selects local storage. The first Actions pilot uses 4 candidates and 2 generations, then measures runtime before any increase. The frozen equal-weight control is additional and excluded from the population count, selection, elitism, and mutation. Effective limits are always recorded and cannot change during a run. Fixture count, opponents, and per-candidate match balance remain fixed by model v1 rather than being silently tuned through CLI flags.

#### Run records and reports

Write an append-only `run.jsonl` event stream. Every record includes `recordSchemaVersion`, `runId`, monotonically increasing `sequence`, event type, generation where applicable, and a payload. Version the record schema independently from the feature and parameter-package schemas. Events cover run start/configuration, generation start/completion, completed matches, candidate fitness summaries, interruption, and run completion/failure. Include the exact fixture seed and opponent/configuration identity in each match record.

Also write:
- `report.json`: complete run metadata, effective configuration, per-generation population/fitness summaries, best candidate and fitness breakdowns, match outcomes, status, and any holdout evaluation results.
- `summary.md`: concise human-readable run summary, warnings, candidate ranking, reference comparisons, runtime details, and artifact identifiers where available.

A run ID is unique and includes enough human-readable context to identify the run; the authoritative identity is the full stored value, not a filename-derived guess. Record the source commit, trainer/schema versions, Node.js version, OS/runner, base seed, PRNG identity/state, opponent versions and settings, fixture schedule, search limits, terminal rules, timestamps, and final status. Do not claim bit-for-bit identical timed searches across different devices.

#### Checkpoint and resume contract

Write one complete checkpoint after each completed generation. Write to a temporary file, flush/close it, then atomically replace the previous checkpoint so interruption cannot leave a half-written checkpoint as the latest valid state. The checkpoint contains its own schema version; run ID; source commit and trainer version; feature and parameter schema versions; complete immutable run configuration; base seed and full PRNG state; generation index; population and candidate IDs/weights; completed fitness and match records; generation/overall best candidates and breakdowns; fixture schedule; and all state required to continue without regenerating a different experiment.

`resume` requires an explicit checkpoint path locally or source Actions run/artifact identifier remotely; its CLI input also identifies the artifact and checkpoint file. `evaluate` identifies the source run/artifact and candidate ID. Reject with a clear error if the checkpoint is malformed, incomplete, has an unsupported schema, or differs in source-code compatibility or any immutable run setting. Do not migrate checkpoints automatically in v1. The checkpoint is authoritative for the last completed generation. A trailing incomplete JSONL record may be discarded with a recorded warning; a malformed complete record or invalid checkpoint stops recovery without overwriting source data. If a run is interrupted mid-generation, resume repeats that generation from its last complete checkpoint using the same deterministic fixtures and PRNG state; partial results from the interrupted generation are marked abandoned and are not mixed into the resumed generation.

#### GitHub Actions execution and cancellation

Use a dedicated workflow file with `workflow_dispatch` only for evolutionary training operations. Keep the existing engine-contract workflow and its PR/push gates unchanged. Use a bounded Ubuntu runner and a pinned Node.js major matching the repository's supported test environment. Do not use a matrix or parallel candidate jobs in v1: one run executes sequentially so resource use and seeded ordering remain predictable. Prevent overlapping evolutionary runs; do not cancel an active run merely because another dispatch is requested. A user-requested cancellation signals the CLI to stop at a safe generation boundary where possible. If the runner is forcibly terminated, the last atomically completed generation checkpoint remains the recovery point. Cancellation never converts an incomplete run into a successful result.

Upload run outputs and checkpoints as separate named Actions artifacts. Use finite, explicitly configured retention for both; display retention guidance in the workflow summary and CLI help. A resume/evaluate workflow invocation must select the source run/artifact explicitly and verify its contents before use. No training workflow runs automatically on pushes or pull requests, and no full tournament is an automatic CI gate.

#### Holdout and export workflow

A completed training run does not automatically evaluate or export its best candidate. The user explicitly selects one candidate for `evaluate`. Before the first evolutionary run, perform balanced baseline measurements: frozen equal-weight self-play to characterize the primary-reference baseline and its observed variance, plus frozen equal-weight versus MinMax Medium to characterize the secondary baseline. Use these measurements to set minimum acceptable performance floors for candidate-versus-primary and candidate-versus-secondary comparisons. Before opening any candidate-specific holdout results, predeclare the statistical method, confidence level, practical margins, fixture-generation rules, and a sequential-testing correction for the possibility that more than one candidate may be evaluated. Generate a fresh holdout set for each candidate evaluated; never reuse it for another candidate. Within a candidate's evaluation, compare the candidate and both references on the same fixtures. The candidate passes only if it meets both predeclared floors; it is not required to beat either reference. Failed candidates are not exported.

After explicit human approval, `export` writes a validated versioned JSON package and provenance metadata, including the run ID, candidate ID, source commit, schema versions, seed, effective configuration, baseline/holdout methodology, sample counts, results, and limitations. The user then attaches the approved files to a versioned GitHub Release following the repository release procedure. The package's runtime copy, if adopted, is committed and precached separately so the PWA remains fully offline.

#### Local execution and implementation boundary

Local execution on the Mac mini M1 uses the same commands, run schema, checkpoint schema, and validation rules as Actions, with a configurable local output directory. Local execution is enabled after the Actions path is established; it is not a separate implementation. The trainer must use canonical game rules and move application rather than implementing a second rules engine. The Actions workflow must not turn long evolutionary training into an automatic PR/CI gate.

**Stage 2 progress:** CLI, Actions, persistence, holdout, and release decisions approved on 2026-11-10 and specified above. Exact statistical method and numeric performance floors are intentionally set from baseline measurements before confirmatory holdout evaluation.

### 3. Implement the offline trainer

Build a minimal CLI workflow with small default pilot limits and no network requirement for the trainer itself. Add focused tests for deterministic components, parameter bounds, match scoring, feature purity/performance, persistence, interrupted-run recovery, and export validation.

**Progress (Stage 3A — trainer core):** Merged into `main` in PR #156. The implementation provides schema-v1 semantic feature extraction, bounded candidate Alpha-Beta search, seeded population/mutation/selection, balanced fixed fixtures, and real-rule matches against MinMax Medium and MCTS Medium. GitHub Actions run #622 passed all 173 tests (0 failures).\n\n**Progress (Stage 3B — CLI and persistence):** Merged in PR #157. The shared `train`, `resume`, `evaluate`, and `export` CLI, append-only JSONL events, JSON/Markdown reports, strict atomic generation checkpoints, guarded export, and manual bounded Actions workflow are implemented. CI passed 182 tests. Holdout evaluation intentionally fails closed until baseline floors and the statistical protocol are predeclared. No training pilot has been run.

Use GitHub Actions for initial smoke and pilot execution. Keep long or confirmatory runs manually started and explicitly bounded; do not make full tournaments or long training runs an automatic CI gate. Add local M1 execution without changing the experiment or checkpoint semantics.

### 4. Implement the runtime engine

Add the evolutionary engine through the existing engine contract. Implement its own MinMax/Alpha-Beta search using the validated `Default` parameter package; enforce variant compatibility; provide bounded search and cancellation behavior; and test worker and main-thread paths.

**Progress:** Runtime integration is underway on `feat/evolutionary-runtime-engine`. The branch adds a versioned schema-v1 equal-weight `Default` package, a standalone engine adapter, browser-loadable feature/search modules, bounded synchronous and cooperative search, Engine Contract registration, worker dispatch, PWA precaching, and single-file build inclusion. GitHub Actions run #42889183108 passed 186 tests (0 failures), and the final branch diff has been reviewed. Manual browser verification remains pending.

The runtime engine must work without the trainer or training history being present. Its normal gameplay path must not use the training PRNG or require training-only dependencies.

### 5. Evaluate and package a first result

Run controlled, modest experiments. Begin with a small GitHub Actions pilot, measure runtime and feature costs, and increase the run budget only when the measurements justify it. Compare candidates with the frozen-weight primary reference and existing MinMax Medium secondary reference on balanced, independent fixtures. Record sample sizes, seeds, code/runtime conditions, and uncertainty; do not describe small samples as definitive strength ratings.

Export only a manually approved candidate that meets both empirically established performance floors on its own independent holdout set. Attach the versioned `Default` JSON package and provenance metadata to a GitHub Release. If adopted by the offline PWA, commit the exact runtime package separately and include it in the service-worker precache. Keep raw training data and checkpoints outside the shipped PWA and ordinary source history.

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
- Export requires a manually approved candidate to meet predeclared, empirically established minimum performance floors against both the frozen-weight primary reference and MinMax Medium on a candidate-specific independent holdout set; the candidate need not outperform either reference.
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

- **2026-11-10:** Specified the Stage 2 CLI, Actions, persistence, and release contract: one shared CLI (`train`, `resume`, `evaluate`, `export`); manually dispatched sequential Actions runs; JSONL, JSON, and Markdown outputs; full generation checkpoints; strict resume validation; separate finite-retention run/checkpoint artifacts; candidate-specific holdout sets; empirical minimum floors against both references; manual export approval; and versioned GitHub Release assets.
- **2026-11-10:** Recorded the approved v1 model decisions: MinMax/Alpha-Beta runtime search; pure, representation-independent feature extraction with per-feature cost measurement; seedable training; `Default` baseline parameters; GitHub Actions as the initial manual training environment; Actions artifacts for run outputs/checkpoints; dual validation references; independent holdout acceptance; reproducible run metadata; and locked feature-schema v1.
- **2026-11-09:** Added a representation-independent semantic feature boundary so future bitboard or other internal representation work can proceed without coupling evolutionary weights or training data to storage details.
