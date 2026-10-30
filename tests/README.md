# Tests

Purpose: explain the automated test harness, its run command, current coverage, and remaining verification gaps.

## Run the current tests

Requires Node.js with the built-in test runner (Node 18 or newer recommended). No npm install is needed.

```sh
node --test tests/engine-contracts.test.js
```

The harness evaluates canonical rule/search functions from `script.js` in a small VM context and skips browser UI startup. It also loads `engines/mcts-engine.js` to check the no-legal-moves contract.

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

## Remaining verification

This is a focused regression suite, not a complete rules suite or strength benchmark. Successful worker dispatch, settings persistence, browser rendering, and multi-file/single-file startup still need dedicated tests or browser verification. The moat test covers promotion-triggered redeployment; the initial four-move moat-placement flow still needs dedicated coverage. Browser automation may be added later with Puppeteer or Playwright; neither is a current dependency.
