HANDOVER.md — Project Memory & Game Rules
Purpose: stable facts about the game and how it is developed. Not for change history (HISTORY.md), deployment details (ARCHITECTURE.md), or agent session scratch (RESUME.md).
* Agents must keep this file tidy: preserve its existing structure and style, avoid introducing new formatting styles, and do not add unnecessary blank lines or spacing.

Game Context & Mechanics
* Board: 10 columns x 8 rows; rows 0 (Black back rank) to 7 (White), files A–J.
* Back rank: r j n b q k b n j r.
* Jester: Moves like a queen, up to 3 squares; can swap with an adjacent friendly piece that has already moved.
* Moats: 1x3 barriers placed after 4 moves each; two enemy pieces on a moat destroy it; pawn promotion may redeploy a destroyed moat.
* Castling: Variant-specific king-side and queen-side rules.
* Features: AI (minimax with alpha-beta), clocks, board editor, JSON save/load, auto-play, undo/redo, and SVG piece assets.

Development & Testing
* When there are tests worth maintaining, add a `tests/` folder at the project root. Include a `tests/README.md` explaining each test’s purpose, dependencies, and run command. Keep test tooling separate from the versioned game/PWA files.
* Record completed features, fixes, and testing decisions in HISTORY.md, not here.
