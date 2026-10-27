# Engine Plugins Test Suite

Purpose: manual test cases for engine plugin verification (worker dispatch, configuration, phase classification, strength calibration, regressions, and performance). Not automated; run in a browser with the console open.

## Prerequisites
- A modern browser (Chrome/Edge/Firefox) with console access.
- Either the single-file build (`jester-and-moat.html`) or the multi-file PWA served over HTTPS.
- For the PWA: ensure `sw.js` is updated and the cache is cleared (Hard reload or DevTools "Update" + "Empty Cache and Hard Reload").

## Setup
1. Open DevTools (F12) and the Console tab.
2. For persistence tests, clear `localStorage` first via `localStorage.clear()`.
3. For worker tests, open DevTools > Application > Service Workers and check the worker for `ai-worker.js`.

---

## 1. Worker Dispatch (Runtime Verification)

| ID | Setup | Action | Expected Result | Pass/Fail |
|---|---|---|---|---|
| WD-1 | Open single-file build | Select MCTS for White, start game vs AI (Black = MinMax) | Console shows `workerFn: 'mctsGetMove'` for White and `workerFn: 'getBestMove'` for Black |  |
| WD-2 | Same as WD-1 | Force invalid selector: run `postMessage({type:'move', workerFn:'invalid', ...})` from console | Worker logs explicit error, game continues with MinMax fallback |  |
| WD-3 | Multi-file PWA (GitHub Pages) | Same as WD-1 | Same dispatch behavior; `engines/mcts-engine.js` is precached |  |

**Notes:**
- Use the browser's Network tab to confirm `engines/mcts-engine.js` is loaded (PWA only).
- In the single-file build, the MCTS module is inlined, so no separate network request appears.

---

## 2. Configuration Behavior

| ID | Setup | Action | Expected Result | Pass/Fail |
|---|---|---|---|---|
| CF-1 | Fresh page (clear localStorage) | Set White = MCTS, Black = MinMax, phase = Midgame | Only White's midgame uses MCTS; other phases/Black use MinMax |  |
| CF-2 | Same as CF-1 | Reload page | Config persists (check `localStorage.getItem('engineConfig')`) |  |
| CF-3 | AI vs AI mode | Set both sides to MCTS | Both sides use MCTS for selected phases |  |
| CF-4 | 2-Player mode | Open engine selector for either side | UI disables selection or shows tooltip ("Not available in 2-Player mode") |  |

**Notes:**
- Verify `engineConfig` in localStorage contains the expected JSON.
- For CF-3, check the console for `workerFn` messages from both sides.

---

## 3. Phase Classification

| ID | Setup | Action | Expected Result | Pass/Fail |
|---|---|---|---|---|
| PH-1 | New game, ply 0 | Run `getGamePhase()` in console | Returns `"opening"` (ply < 10) |  |
| PH-2 | New game, make 9 moves | Run `getGamePhase()` in console | Returns `"opening"` (ply < 10) |  |
| PH-3 | New game, make 10 moves | Run `getGamePhase()` in console | Returns `"midgame"` (ply >= 10, pieces > 16) |  |
| PH-4 | Midgame, capture until <=16 total pieces | Run `getGamePhase()` in console | Returns `"endgame"` (pieces <= 16) |  |
| PH-5 | New game, no captures | Use board editor to add pieces until >=34 total | Run `getGamePhase()` → `"opening"` (pieces >= 34) |  |

**Notes:**
- Use `gameState.ply` and `gameState.pieces.length` in the console to verify counts.
- Thresholds: opening = ply < 10 OR pieces >= 34; endgame = pieces <= 16; else midgame.

---

## 4. Strength Calibration

| ID | Setup | Action | Expected Result | Pass/Fail |
|---|---|---|---|---|
| SC-1 | MCTS (~1200) vs MinMax (Hard) | Play 10 games (alternate White/Black) | MCTS wins >50% |  |
| SC-2 | MCTS Easy (200 playouts) vs MCTS Hard (2000 playouts) | Play 5 games | Hard wins >80% |  |
| SC-3 | MinMax Easy (depth 1) vs MinMax Hard (depth 3) | Play 5 games | Hard wins >80% |  |

**Notes:**
- Record results in a table: Game #, White Engine, Black Engine, Result (W/L/D).
- For SC-1, alternate colors to avoid first-move advantage bias.
- Adjust playout counts or depths if results deviate significantly.

---

## 5. Regression Tests

| ID | Setup | Action | Expected Result | Pass/Fail |
|---|---|---|---|---|
| RG-1 | Any position with pawn on 7th rank | Promote pawn to Jester | Jester moves like queen (up to 3 squares) |  |
| RG-2 | Position with adjacent friendly moved piece | Select Jester, attempt swap | Swap succeeds; Jester and target piece exchange positions |  |
| RG-3 | Moat on board | Move two enemy pieces onto same moat | Moat is destroyed (removed from board) |  |
| RG-4 | Castling eligible (king/rook unmoved, no pieces between) | Attempt king-side castling | King moves 2 files toward rook, rook jumps to king's start + 1 |  |
| RG-5 | Position with no legal moves | Force game state | Game ends, result declared (checkmate/stalemate) |  |
| RG-6 | Any position | Simulate worker crash via console | Fallback to MinMax, game continues |  |

**Notes:**
- For RG-2, the adjacent piece must have already moved (per Jester rules).
- For RG-3, use the board editor to place a moat and pieces.
- For RG-6, inject an error in the worker via `self.onmessage = () => { throw new Error('test'); }` (temporary override).

---

## 6. Performance & Responsiveness

| ID | Setup | Action | Expected Result | Pass/Fail |
|---|---|---|---|---|
| PF-1 | MCTS Hard (2000 playouts) | Start game on phone | Move returned in <5s |  |
| PF-2 | MinMax Hard (depth 3) | Same as PF-1 | Move returned in <1s |  |
| PF-3 | Rapid moves (AI vs AI) | Observe for 50 moves | No UI freeze, no console errors |  |

**Notes:**
- Use the Performance tab to measure time from click to move execution.
- For PF-3, check for memory leaks or growing worker message queues.

---

## Test Session Template

Copy this into a text file or note to record results:

```
Date: _______
Build: [single-file | multi-file PWA]
Browser: _______ (version: _______)
Device: _______

### Worker Dispatch
- WD-1: [Pass/Fail] Notes: _______
- WD-2: [Pass/Fail] Notes: _______
- WD-3: [Pass/Fail] Notes: _______

### Configuration Behavior
- CF-1: [Pass/Fail] Notes: _______
- CF-2: [Pass/Fail] Notes: _______
- CF-3: [Pass/Fail] Notes: _______
- CF-4: [Pass/Fail] Notes: _______

### Phase Classification
- PH-1: [Pass/Fail] Notes: _______
- PH-2: [Pass/Fail] Notes: _______
- PH-3: [Pass/Fail] Notes: _______
- PH-4: [Pass/Fail] Notes: _______
- PH-5: [Pass/Fail] Notes: _______

### Strength Calibration
- SC-1: [Pass/Fail] Results: _______
- SC-2: [Pass/Fail] Results: _______
- SC-3: [Pass/Fail] Results: _______

### Regression Tests
- RG-1: [Pass/Fail] Notes: _______
- RG-2: [Pass/Fail] Notes: _______
- RG-3: [Pass/Fail] Notes: _______
- RG-4: [Pass/Fail] Notes: _______
- RG-5: [Pass/Fail] Notes: _______
- RG-6: [Pass/Fail] Notes: _______

### Performance
- PF-1: [Pass/Fail] Time: _______
- PF-2: [Pass/Fail] Time: _______
- PF-3: [Pass/Fail] Notes: _______
```
