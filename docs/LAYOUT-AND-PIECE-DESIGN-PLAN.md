# Layout and Piece Design Plan
Purpose: track design decisions, asset specifications, visual consistency, and implementation tasks for board layout, piece styling, and UI presentation.

## Goal and Scope
Ensure clear, high-contrast, and aesthetically cohesive visual presentation across desktop and mobile PWA, covering:
- **Piece sets:** Maintain and refine current sets (Classic `pieces.svg` via CSS variables and Staunton-inspired `pieces-flat.svg`), and define guidelines for potential new sets or thematic variants.
- **Jester & Moat iconography:** High-clarity visual distinction for the Jester (custom movement/swap piece) and Moat barriers (1x3 tiles, active/destroyed/redeployed states).
- **Surfaces:** Ensure uniform visual rendering across all surfaces: 10x8 gameboard, captured trays, pawn promotion modal, and board editor palette.
- **Layout & Responsiveness:** Clean scaling for the 10-column x 8-row grid, turn/clock indicators, and control drawers across desktop and mobile screens.
- **Out of scope:** Engine logic, minimax/MCTS algorithms, move validation rules, or save/load serialization.

## Current Repository State
- **Classic set:** `pieces.svg` with 7 shared symbols inherited via CSS custom properties in `pieces.css` (`--p-outline`, `--p-body`, etc.).
- **Flat set:** `pieces-flat.svg` generated from separate SVGs; aspect ratios preserved via `--flat-aspect`.
- **Theme support:** Light and dark theme palettes defined in `style.css` and `pieces.css`.
- **Options integration:** User choice (Classic vs. Flat) persists in `localStorage` and precaches for offline PWA.

## Decisions to Preserve
1. **Vector-first:** All pieces remain SVG symbols embedded or referenced via `<use href="#p-${name}">`.
2. **Surface parity:** Any piece style update must render correctly in all four surfaces (board, captured trays, promotion modal, editor).
3. **Decoupled from engines:** Visual and layout changes must never touch engine contracts or worker dispatch logic.
4. **PWA / Precache discipline:** Updated sprites and styles must stay lightweight and included in the service worker precache without bloating the app.

## Checklist & Next Steps
- [x] **1. Visual Audit:** Verify current rendering of Classic and Flat sets in light/dark themes across mobile and desktop. (Classic King, Queen, and Bishop mobile contrast verified; this does not establish a full audit of every piece set and surface).
- [ ] **2. Jester & Moat Refinement:** Specify visual requirements for Jester silhouette and Moat barrier states.
- [ ] **3. Board Layout & Spacing:** Audit 10x8 board aspect ratio, coordinates, and drawer overlays on touch screens.
- [x] **4. Asset / CSS Updates (Classic):** Implement approved piece adjustments for King, Queen, and Bishop in `pieces.svg` and `pieces.css`.
- [ ] **5. Verification:** Validate offline PWA precaching and visual regression across all surfaces.
