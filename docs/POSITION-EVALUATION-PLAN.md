# Position Evaluation and Sparring Quality Plan

Purpose: define a reusable, variant-aware library of chess-like problem positions and a multi-dimensional evaluation model for engine competence and human-facing sparring quality. This is a planning document, not an implementation specification or evidence of runtime support.

## Status

**Status: Planned.** The direction and core evaluation dimensions were agreed on 2026-11-10. No position-library or evaluation implementation has started. Detailed schemas, scoring methods, sampling rules, and implementation stages remain to be designed and approved.

## Goal

Evaluate engines from meaningful, reproducible positions without requiring every test to play through a complete game. The system should reveal specific strengths and weaknesses, support faster focused feedback, and help build opponents that are interesting to watch and useful for realistic human sparring.

The goal is not to maximize Elo or to make every engine play objectively optimal moves in every situation. Playing strength remains relevant, but it is one input to a broader view of competence, personality, and sparring quality.

## Agreed direction

- Build a shared library of reusable problem definitions and position types. A common problem should be adaptable to each supported variant; it does not require identical piece coordinates or an identical board layout across variants.
- Support several difficulty levels and multiple positive or equivalent solutions where a position allows them. Do not assume that all good continuations can be enumerated in advance.
- Evaluate the quality and consequences of decisions, not merely whether the selected move matches one expected answer.
- Separate offensive ability, defensive solidity, and initiative/momentum as evaluation dimensions. Preserve their individual results even when a combined summary is later useful.
- Treat material balance as evidence, not as a complete measure of advantage. Material sacrifices may be justified by tactical, positional, or initiative gains.
- Use positions to complement whole-game tests, not to claim that whole-game behaviour is fully covered by isolated positions.
- Keep technical engine competence distinct from intentional personality behaviour and from the human experience of sparring.

## Position sources and reuse

The library should support several complementary sources:

1. **Randomized legal positions:** generated through canonical game-state and rule logic, with controlled constraints on phase, material, side to move, king safety, and other relevant properties.
2. **Controlled positions:** deliberately constructed to test a specific problem, such as converting a material advantage, defending an exposed king, evaluating a sacrifice, maintaining an attack, or escaping pressure.
3. **Observed positions:** curated from real development games and previous tests, especially positions where engines missed tactics, failed to convert an advantage, lost initiative, or entered an undesirable repetition.

A reusable problem definition describes the strategic or tactical situation and the conditions that make it meaningful. A variant adapter or fixture-generation step supplies a legal position under that variant's rules. Variant-specific details such as Moat and Jester remain part of the position and its evaluation; they must not be silently ignored.

Every stored or generated fixture should retain enough provenance to reproduce and interpret it, including variant/version, position state, side to move, generation method/seed where applicable, problem identity, difficulty, and relevant constraints. Use the canonical game rules and state application; do not create a second rules implementation.

## Solutions and evaluation criteria

- A problem may have one clear best continuation, several equivalent continuations, or a broad set of strategically acceptable decisions.
- Store problem objectives and evaluation criteria separately from any example or known solution.
- Permit unexpected but sound solutions. A test must not reject a good move solely because it was absent from a manually authored answer list.
- Evaluate relevant continuations against plausible and strong replies, not only the immediate material change or a single shallow score.
- Distinguish a deliberate, strategically understandable risk from a legality error, protocol failure, or obvious tactical oversight.
- Where a position has no reliable objective label, report uncertainty and evidence rather than manufacturing a definitive answer.

The detailed scoring method, search horizon, reference policy, and criteria for equivalent or acceptable solutions are open design work. They must be defined before using the library for comparative strength claims.

## Evaluation dimensions

Keep at least these dimensions separately observable:

| Dimension | What it examines |
| --- | --- |
| **Offensive ability** | Creating and exploiting threats, finding tactical opportunities, evaluating sacrifices, and converting an advantage into a durable result. |
| **Defensive solidity** | Resisting threats, finding defensive resources, avoiding unsound commitments, and preventing a temporary attack from handing control to the opponent. |
| **Initiative and momentum** | Creating, retaining, losing, and regaining the initiative; distinguishing a temporary forcing sequence from a lasting advantage. |

Do not equate a material lead with a winning position. Do not equate having the initiative with having a durable advantage. A sacrifice may be good despite a temporary material deficit; a forcing sequence may be poor if it leaves the opponent with control or a stronger position.

A combined score or summary may be useful later, but it must not hide the separate dimension results or imply that a single aggregate fully describes playing quality.

## Phase-specific emphasis

The test mix should reflect the different demands of the phases without hard-coding today's phase thresholds as a permanent test architecture.

- **Opening:** meaningful opening strength may require much longer evolutionary exploration and broader strategic variation. A short isolated puzzle is not a substitute for testing development and transition quality.
- **Midgame:** use randomized and controlled legal positions to expose tactical, positional, offensive, and defensive decision-making across varied conditions.
- **Endgame:** use focused, chess-puzzle-like positions and controlled material/king-safety conditions. Many principles are comparable to ordinary chess, while Moat and Jester rules must remain active and may change the solution.

The library should support shared problem families across phases and variants where meaningful, while allowing a problem to declare applicability constraints where it is not valid.

## Relationship to whole-game testing and evolutionary training

Positions provide faster, more diagnostic feedback and can help identify where a motor is strong or weak. They do not establish that the motor can reach those positions, transition between phases, manage long-term plans, or maintain consistent behaviour over a complete game.

Keep whole-game matches as a complementary measure of openings, phase transitions, long-horizon decisions, and end-to-end outcomes.

The existing Evolutionary Engine Plan defines match-based baseline measurements and independent holdout acceptance against its frozen equal-weight and MinMax Medium references. This plan does not silently replace or relax those approved gates. Any future use of position-based fitness or any change to Stage 5 acceptance methodology requires an explicit design decision in the Evolutionary Engine Plan before implementation.

Elo may remain a supplementary comparative statistic where appropriate. It is not the product's primary objective or a sufficient measure of sparring quality.

## Sparring quality and personality

A technically strong engine is not automatically an engaging or useful opponent. The broader product goal is to provide opponents that are interesting to observe, can surprise and challenge a human player, and can support realistic practice.

Evaluate sparring quality separately from raw move strength. Relevant considerations may include:
- Whether the opponent creates meaningful decisions and varied challenges.
- Whether its style is recognizable and coherent.
- Whether intentional risk-taking and mistakes are understandable as personality behaviour rather than technical faults.
- Whether the opponent provides useful practice without needing to defeat a stronger external AI or maximize a rating.
- Whether the match is engaging to play and observe.

Some of these qualities require human observation and structured qualitative feedback; do not pretend they can all be reduced to a single automated score.

The personality architecture and visible match reactions are defined in the [Engine Extensibility Plan](ENGINE-EXTENSIBILITY-PLAN.md) and [Party Insight and Match Experience Plan](PARTY-INSIGHT-PLAN.md). This plan defines evaluation needs and boundaries; it does not implement those systems.

## Planned stages

1. **Define the problem model:** specify reusable problem identities, variant applicability, position metadata, difficulty, objectives, solution flexibility, and provenance.
2. **Define fixture generation:** specify safe legal-position generation, controlled constraints, seeds, curation, deduplication, and reproducibility.
3. **Define evaluation methodology:** define offensive, defensive, and initiative/momentum measures, response horizons, uncertainty, and how acceptable alternatives are recognized.
4. **Build a small diagnostic corpus:** include randomized, controlled, and observed positions across relevant phases and supported variants; validate the corpus manually before drawing strength conclusions.
5. **Pilot and compare:** test selected engines on shared fixtures, preserve dimension-level reports, and compare results under controlled search budgets and conditions.
6. **Integrate selectively:** decide whether and how position results should inform evolutionary training, regression checks, personality validation, and sparring-quality review. Keep whole-game evaluation where it measures something positions cannot.

Each stage requires repository inspection, a concrete scope, and explicit approval before implementation. Do not treat this plan alone as authorization to change code, run expensive experiments, or alter existing acceptance gates.

## Acceptance criteria for the future system

- The same problem definition can be instantiated for more than one compatible variant where its constraints permit.
- Every fixture is legal under the canonical rules and records its variant identity and reproducibility metadata.
- The model supports multiple acceptable solutions and does not depend on a complete hand-authored list of winning moves.
- Offensive ability, defensive solidity, and initiative/momentum remain separately reportable.
- Material balance and short-lived initiative are not treated as sufficient evidence of a durable advantage.
- Position-based results are clearly distinguished from whole-game results and from subjective sparring-quality observations.
- Reports state sample sizes, fixture coverage, search budgets, uncertainty, and known limitations.
- No existing evolutionary baseline, holdout rule, or engine-testing gate changes without an explicit decision and corresponding plan update.

## Explicit non-goals

- Replacing all whole-game matches with isolated position tests.
- Treating Elo as the sole objective or a complete measure of quality.
- Assuming every problem has one known correct move or that all acceptable moves can be listed in advance.
- Treating material advantage as equivalent to a forced win.
- Ignoring Moat, Jester, or other variant-specific rules when adapting a shared problem.
- Building a second rules engine or a general-purpose game framework.
- Implementing personality, emotional state, dialogue, or UI presentation in this plan.
- Changing the approved Evolutionary Engine Plan's baseline or holdout acceptance methodology implicitly.

## Related plans

- [Engine Extensibility Plan](ENGINE-EXTENSIBILITY-PLAN.md) — engine-independent personality architecture, dynamic decision behaviour, variants, and future engines.
- [Evolutionary Engine Plan](EVOLUTIONARY-ENGINE-PLAN.md) — offline evolutionary training, match-based fitness, baseline measurements, and holdout acceptance.
- [Party Insight and Match Experience Plan](PARTY-INSIGHT-PLAN.md) — match events, visible opponent reactions, and player-facing presentation.
- [Engine Testing Workflow](ENGINE-TESTING-WORKFLOW.md) — current contract, reduced-comparison, and full-calibration testing policy.

## Change log

- **2026-11-10:** Created the shared position-library and sparring-quality direction. Recorded multi-solution problem definitions, variant adaptation, separate offensive/defensive/initiative dimensions, phase-specific emphasis, and the boundary with whole-game and evolutionary validation.
