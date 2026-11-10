# Tests

Purpose: explain the automated test harness, its run command, current coverage, and remaining verification gaps.

## Run the current tests

Requires Node.js with the built-in test runner (Node 18 or newer recommended). No npm install is needed.

```sh
node --test tests/*.test.js
```

The engine contract suite evaluates canonical rule/search functions from `script.js` in a small VM context and skips browser UI startup. It also loads `engines/mcts-engine.js` to check the no-legal-moves contract. The PWA startup suite exercises the boot script and service worker with lightweight mocks; it does not require a browser or network access.

The separate engine-strength calibration runner has a short smoke test and a full tournament mode; see [Engine Strength Calibration](../docs/ENGINE-STRENGTH-CALIBRATION.md). Run `node scripts/engine-strength-calibration.js --self-test` to check its local harness. This smoke test is not a strength result.

## Current coverage

- MinMax returns a legal move in a simple position and does not mutate the input state.
- MinMax and MCTS return `null` when no legal moves exist.
- Worker and main-thread `NO_MOVE` responses classify checkmate and stalemate correctly for both engines; inconsistent no-move results and failed searches remain AI errors and do not end the game.
- Jester swap requires an adjacent friendly piece that has already moved; negative cases cover unmoved friends, enemies, non-adjacent pieces, and leaving the king in check.
- Unresolved/invalid AI promotion choices default to a queen.
- Queen, jester, rook, bishop, and knight promotion choices are applied correctly.
- Promotion can trigger redeployment of a destroyed moat, removing the pawn and restoring the moat state.
- Opening, midgame, and endgame phase thresholds.
- Kingside and queenside castling relocate both king and rook to the variant's configured squares. Negative cases cover moved kings/rooks, missing rooks, blocked paths, check, attacked transit squares, and kings off their original square. Loading a custom editor position resets castling movement flags for a king and rooks on their home squares.
- En passant is available only immediately after a double pawn move, removes the captured pawn, rejects invalid targets/captures, and is illegal when it exposes the king to check.
- A moat is destroyed when two opposing pieces occupy its three cells.
- Rook, queen, and jester horizontal moves may pass through the same moat they start on; moves starting outside a moat stop on its first square. Sliding attack detection applies the same rule from the attacking piece's origin.
- AI worker setup returns safely to main-thread fallback when Blob workers are blocked; the selected engine is called with a cloned state.
- Worker runtime errors terminate the failed worker and retry the active request once through the selected engine on the main thread.
- Loading a valid saved game cancels any in-flight search for the previous position; a fresh search can run and stale worker responses are ignored.
- Successful worker dispatch returns legal moves for MinMax, MCTS, and Evolutionary; Evolutionary uses its versioned equal-weight Default package and cooperative bounded worker search.
- MinMax and MCTS pass the same protocol-v1 conformance checks for completed legal results, no-move outcomes, request identity, immutable snapshots, and invalid protocol/engine requests.
- Jester swap, castling, double-pawn, en-passant, and promotion moves survive the contract envelope and resolve to canonical legal moves before application.
- Worker timeout fallback is verified for both MinMax and MCTS: the selected engine is retried once with a fresh request/generation, and late worker results are ignored.
- MCTS levels 1–3 have finite budgets; worker and synchronous search paths stop at their configured limits and return a legal best-so-far move. MinMax synchronous and cooperative searches also stop at their request deadline while preserving a legal best-so-far move.
- Worker requests carry engine-specific search budgets; worker results and main-thread fallback log engine, side, phase, request identity, elapsed time, and whether the search reached its budget. Main-thread retries are capped at 2 seconds.
- Unknown worker engine selectors return an explicit protocol error.
- Engine configuration uses schema version 2: general settings per side, sparse field-level phase overrides, deterministic inheritance, common Easy/Medium/Hard levels, and editable presets.
- MinMax, MCTS, and Evolutionary declare supported variant IDs and versions; configuration validation, main-thread dispatch, and structured worker dispatch reject unsupported variant IDs or versions with the stable `UNSUPPORTED_VARIANT` error. Evolutionary currently supports only the `Default` personality and the `jester-moat` v1 variant.
- The personality contract provides a global `Default` profile; MinMax, MCTS, and Evolutionary explicitly declare support for it. Personality IDs resolve from each side's general setting or a sparse phase override, and unsupported effective profiles are rejected during configuration validation and main-thread/worker dispatch with `UNSUPPORTED_PERSONALITY`.
- MinMax and MCTS expose engine-specific strength profiles and Advanced setting schemas; Advanced overrides win, while unknown engines, unsupported settings, invalid types, and out-of-range values are rejected.
- Effective engine settings are passed through protocol-v1 `config` to worker and main-thread searches; main-thread fallback budgets remain capped.
- Schema-v2 engine configuration persists and restores; schema-v1 and malformed `engineConfig` shapes reset to version-2 defaults without migration.
- 2 Player Pass hides engine controls and blocks automated Next and auto-play dispatch.
- Debug logging records engine changes and phase transitions without per-move selection/dispatch noise; routine status messages are omitted while warnings and errors remain. The event export filters the complete stored log without deleting entries, and `?debug=1` remains the opt-in URL parameter.
- Storage errors do not throw during engine configuration setup.
- Bottom-row coordinates retain extra clearance from pieces; editor black-piece silhouettes receive a light edge on the dark palette; moat ownership badges are larger and preview moats use stronger dashed outlines.\n- Piece design, piece-colour palette, board palette, and light/dark theme remain independent settings; all four piece palettes and all four board palettes have explicit theme coverage. Moat and move/selection accents blend the board profile with the selected piece palette while check retains its semantic warning colour. Swatches stay synchronized with the selectors, and appearance reset leaves gameplay settings unchanged.
- Multi-file startup fetches both SVG sprites and loads MCTS before `script.js`.
- Single-file startup skips sprite fetches when the piece symbols are inline.
- Sprite-fetch and MCTS-load failures preserve the MinMax startup fallback.
- Service-worker registration waits for the window load event.
- The service-worker precache includes shipped app assets; install precaches before activation, and activation removes old app caches and claims clients.
- Initial moat placement starts after four moves per side: White places first, then Black; normal play resumes with White to move.
- Undo/redo restores complete move-log snapshots, moat-placement phase/turn, and terminal-game status.
- JSON save export/import roundtrips board state, history, clocks, moat state, move logs, and terminal status. Import rejects malformed boards, pieces, phases, clocks, coordinates, mismatched current/history positions, and mismatched current/history logs. Missing optional legacy fields receive documented defaults; the latest history snapshot adopts current saved clocks because clocks tick between moves. Legacy saves without per-history log snapshots remain importable.
- Variant identity (`jester-moat` v1) and the selected `edges`/`center` setup are stored in position state and survive save/load and history snapshots. Legacy saves without these fields retain the current variant identity and use a null setup ID when the original setup cannot be recovered; unsupported variant IDs/versions and setup IDs are rejected.
- Evolutionary feature schema v1 extracts normalized semantic material, mobility, central activity, Jester mobility, and king-check values through injected canonical rule helpers; tests cover colour perspective, bounds, read-only extraction, and separate feature-cost reporting.
- Evolutionary population initialization, equal-weight control separation, mutation normalization, elitist generation replacement, balanced eight-fixture scheduling, fitness scoring, bounded Alpha-Beta search, and short real-rule matches against MinMax Medium and MCTS Medium.
- Evolutionary CLI parsing and operation contracts for `train`, `resume`, `evaluate`, and `export`; holdout evaluation fails closed until its baseline and statistical gates are approved.
- Evolutionary JSONL event schema and sequence validation, incomplete trailing-record recovery, atomic generation checkpoint writes, strict checkpoint/source/configuration validation, and resume-state consistency.
- Model export validation requires a completed run, a candidate-specific independent holdout pass against both reference floors, and explicit human approval.
- The dedicated evolutionary Actions workflow is manual-only, sequential, bounded to the initial 4-candidate/2-generation pilot, and uploads run history and checkpoints as separate finite-retention artifacts.

- Board-surroundings source contract: the material balance is reflected in a thin, square-cornered board frame using the active piece palette colours; mode, points, and move count share a compact information strip; status text uses reduced sizing.

## Remaining verification

This is a focused regression suite, not a complete rules suite or strength benchmark. Automated tests cover the inherited engine-configuration model, sparse overrides, effective validation, persistence reset, strength mapping, Advanced inheritance/engine changes, and Pass & Play restrictions. PR #157 CI passed all 182 tests (0 failures), including evolutionary trainer CLI/persistence coverage. Runtime-engine integration tests are being added in the current Stage 4 branch. The user completed manual PWA verification of inheritance, phase overrides, engine changes, Advanced settings, and persistence on 2026-11-09. The supplied runtime log records phase transitions, engine switches, worker search activity, and successful main-thread retry after a rejected worker move. The worker and startup tests validate source-level contracts with mocks, not every live-browser failure path. The 2026-11-04 mobile debug log recorded seven 15-second worker timeouts during opening, each followed by a main-thread retry; automated tests verify this fallback policy for both engine selectors but do not identify the cause of those earlier device timeouts or establish general mobile performance.
