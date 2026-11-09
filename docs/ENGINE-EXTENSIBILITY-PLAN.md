# Engine Extensibility Plan

Purpose: define the architectural investigation and staged direction for adding engines, engine personalities, alternative board configurations, and future game variables without locking the project to its current engine count, board geometry, or phase model. This is a planning document, not an implementation specification or proof of runtime support.

## Status

**Status: In progress (2026-11-09).** Stages A–D and the initial E.4/E.5 implementations are complete and merged. PR #144 added MinMax Dragjägaren for midgame; PR #146 added the same profile to MCTS for midgame. Both passed CI and manual PWA verification. The current task branch extends the existing profile to opening, midgame, and endgame for both engines. GitHub Actions run #568 passed 158 tests (0 failures); manual PWA verification across all three phases remains pending. Additional engines and alternative-board work remain unstarted.

## Goal

Prepare Jester & Moat to grow beyond its current two engines, 10×8 board, and three detected game phases. The intended direction must accommodate:

- Several additional engines, potentially three or four beyond MinMax and MCTS.
- Engine personalities that can be reused across compatible engines.
- Alternative board geometries and starting setups, including a possible 5×8 board.
- Additional rule and position variables required by future variants.
- Independent configuration without requiring every engine or variant to support every option.

Do not build a general-purpose game framework, public plugin SDK, dynamic marketplace, or speculative abstraction layer. Each abstraction must answer a demonstrated requirement in the planned extensions.

## Current baseline

- Engine Contract protocol v1 is complete for MinMax and MCTS. Reuse its request identity, immutable position snapshots, canonical move boundary, cancellation, stale-result rejection, and failure handling.
- Engine Configuration is merged in PR #138. It provides independent engine, strength, and advanced settings for each current side × phase assignment.
- The current game uses a 10-column × 8-row board and currently detects opening, midgame, and endgame in `getGamePhase()`.
- The current registry is a static `enginePlugins` Map. Keep registration simple unless a concrete requirement proves otherwise.
- Variant identity is explicit: the current game is `jester-moat` v1 (PR #140).
- MinMax and MCTS declare supported variants; configuration and pre-search checks, including worker dispatch, reject unsupported variants with `UNSUPPORTED_VARIANT` (PR #141).
- The minimal personality contract is merged in PR #143: a global `Default` profile and engine-declared support metadata. MinMax Dragjägaren (Move Hunter) is merged in PR #144 and MCTS support in PR #146; both initially supported midgame only. The current task extends the existing profile to all three detected phases for both engines. Alternative board sizes remain unimplemented. Other illustrative profile names and behavior examples remain exploratory. See [Engine and Board Ideas](ENGINE-IDEAS.md).
- The bitboard proposal is a separate engine-internal performance investigation. It must not silently replace the canonical game-state representation.

This is a baseline, not a promise that every current implementation detail is suitable for future variants. Re-inspect code and tests before each implementation stage.

## Architectural principles to preserve

1. **One canonical game state per active variant.** Engines receive an isolated snapshot of the complete position and rule-relevant context. Variant-specific state must not be inferred from board dimensions alone.
2. **Variant identity is explicit.** A position/session must identify the selected rules and setup. Geometry, starting arrangement, legal-move rules, special state, and terminal conditions belong to a coherent variant definition.
3. **The game core owns rules.** Engines search positions and return canonical moves; the game core validates and applies them. Variant support must not let engines mutate live state or bypass legality checks.
4. **Engine compatibility is declared.** An engine must identify which variants or required rule capabilities it supports. Selection and dispatch must reject incompatible combinations before search.
5. **Optional features stay optional.** Engines may differ in supported phases, strengths, advanced settings, personalities, and capabilities. Do not assume all engines expose the same controls.
6. **Separate competence from style.** A personality may influence style, but must not override move legality or cause the engine to ignore an immediate forced win merely to express a style.
7. **Avoid premature universality.** Keep the current game and existing saves/configuration behavior stable unless a separately approved change explicitly changes them.

## Staged direction

### A. Establish the actual extension boundaries

Before implementation, map the current assumptions in board construction, move generation, attack/check logic, special rules, evaluation, position serialization, save/load, editor, rendering, phase detection, and worker snapshots.

Classify each dependency as:
- Geometry-dependent (row/column bounds, coordinates, files).
- Variant-rule-dependent (movement, moats, castling, promotion, terminal conditions).
- Position-state-dependent (rights, counters, special state, history).
- Presentation-only (labels, board layout, piece rendering).

Deliverable: a dependency map and a list of the smallest changes needed to represent the existing 10×8 game as the first explicit variant. Do not refactor unrelated code during this audit.

**Progress:** Complete. The extension boundaries and dependency areas were mapped during the Stage A investigation.

### B. Define a minimal variant descriptor

Design a data model for the existing game first. Evaluate, but do not assume, fields such as:
- Stable variant ID and display metadata.
- Board dimensions and coordinate conventions.
- Starting position/setup.
- Rule-set identity and variant-specific rule parameters.
- Required position-state fields and serialization version.
- Supported sides, phases, and terminal conditions where these genuinely vary.

Keep rule execution in the game core. A descriptor should identify/configure supported rules; it should not become an arbitrary user-scripted rule engine.

Acceptance gate: the existing 10×8 game can be represented without changing its rules, legal moves, save/load meaning, or visual behavior.

**Progress:** Complete. The agreed conceptual model separates Variant Definition, Game Setup, and Position State. PR #140 added the explicit `jester-moat` v1 identity baseline.

### C. Add engine/variant compatibility to the engine boundary

Extend the current static engine metadata and validation only as required by the variant model. The current implementation declares supported variant IDs with explicit supported versions (`supportedVariants`); keep this declaration small and engine-owned. Variant identity remains in the canonical position snapshot, not duplicated in protocol request metadata.

Engines declare supported variant IDs and versions, plus any genuine capabilities or limitations relevant to dispatch. Validate compatibility both when configuring an assignment and immediately before dispatch. Keep protocol v1's safety and lifecycle semantics.

**Progress:** Complete. PR #141 added MinMax and MCTS support declarations for `jester-moat` v1 and rejects unsupported combinations with stable `UNSUPPORTED_VARIANT` errors. Validation covers configuration and pre-search dispatch, including the worker. The variant identity remains in the canonical position snapshot.

**Acceptance:** MinMax and MCTS continue to pass the engine contract suite, and incompatible engine/variant combinations are rejected with stable errors. Completed in PR #141; the user also confirmed the PWA check.

### D. Define the personality layer independently of engines

**Design decisions agreed (2026-11-08):**

- A personality is a reusable, named playing-style profile, not another engine ID.
- Personality selection is independent of engine and strength, and is configured per **side × phase** (White/Black × opening/midgame/endgame in the current configuration model).
- Profiles are global identities that can be reused across engines. Each engine declares which profiles it supports and is responsible for translating a selected profile into its own search/evaluation behavior. Engines do not need identical internal implementations.
- Start with names and user-facing descriptions only. Do not define a shared set of numeric style dimensions or tuning parameters in the first version.
- `Default` is always available, is the standard initial selection, and is mandatory for every engine.
- If an engine does not support a selected non-default profile, configuration validation rejects the combination explicitly. Do not silently fall back to `Default`.
- Personality selections are included in predefined presets and saved custom configurations. Presets are editable starting points; changing a personality after selecting a preset is allowed.
- The first version uses built-in profiles only. User-created profiles are out of scope.
- The illustrative names and behaviors in [Engine and Board Ideas](ENGINE-IDEAS.md) are not an approved roster.

Keep the personality contract small. It should establish stable profile identity/description, engine-declared supported profile IDs, and a clear validation boundary. Avoid imposing shared algorithm-specific parameters or adapters that do not serve a demonstrated engine implementation. Each engine owns how it realizes a supported profile.

**Acceptance gate for a future implementation:**
- Every engine supports `Default`; unsupported selected profiles are rejected during configuration validation and rechecked before dispatch where needed.
- Personality choice round-trips through presets and saved custom configurations, and remains independently selectable for each side × phase.
- A supported non-default profile produces an observable style difference in controlled positions without changing legal move output, bypassing immediate tactical wins, or breaking search budgets, cancellation, stale-result rejection, and worker/main-thread behavior.
- Existing configurations and saves receive a deliberate, tested defaulting/compatibility behavior; do not assume a migration without inspecting the actual formats.

**Progress:** Complete. PR #143 merged the minimal runtime contract: `Default` is registered, both current engines declare support, profile IDs are stored per side × phase, and unsupported profiles are rejected during configuration and dispatch. CI passed with 153 tests and the user approved the PWA test.

### E. Implement incrementally

Recommended implementation order after the design gates above:

1. Represent the existing 10×8 Jester & Moat rules as the first variant, with behavior-preserving regression tests. **Complete (PR #140).**
2. Add declared engine/variant compatibility and validation for MinMax and MCTS. **Complete (PR #141).**
3. Implement the minimal personality contract from Stage D, including mandatory `Default`, engine-declared supported profile IDs, and explicit unsupported-profile validation. **Complete (PR #143; 153 CI tests passed; manual PWA test approved).**
4. Add the first built-in profile to one engine and one phase, then verify its behavior in controlled positions before expanding the roster. Dragjägaren (Move Hunter) is complete for MinMax midgame (PR #144; 157 automated tests passed and manual PWA verification was approved).
5. Add personality support to further engines one at a time, preserving engine-owned interpretation and shared contract tests. **Complete in PR #146:** add the existing Dragjägaren profile to MCTS for midgame only. GitHub Actions passed 158 tests (0 failures); manual PWA verification remains pending.
6. Add further engines one at a time, with explicit variant/capability declarations and shared contract tests.
7. Add a reduced board such as 5×8 only after geometry, setup, rule differences, serialization, editor, rendering, and engine compatibility have explicit designs and tests.

The ordering may be revised if the dependency audit demonstrates a lower-risk sequence. A new engine does not need to wait for every personality or board variant if its scope is compatible with the current game.

### E.4. First non-default profile: Dragjägaren (Move Hunter)

**Agreed behavior (2026-11-08):**

- First engine: MinMax only; MCTS remains `Default`-only and its evaluation behavior must not change.
- Availability: opening, midgame, and endgame, independently selectable for White and Black through the side × phase configuration.
- Scope: positions are evaluated differently; move ordering is unchanged.
- Behavior: reward actual attacks against enemy pieces, including defended targets. Do not reward merely potential attacks and do not add a separate check bonus.
- Count each attacked enemy piece once, regardless of the number of attackers.
- Scale the bonus to 10% of the target's existing material value. The king is excluded because its 200-point value is a terminal-search sentinel, not a capturable material value.
- Keep the existing Default evaluation unchanged.

**Implementation gate:** Add the profile to the shared registry, declare MinMax support, enforce its availability in all three supported phases while requiring a valid phase context in configuration and dispatch, pass personality identity through main-thread and worker requests, and cover scoring/sign/one-per-target behavior with regression tests. CI and manual PWA verification must be recorded only after completion.

**Progress:** Initial MinMax midgame implementation completed in PR #144; GitHub Actions passed 157 tests (0 failures), and the user approved the PWA test. The current task branch removes the midgame-only restriction and adds phase-by-phase scoring, contract, and worker-dispatch coverage for opening, midgame, and endgame.

### E.5. Add Dragjägaren to MCTS

**Agreed behavior (2026-11-08):**

- Reuse the existing `move_hunter` profile; do not introduce a second profile identity.
- Availability: MCTS opening, midgame, and endgame, independently selectable for White and Black through the existing side × phase configuration.
- MCTS owns the interpretation: add the attack bonus at the random-playout leaf evaluation, while retaining MCTS's UCT selection, simulation, backpropagation, strength levels, and budgets.
- Reward actual attacks against enemy non-king pieces, including defended targets. Count each target once, regardless of attacker count; use 10% of its material value.
- Keep MCTS `Default` evaluation and MinMax behavior unchanged. The configured side remains the beneficiary throughout each playout.
- Recheck personality/phase compatibility in main-thread search and structured worker dispatch; pass the selected context through both synchronous and asynchronous MCTS search paths.

**Implementation gate:** Cover White/Black scoring, defended and multiply-attacked targets, king exclusion, all-phase validation, unchanged Default evaluation, and structured worker dispatch. Record CI and manual PWA verification only after they actually pass.

**Progress:** Initial MCTS midgame implementation completed in PR #146. GitHub Actions passed 158 tests (0 failures), and the user approved the PWA test. The current task branch extends MCTS evaluation and worker dispatch to all three phases, with tests confirming each phase is accepted.

## Cross-cutting verification

Every implementation stage must add focused regression coverage for the changed boundary. At minimum, plan for:

- Current 10×8 behavior and legal moves remain unchanged.
- Position snapshots carry all rule-relevant variant context and remain immutable.
- Save/load and editor round trips preserve variant identity and state.
- Engine compatibility is checked before worker and main-thread search.
- Unsupported capabilities/settings are rejected rather than silently ignored.
- Personality selection remains independent per side × phase, round-trips through presets and saved configurations, and rejects unsupported engine/profile combinations.
- Personality behavior cannot bypass legality or immediate tactical wins.
- Search budgets, cancellation, stale-result rejection, and fallback remain correct.
- Alternative board tests cover coordinate bounds, move generation, attacks/checks, special rules, promotion, rendering, and editor operations.
- Existing offline PWA deployment and service-worker precache rules remain intact.

Browser/mobile verification must be recorded separately from automated tests and only after it is actually performed.

## Explicit non-goals

- No broad personality roster or additional engine implementations as part of the first Move Hunter profile task; further profiles and engines remain separately staged.
- No commitment to the illustrative personality names or roster.
- No user-created personality profiles in the first implementation.
- No shared numeric personality parameter model in the first implementation.
- No assumption that every engine supports every variant, phase, or personality (except the mandatory `Default` profile).
- No dynamic third-party plugin system.
- No migration of existing saved games or engine configuration unless a future approved change explicitly defines and tests it.
- No replacement of the canonical matrix board with bitboards as part of this work.
- No unrelated editor fixes, strength recalibration, or engine algorithm optimization.

## Related plans and references

- [Engine Interface Architecture Plan](ENGINE-INTERFACE-PLAN.md): completed protocol-v1 contract baseline.
- [Engine Configuration Plan](ENGINE-CONFIGURATION-PLAN.md): completed current side × phase engine configuration.
- [Engine Plugins](ENGINE-PLUGINS.md): current integration, verification, and parked follow-up work.
- [Engine and Board Ideas](ENGINE-IDEAS.md): exploratory personality examples, standard-chess, and alternative-board ideas.
- [Bitboard Engine Evaluation and Migration](BITBOARD-ENGINE-PLAN.md): separate engine-internal performance evaluation.

## Change log

- **2026-11-09:** Extended the existing Dragjägaren profile to opening, midgame, and endgame for both MinMax and MCTS on `feat/move-hunter-all-phases`; CI and PWA verification are pending.
- **2026-11-08:** PR #143 merged Stage E.3's minimal personality contract; CI passed 153 tests and manual PWA verification was approved. PR #144 completed the initial MinMax midgame profile; CI passed 157 tests and manual PWA verification was approved. PR #146 added the same midgame profile to MCTS; CI passed 158 tests and manual PWA verification was approved.
- **2026-11-07:** Created after Engine Configuration PR #138 merged. Records a planning direction only; no extension implementation is authorized by this document.
