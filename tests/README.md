# Tests

Purpose: explain the automated test harness, its run command, current coverage, and remaining verification gaps.

## Run the current tests

Requires Node.js with the built-in test runner (Node 18 or newer recommended). No npm install is needed.

```sh
node --test tests/*.test.js
```

The engine contract suite evaluates canonical rule/search functions from `script.js` in a small VM context and skips browser UI startup. It also loads `engines/mcts-engine.js` to check the no-legal-moves contract. The PWA startup suite exercises the boot script and service worker with lightweight mocks; it does not require a browser or network access.

## Current coverage

- MinMax returns a legal move in a simple position and does not mutate the input state.
- MinMax and MCTS return `null` when no legal moves exist.
- Jester swap requires an adjacent friendly piece that has already moved; negative cases cover unmoved friends, enemies, non-adjacent pieces, and leaving the king in check.
- Unresolved/invalid AI promotion choices default to a queen.
- Queen, jester, rook, bishop, and knight promotion choices are applied correctly.
- Promotion can trigger redeployment of a destroyed moat, removing the pawn and restoring the moat state.
- Opening, midgame, and endgame phase thresholds.
- Kingside and queenside castling relocate both king and rook to the variant's configured squares. Negative cases cover moved kings/rooks, missing rooks, blocked paths, check, attacked transit squares, and kings off their original square. Loading a custom editor position resets castling movement flags for a king and rooks on their home squares.
- En passant is available only immediately after a double pawn move, removes the captured pawn, rejects invalid targets/captures, and is illegal when it exposes the king to check.
- A moat is destroyed when two opposing pieces occupy its three cells.
- AI worker setup returns safely to main-thread fallback when Blob workers are blocked; the selected engine is called with a cloned state.
- Worker runtime errors terminate the failed worker and retry the active request once through the selected engine on the main thread.
- Successful worker dispatch returns legal moves for both MinMax and MCTS.
- Unknown worker engine selectors return an explicit protocol error.
- White/Black engine and phase settings are saved and restored independently.
- MCTS configuration is limited to its selected phase, with MinMax in other phases.
- Missing, malformed, or invalid saved settings fall back to safe defaults; storage errors do not throw.
- Multi-file startup fetches both SVG sprites and loads MCTS before `script.js`.
- Single-file startup skips sprite fetches when the piece symbols are inline.
- Sprite-fetch and MCTS-load failures preserve the MinMax startup fallback.
- Service-worker registration waits for the window load event.
- The service-worker precache includes shipped app assets; install precaches before activation, and activation removes old app caches and claims clients.
- Initial moat placement starts after four moves per side: White places first, then Black; normal play resumes with White to move.
- Undo/redo restores complete move-log snapshots, moat-placement phase/turn, and terminal-game status.
- JSON save export/import roundtrips board state, history, clocks, moat state, move logs, and terminal status; malformed boards, pieces, and history-log snapshots are rejected, while legacy saves without per-history log snapshots remain importable.

## Remaining verification

This is a focused regression suite, not a complete rules suite or strength benchmark. Automated tests cover engine-setting persistence and validation, but browser rendering and real-browser/offline behavior still need browser verification. The worker and startup tests validate source-level contracts with mocks, not a live browser or deployed PWA. Runtime-error recovery is simulated; browser behavior remains unverified.
