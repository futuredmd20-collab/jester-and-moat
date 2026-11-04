# Layout and Piece Design Plan
Purpose: track design decisions, asset specifications, visual consistency, and implementation tasks for board layout, piece styling, and UI presentation.

**Status: In progress (2026-11-04).** The main implementation work is substantially complete: Classic, Flat, and Minimal piece designs; Classic King/Queen/Bishop adjustments; responsive Mobile/Desktop defaults; four piece-colour palettes; four board-colour palettes; independent persistence; swatches and appearance reset; and theme-aware moat/indicator accents. Remaining work is primarily visual specification and verification: audit all designs/surfaces and the 96 combinations, refine Jester/Moat states, and check board layout/spacing. Do not treat these remaining checks as completed.

## Goal and Scope
Ensure clear, high-contrast, and aesthetically cohesive visual presentation across desktop and mobile PWA, covering:
- **Piece sets:** Maintain and refine current sets (Classic `pieces.svg` via CSS variables and Staunton-inspired `pieces-flat.svg`), and define guidelines for potential new sets or thematic variants.
- **Jester & Moat iconography:** High-clarity visual distinction for the Jester (custom movement/swap piece) and Moat barriers (1x3 tiles, active/destroyed/redeployed states).
- **Surfaces:** Ensure uniform visual rendering across all surfaces: 10x8 gameboard, captured trays, pawn promotion modal, and board editor palette.
- **Layout & Responsiveness:** Clean scaling for the 10-column x 8-row grid, turn/clock indicators, and control drawers across desktop and mobile screens.
- **Out of scope:** Engine logic, minimax/MCTS algorithms, move validation rules, or save/load serialization.

## Current Repository State
- **Classic set:** `pieces.svg` with 7 shared symbols inherited via CSS custom properties in `pieces.css` (`--p-outline`, `--p-body`, etc.).
- **Flat set (Mobile):** `pieces-flat.svg` generated from separate SVGs; aspect ratios preserved via `--flat-aspect`.
- **Minimal set:** `pieces-minimal.svg` based on official newspaper/print diagram standard (Cburnett/FIDE) with matching 2D Jester.
- **Theme support:** Light and dark theme palettes defined in `style.css`; piece colours and board colours are separate settings with theme-specific variants.
- **Options integration:** Classic, Flat, and Minimal piece designs persist independently from piece-colour and board-style selections in `localStorage`.

## Unified Colour System
- **Piece design:** Preserve the three existing choices: Classic, Flat, and Minimal.
- **Piece colours:** Four independent identities: A (Ivory / Graphite), B (Ruby / Wine), C (Forest / Brass), and D (Porcelain / Charcoal).
- **Board colours:** Preserve Soft Stone, Warm Wood, and Cool Slate; add Graphite as a fourth option.
- **Theme:** Light, Dark, and Auto remain separate from both colour selections. Each palette needs a light- and dark-mode treatment.
- **Moats and indicators:** Moat ownership, selected-square, last-move, and legal-move accents follow the selected piece palette. Check retains its warning meaning; all indicators must remain legible across combinations.
- **Combinations:** 3 piece designs × 4 piece palettes × 4 board palettes × 2 display modes = 96 selectable combinations.

## Decisions to Preserve
1. **Vector-first:** All pieces remain SVG symbols embedded or referenced via `<use href="#p-${name}">`.
2. **Surface parity:** Any piece style update must render correctly in all four surfaces (board, captured trays, promotion modal, editor).
3. **Decoupled from engines:** Visual and layout changes must never touch engine contracts or worker dispatch logic.
4. **PWA / Precache discipline:** Updated sprites and styles must stay lightweight and included in the service worker precache without bloating the app.

## Checklist & Next Steps
- [ ] **1. Visual Audit:** Verify Classic, Flat, and Minimal sets in light/dark themes across mobile and desktop and across board, captured trays, promotion modal, and editor palette. Classic King, Queen, and Bishop mobile contrast has been checked; the complete audit remains open.
- [ ] **2. Jester & Moat Refinement:** Specify and verify the Jester silhouette and Moat barrier states (active, destroyed, and redeployed).
- [ ] **3. Board Layout & Spacing:** Audit the 10x8 board aspect ratio, coordinates, and drawer overlays on touch screens.
- [x] **4. Asset / CSS Updates:** Implement approved piece adjustments for Classic (`pieces.svg`, `pieces.css`), add `pieces-minimal.svg`, and establish responsive Mobile/Desktop defaults in `script.js` and `index.html`.
- [x] **5. Unified Colour System:** Add four piece palettes, the fourth board palette, independent persistence, visual swatches, appearance reset, and theme-aware board/piece colours for moats and indicators.
- [ ] **6. Verification:** Validate all 96 combinations (3 piece designs × 4 piece palettes × 4 board palettes × 2 display modes), indicator legibility, offline PWA precaching, and rendering across board, captured trays, promotion modal, and editor surfaces. Implementation of the palettes and controls is complete; this checklist item remains open until the combinations and surfaces are actually verified.
