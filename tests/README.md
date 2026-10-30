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
- Jester swap requires an adjacent friendly piece that has already moved.
- Unresolved/invalid AI promotion choices default to a queen.
- Queen, jester, rook, bishop, and knight promotion choices are applied correctly.
- Promotion can trigger redeployment of a destroyed moat, removing the pawn and restoring the moat state.
- Opening, midgame, and endgame phase thresholds.
- Kingside castling relocates both king and rook to the variant's configured squares.
- En passant is available after a double pawn move and removes the captured pawn.
- A moat is destroyed when two opposing pieces occupy its three cells.
- AI worker setup returns safely to main-thread fallback when blob workers are blocked.
- Multi-file startup fetches both SVG sprites and loads MCTS before `script.js`.
- Single-file startup skips sprite fetches when the piece symbols are inline.
- Sprite-fetch and MCTS-load failures preserve the MinMax startup fallback.
- Service-worker registration waits for the window load event.
- The service-worker precache includes shipped app assets; install precaches before activation, and activation removes old app caches and claims clients.
- Initial moat placement starts after four moves per side: White places first, then Black; normal play resumes with White to move.

## Remaining verification

This is a focused regression suite, not a complete rules suite or strength benchmark. Successful worker dispatch, settings persistence, browser rendering, and real-browser/offline behavior still need browser verification. The startup tests validate the relevant source-level contracts with mocks, not a live browser or deployed PWA.
