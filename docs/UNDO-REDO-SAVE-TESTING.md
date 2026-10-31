Purpose: track regression testing and verification for undo/redo history and JSON save/load consistency; does not define general game rules or engine-plugin work.

# Undo/Redo and Save/Load Consistency

## Scope

Keep the saved current position, history snapshots, move-log snapshots, clocks, moat state, and terminal status coherent across undo/redo and JSON import/export. Preserve compatibility with older saves that omit fields introduced later, while rejecting explicitly malformed data rather than silently repairing it.

## Import rules

1. **Required structure:** a save must be an object with a valid board and side to move, plus a non-empty history array. Every history entry must be a valid state.
2. **Optional legacy fields:** if a supported field is absent, use its documented legacy default. Examples include phase `normal`, ply `0`, en-passant target `null`, empty moat/history/capture structures, and clocks initialized from the supplied initial-time setting.
3. **Provided values:** if a field is present, validate its type and range. Reject invalid phase names, negative/non-integer ply or move counts, invalid clocks, invalid coordinates, malformed maps/arrays, and invalid pieces; do not replace explicitly invalid values with defaults.
4. **Current position versus history:** the current state must match the latest history snapshot, except for clocks. Clocks may tick between moves, so the current state's clocks are authoritative; import copies those clocks into the latest history snapshot so redo does not restore stale clock values.
5. **Current log versus history log:** when per-history log snapshots are present, the current move log must exactly match the latest log snapshot. For legacy saves without those snapshots, preserve the current log and construct compatible snapshots using the legacy fallback.
6. **Atomicity:** parse and validate the entire save before applying any imported state to the live game. A rejected file must leave the active game untouched.
7. **Legacy compatibility:** absent optional fields and absent `historyMoveLogs` remain supported. Present-but-invalid values are not treated as missing.

## Checklist

- [x] Inspect current save normalization and identify silent fallbacks and missing cross-field consistency checks.
- [x] Define rules for current-state/history and current-log/history-log consistency, including the clock-ticking exception.
- [x] Add focused regression tests for mismatched state/log snapshots, invalid supplied fields, and legacy defaults.
- [x] Inspect the import handler: it calls `parseGameData` before assigning parsed values to live game state.
- [x] Verify the complete Node test suite in GitHub Actions for commit `6191f3c` (56 tests, 0 failures).
- [x] Perform browser checks for save → reload/import → undo/redo, clocks, moat transitions, and rejection of malformed saves.
- [x] Record browser observations separately from automated CI results.

## Browser verification

2026-10-31 — User verified the current branch through GitHub Pages. All four checks passed:

1. Save a game and reload/import it.
2. Undo/redo restores the move history and clocks correctly.
3. Moat transitions and state remain correct through undo/redo.
4. Malformed saves are rejected without disturbing the active game.

These are manual browser observations, separate from the automated GitHub Actions result above. No game code was changed for this verification.

## Verification boundary

The automated VM suite is not a substitute for browser validation. The checklist above records manual observations made against the running GitHub Pages app.
