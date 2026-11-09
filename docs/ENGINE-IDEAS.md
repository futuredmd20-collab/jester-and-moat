# Engine and Board Ideas

Purpose: preserve exploratory ideas for future engine, board, and opponent modes. This is an idea register, not an implementation plan, feature commitment, or statement of current capabilities. Cross-cutting architecture and sequencing are tracked in [Engine Extensibility Plan](ENGINE-EXTENSIBILITY-PLAN.md).

## Status

The engine-personality architecture direction is agreed. Pjäsjägaren (Piece Hunter) is implemented for MinMax and MCTS in opening, midgame, and endgame (PR #147); CI passed 158 tests and the user approved manual PWA verification. An evolutionary third engine with offline CLI training has been selected as the next engine direction and is tracked in [Evolutionary Engine Plan](EVOLUTIONARY-ENGINE-PLAN.md); its implementation details remain to be designed. Other personality examples and the remaining ideas below are exploratory unless explicitly noted.

## 1. Standard Chess Opponents and Strength Measurement

Explore a standard-chess mode on an 8×8 board that can play against external chess engines through an API.

Possible goals:
- Let the current Jester & Moat engines (such as MinMax and MCTS) play standard chess opponents.
- Use opponents with established ratings or known playing strength to estimate the engines' standard-chess strength.
- Keep standard-chess strength measurements separate from Jester & Moat ratings; the games and rules are different.

Open questions include the required standard-chess rules support, suitable opponent/API services, rating methodology, and whether this should be a separate mode or a test harness.

## 2. Alternative Board Sizes and Setups

Explore additional board configurations, including:
- **5×8:** a reduced-width board with fewer files.
- **8×8:** a standard-sized board with a Jester & Moat-specific or otherwise alternative setup/rule set.

This could become a separate play mode or an experimental environment for engine evaluation. The exact pieces, starting positions, rules, and relationship to the existing 10×8 game are undecided.

## 3. Engine Personalities — Future Extension

Explore a personality layer that adjusts how an engine plays without requiring a separate search engine for every personality. The agreed design direction is:

- Named, reusable global style profiles, selected independently per side × phase.
- Engine-declared profile support; each engine interprets a supported profile using its own behavior and algorithms.
- A mandatory `Default` profile supported by every engine. Unsupported non-default selections are rejected, not silently replaced.
- Personality selections are part of presets and saved custom configurations. Presets remain editable.
- Built-in profiles only in the first version; no user-created profiles or shared numeric style dimensions initially.

See [Engine Extensibility Plan](ENGINE-EXTENSIBILITY-PLAN.md) for the complete design decisions, acceptance gate, and implementation sequence. The remaining names and behavior examples below are illustrative only; they are not an approved profile roster.

Other illustrative personalities (not selected or approved):
- **Optimisten (Optimist):** favors attacking chances and accepts more risk.
- **Fegisen (Coward):** prioritizes king safety and avoids risky positions.
- **Materialisten (Materialist):** gives greater weight to material gains.
- **Strategen (Strategist):** favors long-term positional control and piece activity.
- **Berserken (Berserker):** seeks aggressive attacks and may accept sacrifices.
- **Opportunisten (Opportunist):** looks for weaknesses and mistakes to exploit.

A future design should distinguish personality from basic playing competence: a style preference should not automatically make an engine overlook an obvious win or choose a clearly losing move.

## 4. Evolutionary Engine — Selected Direction

The user selected an evolutionary engine as the next engine after MinMax and MCTS. The initial direction is deliberately modest:

- Evolve a bounded set of evaluation weights through automated matches; do not begin with neural networks or evolved complete programs.
- Train offline through a separate Node.js CLI workflow. Normal PWA gameplay loads a prepared, validated parameter package and does not run training.
- Start with small populations and limited generations, targeting modest local hardware such as the Mac mini M1.
- Keep training history and resume data outside the shipped PWA. JSONL is the initial candidate for run history; checkpoint format and safe resume behavior require design.
- Export selected results as small, versioned JSON parameter packages.
- Keep a future path open for in-game evolution, but do not implement it in the first version.

This is a selected direction, not a completed design or implementation. See [Evolutionary Engine Plan](EVOLUTIONARY-ENGINE-PLAN.md) for scope, staged work, and acceptance gates.

## Relationship Between the Ideas

These are separate but potentially complementary tracks:
- Standard chess concerns a different ruleset and opponent environment.
- Alternative boards concern board geometry and/or starting configurations.
- Personalities concern playing style layered over an engine and extend the per-side/per-phase configuration described in the Engine Configuration Plan.

They should not be treated as dependencies of one another. No work should begin from this document alone; select and scope an idea explicitly first.
