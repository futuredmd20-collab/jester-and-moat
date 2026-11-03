# Bitboard Engine Evaluation and Migration Plan

## Purpose

Evaluate whether a bitboard representation can improve MinMax and/or MCTS search performance on Jester & Moat's 8×10 board, then introduce it only where measurements demonstrate a worthwhile gain.

This is an engine-internal optimization plan. It does not propose replacing the game's canonical board model.

## Status

**Status: Planned (2026-11-03).** Baseline profiling and representation evaluation have not started.

## Current architectural constraints

- The game state uses an 8-row × 10-column `state.board` matrix. A square is addressed by row and column; each occupied cell contains a piece object.
- MinMax search consumes the shared rule/state helpers injected from `script.js`. MCTS also relies on those canonical helpers for legal moves and state transitions.
- The board has 80 squares, so a single 64-bit bitboard cannot represent the full position.
- Jester swaps, moats, castling, en passant, promotion, and piece `moved` state must retain their existing semantics.
- The current matrix remains authoritative for gameplay, UI, editor, history, and save/load unless a separately reviewed architectural decision says otherwise.

## Goals

1. Establish reproducible baseline measurements on representative positions and target mobile hardware.
2. Compare practical 80-square bitboard encodings in the actual JavaScript runtime.
3. Identify which operations dominate search time before choosing an optimization target.
4. Prototype an engine-side representation with exact conversion to and from the canonical game state.
5. Prove behavioral equivalence before considering broader integration.
6. Keep a measured fallback path and avoid making the game depend on bitboards.

## Non-goals

- Rewriting the canonical game rules or replacing `state.board`.
- Changing save-game formats, public engine protocol, move object shape, or UI/editor data.
- Assuming bitboards are faster merely because they are common in 8×8 chess engines.
- Rewriting all move generation or both engines before profiling identifies a benefit.
- Introducing WebAssembly or native code as part of this plan.

## Proposed representation options

The square index is `r * 10 + c`, covering indices 0–79. Evaluate at least these candidates:

| Candidate | Representation | Considerations |
| --- | --- | --- |
| BigInt | One 80-bit value per bitboard | Simple shifts and masks; runtime cost and allocation behavior must be measured. |
| Word array | Three 32-bit words per bitboard (96 available bits) | Uses JavaScript 32-bit bitwise operations; requires explicit cross-word shifts/masks and careful unsigned handling. |
| Paired words | A small fixed set of numeric words | Include only if it gives a simpler or faster measured implementation than the other candidates. |

The prototype should derive occupancy and per-piece/per-color sets from the canonical board. Piece metadata such as `moved`, turn, ply, moats, castling rights, and en-passant state must remain available alongside the bitboards; bitboards alone do not encode the complete game state.

## Work sequence

### 1. Baseline and profiling

- Select representative opening, middle-game, endgame, moat, and Jester-swap positions.
- Measure MinMax and MCTS independently at fixed search limits.
- Record elapsed time, visited nodes or completed playouts, legal-move generation cost, state-clone cost, and peak memory/allocation indicators where available.
- Repeat measurements on a representative mobile browser/device and a desktop reference.
- Record warm-up procedure, run count, position fixtures, engine settings, and device/browser details so results can be reproduced.

**Exit:** A baseline report identifies the dominant costs and provides repeatable comparison fixtures. If bit manipulation is not a meaningful bottleneck, stop or narrow the prototype to the actual bottleneck.

### 2. Representation prototype

- Implement a small isolated converter from the 8×10 matrix to each candidate encoding.
- Implement reverse reconstruction or a comparison view sufficient to verify every square and piece set.
- Cover all 80 indices, word-boundary crossings, empty/full words, and unsigned bit behavior.
- Keep special-rule metadata outside the bitboards and document its ownership.
- Benchmark conversion and basic operations separately from full search.

**Exit:** One candidate is selected based on correctness, maintainability, and measured runtime on target mobile hardware. If none wins clearly, stop without integrating it.

### 3. Select one engine operation

Use profiling to choose a narrow first target, such as occupancy queries, piece-set iteration, attack/target masks, or evaluation scans.

- Prefer a read-only accelerator that leaves canonical move application and legality decisions unchanged.
- Do not duplicate special-move rules in the prototype.
- Keep a straightforward matrix-based implementation as a reference for differential tests.

**Exit:** The targeted operation shows a repeatable improvement without changing observable game behavior.

### 4. Differential correctness tests

- Compare matrix-derived and bitboard-derived occupancy and piece sets for generated and hand-authored positions.
- Compare the selected operation's results against the matrix reference.
- Include all piece types and colors, edge files, all three bitboard word boundaries, and sparse/dense positions.
- Include Jester swaps, moat changes, castling, en passant, promotion, and moved-state cases wherever the selected operation touches or depends on them.
- Verify conversion round trips and that search snapshots/live game state are not mutated unexpectedly.

**Exit:** Differential tests pass for deterministic fixtures and randomized legal positions. Any mismatch blocks integration.

### 5. Controlled engine integration

- Integrate only the proven operation behind a narrow internal interface.
- Keep the canonical matrix state and legal move objects as the boundary contract.
- Ensure worker serialization and main-thread fallback can use the same implementation without relying on unsupported runtime features.
- Validate that returned moves still pass the canonical legal-move matcher.
- Run the full engine contract suite and relevant game-rule regression tests.

**Exit:** Existing behavior and contracts remain intact; no persistence, UI, or worker protocol changes are required without a separate plan/review.

### 6. Performance verification and decision

- Repeat the baseline benchmark with identical positions, settings, browser/device, and run procedure.
- Compare median and spread, not only the best run.
- Report per-engine results; do not generalize a MinMax gain to MCTS or vice versa.
- Include conversion overhead and any memory/allocation trade-offs.
- Retain the optimization only if the improvement is repeatable and material on target mobile hardware, with no unacceptable regression elsewhere.

**Exit:** Document the measured result and make an explicit keep/revert decision. If the gain is negligible, revert the prototype integration and retain only useful benchmark/test infrastructure if justified.

## Risks and safeguards

| Risk | Safeguard |
| --- | --- |
| 80-square indexing or cross-word bugs | Boundary-focused tests for indices 31/32, 63/64, and 79; round-trip checks. |
| JavaScript BigInt or typed-word operations are slower on target phones | Benchmark candidate encodings on actual target browsers before selecting one. |
| Special rules drift between two rule implementations | Keep canonical move generation/application authoritative during the initial work. |
| Bitboards become stale after a move or clone | Define explicit construction/update ownership; test snapshots and repeated transitions. |
| Worker and main-thread behavior diverge | Exercise both execution paths and retain one shared engine-side implementation. |
| Conversion cost erases search gains | Measure conversion separately and end-to-end. |

## Verification checklist

- [ ] Baseline fixtures and benchmark procedure are documented.
- [ ] Candidate encodings are compared on target mobile hardware.
- [ ] 80-square conversion and reverse checks pass.
- [ ] Word-boundary and unsigned-bit tests pass.
- [ ] Differential tests pass against the matrix reference.
- [ ] Special-rule regression tests pass for affected operations.
- [ ] Worker and main-thread paths are verified.
- [ ] Full relevant test suite passes.
- [ ] Before/after performance results and keep/revert decision are recorded.

## Progress

- [x] Plan created and indexed.
- [ ] Baseline profiling.
- [ ] Encoding prototype and comparison.
- [ ] Narrow operation prototype.
- [ ] Differential verification.
- [ ] Controlled integration.
- [ ] Final performance decision.
