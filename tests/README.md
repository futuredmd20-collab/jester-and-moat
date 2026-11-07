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
- Rook, queen, and jester horizontal moves may pass through the same moat they start on; moves starting outside a moat stop on its first square. Sliding attack detection applies the same rule from the attacking piece's origin, including king-safety checks when a rook leaves its starting moat.
- AI worker setup returns safely to main-thread fallback when Blob workers are blocked; the selected engine is called with a cloned state.
- Worker runtime errors terminate the failed worker and retry the active request once through the selected engine on the main thread.
- Loading a valid saved game cancels any in-flight search for the previous position; a fresh search can run and stale worker responses are ignored.
- Successful worker dispatch returns legal moves for both MinMax and MCTS.
- MinMax and MCTS pass the same protocol-v1 conformance checks for completed legal results, no-move outcomes, request identity, immutable snapshots, and invalid protocol/engine requests.
- Jester swap, castling, double-pawn, en-passant, and promotion moves survive the contract envelope and resolve to canonical legal moves before application.
- Worker timeout fallback is verified for both MinMax and MCTS: the selected engine is retried once with a fresh request/generation, and late worker results are ignored.
- MCTS levels 1–3 have finite budgets; worker and synchronous search paths stop at their configured limits and return a legal best-so-far move. MinMax synchronous and cooperative searches also stop at their request deadline while preserving a legal best-so-far move.
- Worker requests carry engine-specific search budgets; worker results and main-thread fallback log engine, side, phase, request identity, elapsed time, and whether the search reached its budget. Main-thread retries are capped at 2 seconds.
- Unknown worker engine selectors return an explicit protocol error.
- White/Black engine and phase settings are saved and restored independently.
- MCTS configuration is limited to its selected phase, with MinMax in other phases.
- Debug logging records engine changes and phase transitions without per-move selection/dispatch noise; routine status messages are omitted while warnings and errors remain. The event export filters the complete stored log without deleting entries, and `?debug=1` remains the opt-in URL parameter.
- Missing, malformed, or invalid saved settings fall back to safe defaults; storage errors do not throw.
- Bottom-row coordinates retain extra clearance from pieces; editor black-piece silhouettes receive a light edge on the dark palette; moat ownership badges are larger and preview moats use stronger dashed outlines.\n- Piece design, piece-colour palette, board palette, and light/dark theme remain independent settings; all four piece palettes and all four board palettes have explicit theme coverage. Moat and move/selection accents blend the board profile with the selected piece palette while check retains its semantic warning colour. Swatches stay synchronized with the selectors, and appearance reset leaves gameplay settings unchanged.
- Multi-file startup fetches both SVG sprites and loads MCTS before `script.js`.
- Single-file startup skips sprite fetches when the piece symbols are inline.
- Sprite-fetch and MCTS-load failures preserve the MinMax startup fallback.
- Service-worker registration waits for the window load event.
- The service-worker precache includes shipped app assets; install precaches before activation, and activation removes old app caches and claims clients.
- Initial moat placement starts after four moves per side: White places first, then Black; normal play resumes with White to move.
- Undo/redo restores complete move-log snapshots, moat-placement phase/turn, and terminal-game status.
- JSON save export/import roundtrips board state, history, clocks, moat state, move logs, and terminal status. Import rejects malformed boards, pieces, phases, clocks, coordinates, mismatched current/history positions, and mismatched current/history logs. Missing optional legacy fields receive documented defaults; the latest history snapshot adopts current saved clocks because clocks tick between moves. Legacy saves without per-history log snapshots remain importable.

- Board-surroundings source contract: the material balance is reflected in a thin, square-cornered board frame using the active piece palette colours; mode, points, and move count share a compact information strip; status text uses reduced sizing.

## Remaining verification

This is a focused regression suite, not a complete rules suite or strength benchmark. Automated tests cover engine-setting persistence and validation, but browser rendering and real-browser/offline behavior still need browser verification. The worker and startup tests validate source-level contracts with mocks, not a live browser or deployed PWA. The 2026-11-04 mobile debug log recorded seven 15-second worker timeouts during opening, each followed by a main-thread retry; automated tests verify this fallback policy for both engine selectors but do not identify the cause of those device timeouts or establish mobile performance.
