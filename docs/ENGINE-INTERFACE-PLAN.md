# Engine Interface Architecture Plan

Purpose: capture the proposed shared contract and staged implementation plan for internal Jester & Moat AI engines. This is a design plan, not an implementation specification or proof that the planned behavior exists in code.

## Status and scope

**Status (2026-11-01):** Implementation in progress — both MinMax and MCTS expose structured protocol-v1 search entry points and structured worker transport. The main-thread contract is now the single source serialized into workers, reducing protocol drift. Recent merged contract tests cover request/result identity, no-move outcomes, invalid protocol/engine identity, worker stale-result rejection, and selected lifecycle paths. The contract-test workflow has passed for the merged changes through PR #81. The user has manually verified the Pages build after the latest changes. MinMax evaluation and alpha-beta search now live in `engines/minmax-engine.js`, while shared rule helpers remain in `script.js`; MCTS still delegates to its existing search core; broader cross-engine lifecycle/fallback verification remains outstanding.

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

- [x] **A. Inspect current runtime and tests.** Map current engine registry, worker dispatch, move formats, cancellation behavior, state snapshots, configuration, and failure paths. Resolve any mismatch between this plan and actual code before implementation.
- [x] **B. Specify the contract.** Initial protocol v1 defines request identity/generation, isolated frozen position snapshots, depth/time limits, result statuses, stable error codes, and move-shape validation. Lifecycle cancellation has now been added at key game transitions by invalidating the active request and terminating the legacy worker. The contract defines identity-bound cancellation request/acknowledgment envelopes and distinct `cancelled`, `already-finished`, and `not-found` outcomes. MinMax worker search now yields periodically inside recursive alpha-beta search as well as between root branches, allowing cancellation during a single root branch; MCTS worker search yields between playouts and can acknowledge cooperative cancellation; each individual MCTS playout remains synchronous and bounded by its configured cap depth. Define lifecycle states, request/response shapes, canonical move schema, snapshot completeness, capability declarations, configuration validation, cancellation semantics, stale-result rules, and error categories.
- [ ] **C. Refactor MinMax.** In progress: MinMax exposes structured `search(request)`, the UI-coupled `getMove(gameState, side)` entry point is removed, and worker transport accepts structured requests and returns protocol identity/status/error fields for both engines. MinMax still delegates to legacy raw-move `getBestMove`, while MCTS still delegates to its existing MCTS search core. Preserve move legality and existing difficulty behavior; add contract-level tests.
- [ ] **D. Verify MinMax.** Test successful searches, cancellation, stale responses, invalid output rejection, resets/context changes, configuration validation, and failure reporting.
- [x] **E. Adapt MCTS.** Added a protocol-v1 `search(request)` entry point, stable `mcts` engine ID, structured worker dispatch, and structured-worker tests. The old `getMove`/`workerFn` path remains for compatibility.
- [ ] **F. Verify cross-engine behavior.** Run shared contract tests against both engines, then integration/regression tests for worker transport, side/phase selection, special moves, game lifecycle changes, and fallback policy.
- [x] **G. Update project documentation.** Status and index refreshed on 2026-11-01 to reflect merged contract-test coverage and the remaining implementation/verification gaps.

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

- **2026-11-01 — Deep MinMax cooperative cancellation:** The structured MinMax search now uses an asynchronous recursive alpha-beta path that periodically yields to the Worker event loop and checks cancellation inside a root branch, not only between root branches. The synchronous search path remains available for compatibility. Regression coverage verifies cancellation after repeated yields and confirms the input position is unchanged. Automated verification is pending.

- **2026-11-01 — Cooperative MCTS cancellation:** Structured MCTS Worker searches now yield between playouts, observe cancellation, and return the same identity-bound acknowledgment used by MinMax. One playout remains synchronous but is bounded by `capDepth`; hard Worker termination remains the safety fallback. Added regression coverage for cancellation and input immutability.\n\n- **2026-11-01 — PR #93 merged:** The main-thread `createEngineContract()` factory is now serialized into workers as the single protocol-v1 contract source, with a regression assertion against hand-maintained duplicate contract definitions. The merged engine-contract Actions workflow passed. This prevents contract drift but does not itself implement cancellation acknowledgment.

- **2026-10-31:** Recorded the shared-engine architecture baseline and proposed implementation sequence from design discussion.
- **2026-10-31:** Started implementation on `feat/engine-contract-minmax-2026-10-31`. Added protocol-v1 request/result helpers, an initial structured MinMax search entry point, worker-boundary result normalization and legality checks, and contract tests. Automated tests have not yet been run; MCTS migration, structured worker transport, lifecycle manager/cancellation acknowledgment, and complete MinMax refactoring remain outstanding.
- **2026-10-31:** Added lifecycle invalidation for setup/new-game, reset, undo, redo, and side switching. It terminates the legacy worker and invalidates pending request identity to prevent late replies from changing the current game. This is best-effort transport cancellation, not the planned explicit cancellation-acknowledgment protocol. Added a focused regression test; the suite has not yet been executed.

- **2026-10-31:** Continued after PR #62 was merged. Removed MinMax's UI-coupled legacy `getMove` entry point so the engine itself no longer reads `modeSelect`; search depth comes from the structured request. Added a regression assertion. This is a partial refactor only: worker dispatch still uses the legacy raw-move function, and this branch's CI result is pending.

- **2026-10-31:** MinMax worker transport now accepts a protocol-v1 request and returns a structured result with request identity, status, move, and classified search failure. Added a worker-level regression test for the structured response. Automated CI verification is pending; the underlying algorithm remains the existing `getBestMove` implementation, and MCTS still uses legacy transport.

- **2026-10-31:** MCTS now exposes `search(request)` under engine ID `mcts`, the worker dispatches structured requests to either engine by ID, and tests cover structured MCTS responses while retaining the legacy selector. CI verification is pending.

- **2026-10-31 — PR #66 merged and verified:** GitHub Actions run 105 passed all 67 tests (0 failures). The user then tested the merged build through GitHub Pages and reported no issues. This confirms the exercised MCTS structured-worker path; broader cross-engine/lifecycle/fallback coverage remains open, so checklist F is not marked complete.


- **2026-11-01 — PRs #68–#81 merged and verified:** Added focused engine-contract regression coverage for per-side engine phase selection, late worker replies after cancellation/crash fallback, protocol/engine/request/generation identity mismatches, result identity across statuses, request limit boundaries, MCTS and MinMax no-move results, and invalid structured requests. The engine-contract Actions workflow passed on the merged changes. The user reports manually testing the latest Pages build. This improves contract-level confidence but does not complete the planned manager-owned cancellation acknowledgment, full lifecycle integration, canonical special-move coverage across engines, or explicit fallback verification.


- **2026-11-01 — Cooperative cancellation implementation in review:** MinMax's Worker search now yields between root branches, checks a cancellation flag, and can acknowledge cancellation using the shared identity-bound envelope. The manager invalidates request identity immediately, sends a cancellation message, and retains hard termination as a 250 ms fallback. MCTS remains synchronous and relies on the hard-stop fallback when it cannot process the message promptly. Automated verification is pending.
