# Engine Extensibility Plan

Purpose: define the architectural investigation and staged direction for adding engines, engine personalities, alternative board configurations, and future game variables without locking the project to its current engine count, board geometry, or phase model. This is a planning document, not an implementation specification or proof of runtime support.

## Status

**Status: Planned (2026-11-07).** This plan follows the merge of Engine Configuration (PR #138). No implementation work for the extensions below has been approved or started. The first task is to settle the shared model and boundaries before changing game code.

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
- Personality behavior and alternative board sizes remain ideas, not implemented features. See [Engine and Board Ideas](ENGINE-IDEAS.md).
- The bitboard proposal is a separate engine-internal performance investigation. It must not silently replace the canonical game-state representation.

This is a baseline, not a promise that every current implementation detail is suitable for future variants. Re-inspect code and tests before each implementation stage.

## Architectural principles to preserve

1. **One canonical game state per active variant.** Engines receive an isolated snapshot of the complete position and rule-relevant context. Variant-specific state must not be inferred from board dimensions alone.
2. **Variant identity is explicit.** A position/session must identify the selected rules and setup. Geometry, starting arrangement, legal-move rules, special state, and terminal conditions belong to a coherent variant definition.
3. **The game core owns rules.** Engines search positions and return canonical moves; the game core validates and applies them. Variant support must not let engines mutate live state or bypass legality checks.
4. **Engine compatibility is declared.** An engine must identify which variants or required rule capabilities it supports. Selection and dispatch must reject incompatible combinations before search.
5. **Optional features stay optional.** Engines may differ in supported phases, strengths, advanced settings, personalities, and capabilities. Do not assume all engines expose the same controls.
6. **Separate competence from style.** A personality may bias evaluation, risk, or choices among comparably strong moves, but must not be allowed to override an immediate forced win or basic move legality.
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

### C. Add engine/variant compatibility to the engine boundary

Extend the current static engine metadata and validation only as required by the variant model. Define how engines declare:
- Supported variant IDs or rule capabilities.
- Supported search phases, if phase support remains engine-specific.
- Strength profiles, settings schemas, and optional capabilities.
- Any genuine limitations relevant to dispatch.

Validate compatibility both when configuring an assignment and immediately before dispatch. Keep protocol v1's safety and lifecycle semantics. Decide explicitly whether the variant identity belongs in the protocol position snapshot, request metadata, or both; do not duplicate inconsistent sources of truth.

Acceptance gate: MinMax and MCTS continue to pass the existing contract suite for the current variant, and incompatible engine/variant combinations are rejected with stable errors.

### D. Define the personality layer independently of engines

Design personality as a reusable style profile, not as another engine ID. Separate:
- Personality identity and user-facing description.
- Style parameters (for example aggression, king safety, material preference, positional activity, or risk tolerance).
- Engine-specific adapters for interpreting those parameters.
- Optional personality support declared by each engine.
- Neutral/default behavior when no personality is selected.

Do not assume that MinMax and MCTS can implement a style in identical ways. MinMax may apply style to evaluation and near-equal move preference; MCTS may apply it to priors, rollout policy, or root selection where supported. The shared layer should define intent and bounds, while each engine declares its actual support.

Consider how a personality is selected alongside engine, strength, and advanced settings in the existing side × phase configuration. Keep personality optional and do not require every future engine to support it.

Acceptance gate: personality changes style measurably in controlled positions without breaking legal move output, search budgets, cancellation, or obvious tactical correctness.

### E. Implement incrementally

Recommended implementation order after the design gates above:

1. Represent the existing 10×8 Jester & Moat rules as the first variant, with behavior-preserving regression tests.
2. Add declared engine/variant compatibility and validation for MinMax and MCTS.
3. Implement a small personality contract and a neutral profile; add support to one engine first, then the second.
4. Add a small, deliberately selected personality set. The examples in ENGINE-IDEAS.md are candidates only, not an approved roster.
5. Add further engines one at a time, with explicit variant/capability declarations and shared contract tests.
6. Add a reduced board such as 5×8 only after geometry, setup, rule differences, serialization, editor, rendering, and engine compatibility have explicit designs and tests.

The ordering may be revised if the dependency audit demonstrates a lower-risk sequence. A new engine does not need to wait for every personality or board variant if its scope is compatible with the current game.

## Cross-cutting verification

Every implementation stage must add focused regression coverage for the changed boundary. At minimum, plan for:

- Current 10×8 behavior and legal moves remain unchanged.
- Position snapshots carry all rule-relevant variant context and remain immutable.
- Save/load and editor round trips preserve variant identity and state.
- Engine compatibility is checked before worker and main-thread search.
- Unsupported capabilities/settings are rejected rather than silently ignored.
- Personality settings are optional, bounded, and cannot bypass legality or lifecycle protections.
- Search budgets, cancellation, stale-result rejection, and fallback remain correct.
- Alternative board tests cover coordinate bounds, move generation, attacks/checks, special rules, promotion, rendering, and editor operations.
- Existing offline PWA deployment and service-worker precache rules remain intact.

Browser/mobile verification must be recorded separately from automated tests and only after it is actually performed.

## Explicit non-goals

- No immediate implementation of personalities, additional engines, or reduced boards.
- No commitment to the illustrative personality names or roster.
- No assumption that every engine supports every variant, phase, or personality.
- No dynamic third-party plugin system.
- No migration of existing saved games or engine configuration unless a future approved change requires it.
- No replacement of the canonical matrix board with bitboards as part of this work.
- No unrelated editor fixes, strength recalibration, or engine algorithm optimization.

## Related plans and references

- [Engine Interface Architecture Plan](ENGINE-INTERFACE-PLAN.md): completed protocol-v1 contract baseline.
- [Engine Configuration Plan](ENGINE-CONFIGURATION-PLAN.md): completed current side × phase engine configuration.
- [Engine Plugins](ENGINE-PLUGINS.md): current integration, verification, and parked follow-up work.
- [Engine and Board Ideas](ENGINE-IDEAS.md): exploratory personality, standard-chess, and alternative-board ideas.
- [Bitboard Engine Evaluation and Migration](BITBOARD-ENGINE-PLAN.md): separate engine-internal performance evaluation.

## Change log

- **2026-11-07:** Created after Engine Configuration PR #138 merged. Records a planning direction only; no extension implementation is authorized by this document.
