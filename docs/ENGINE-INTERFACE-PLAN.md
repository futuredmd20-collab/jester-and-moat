# Engine Interface Architecture Plan

Purpose: capture the proposed shared contract and staged implementation plan for internal Jester & Moat AI engines. This is a design plan, not an implementation specification or proof that the planned behavior exists in code.

## Status and scope

**Status:** Design recorded; implementation not started by this plan.

The goal is a reliable, easy-to-extend internal interface for the game's own engines, initially MinMax and MCTS. This is not a public third-party plugin SDK and does not call for a dynamic plugin marketplace or general-purpose extension framework.

This plan records the design baseline discussed on 2026-10-31. It distinguishes established direction from recommendations that must be checked against the current implementation before coding.

## Design baseline

### 1. Contract shape

- Keep a small mandatory core contract; optional behavior must be declared as capabilities rather than assumed to exist for every engine.
- Mandatory outcomes are a clear status and, on success, one move in the canonical game move format.
- Optional capabilities may include evaluation, principal variation, search statistics, and progress reporting.
- Separate the engine protocol from its transport. Keep existing workers where practical; do not make worker mechanics part of the engine's public contract.

### 2. Position and move safety

- Pass each search an immutable, standalone position snapshot. An engine must not mutate the authoritative game state.
- Include all context needed to determine legal moves and outcomes, including board contents, side to move, moat state, relevant special-rule state, and any required history.
- Define one canonical move representation at the interface boundary. Engines may use internal representations but must convert before returning.
- The move format must express every legal Jester & Moat move type, including variant-specific actions.
- The game core remains responsible for validating and executing returned moves. An engine never applies a move directly to the live game state.

### 3. Search identity, cancellation, and stale responses

- Cancellation is mandatory for every engine.
- Every search has a unique request ID and a position/search generation identifier.
- A cancellation request is not proof that search execution has stopped. The manager must distinguish cancellation requested from cancellation/completion confirmed.
- Results from cancelled, superseded, or otherwise stale searches must be rejected before they can affect the game.
- Reset, load, undo, redo, new game, and other context-changing operations must invalidate incompatible searches.

### 4. Lifecycle and concurrency

- A central engine manager owns engine creation, startup, configuration, search, cancellation, reset/recreation, and shutdown.
- Engines may retain internal resources between searches, but only one active search per instance is permitted unless that engine explicitly declares supported concurrency.
- The manager coordinates engine lifecycle when the game position or game session changes.

### 5. Configuration and registration

- Support common search controls, such as a time budget, alongside engine-specific settings.
- Scope configuration to the correct engine instance, side, and applicable game phase. Validate configuration and the effective values before starting a search.
- Prefer a simple central static registry containing a stable engine ID, display name, declared capabilities, configuration schema, and lifecycle factory.
- Avoid a dynamic registration mechanism unless a demonstrated project requirement later justifies it.

### 6. Error reporting and recovery

- Report engine failures explicitly with stable, classifiable error information; keep the engine contract separate from the manager's recovery policy.
- Reject invalid moves and stale responses. Never silently accept a failed engine's output.
- Any fallback engine must be deliberate/configured rather than an invisible part of the contract.
- Before fallback search, use a fresh snapshot of the current position and a new request ID/generation as appropriate.
- If fallback also fails, stop the automated move safely and surface a clear error; do not compromise game integrity to force a move.

### 7. MinMax and MCTS direction

- Refactor MinMax to implement the shared contract directly, preserving existing behavior where possible; do not treat a thin wrapper as the intended end state.
- Adapt MCTS to the same contract after the MinMax implementation establishes the contract and test expectations.
- Keep current engine selection/configuration behavior compatible unless a separate approved change explicitly revises it.

## Proposed implementation sequence

- [ ] **A. Inspect current runtime and tests.** Map current engine registry, worker dispatch, move formats, cancellation behavior, state snapshots, configuration, and failure paths. Resolve any mismatch between this plan and actual code before implementation.
- [ ] **B. Specify the contract.** Define lifecycle states, request/response shapes, canonical move schema, snapshot completeness, capability declarations, configuration validation, cancellation semantics, stale-result rules, and error categories.
- [ ] **C. Refactor MinMax.** Implement the contract while preserving move legality and existing difficulty behavior. Add or update contract-level tests.
- [ ] **D. Verify MinMax.** Test successful searches, cancellation, stale responses, invalid output rejection, resets/context changes, configuration validation, and failure reporting.
- [ ] **E. Adapt MCTS.** Implement the same contract and declare only capabilities it truly supports.
- [ ] **F. Verify cross-engine behavior.** Run shared contract tests against both engines, then integration/regression tests for worker transport, side/phase selection, special moves, game lifecycle changes, and fallback policy.
- [ ] **G. Update project documentation.** Record only implementation and verification results actually completed; keep this plan's status and `PLANS.md` aligned with reality.

## Acceptance criteria

- Both MinMax and MCTS satisfy the same mandatory contract.
- Snapshot inputs are isolated from authoritative mutable game state.
- All supported legal move types can cross the interface and are validated by the game core.
- Cancellation, completion, and stale-result rejection behave deterministically under rapid position/session changes.
- Unsupported optional capabilities are discoverable and never assumed.
- Configuration is validated and correctly scoped to engine, side, and phase.
- Errors are observable and recovery is explicit; a failed fallback cannot corrupt game state or force an illegal move.
- Shared contract tests pass for each engine, with integration tests covering the relevant game and worker lifecycle paths.
- Documentation describes verified behavior accurately and does not imply unrun tests passed.

## Open details to settle during contract specification

- Exact lifecycle state names and legal transitions.
- Exact transport message schema and how cancellation completion is acknowledged.
- The minimum complete position snapshot, including which history fields are truly rule-relevant.
- Canonical serialization for every Jester & Moat move type.
- Capability names and versioning policy, if contract evolution proves necessary.
- Error taxonomy, timeout ownership, and the explicit fallback configuration surface.

## Change log

- **2026-10-31:** Recorded the shared-engine architecture baseline and proposed implementation sequence from design discussion. No runtime code or tests were changed by this plan.
