# Party Insight and Match Experience Plan

Purpose: plan party-specific configuration records, event-log context and export, an in-game AI configuration overview, and optional match recaps and event expressions. This document records intended work and open design questions; it is not an implementation specification or evidence of runtime support.

## Status

**Status: Planned.** No implementation work has started. This plan is independent of the Engine Configuration and Engine Extensibility plans. Each implementation stage requires its own explicit approval.

## Goal

Make each game understandable during play and inspectable afterward:

- Identify which game is being viewed or exported.
- Preserve the configuration that governed that game.
- Show the active AI setup for White and Black without requiring the player to reopen the settings drawer.
- Offer a concise, factual recap of notable game events.
- Optionally let each side express reactions through short text or emojis, without pretending to expose the engine's internal reasoning.

Keep these as three distinct concerns: **record keeping**, **configuration visibility**, and **match presentation**.

## Confirmed baseline

The following are observations from the repository at plan creation; re-inspect code and tests before implementation:

- The debug logger records timestamped events and can export filtered entries.
- The game save/export JSON currently contains position state, move log, history snapshots, and basic game flags. It does not include a complete snapshot of engine configuration.
- Engine configuration is stored separately and is independently configurable for White/Black and each currently supported phase. Assignments include engine, strength, personality, and engine-specific advanced settings.
- The current UI exposes engine assignments in the settings drawer.
- No unified party identity, in-game AI overview, match recap, or event-driven expression feature was identified in the inspected baseline.

The debug event-log export and the game save/export are separate existing paths. Do not conflate them or silently change their formats.

## Product boundaries

1. **Party record is authoritative for that game.** Later changes to global engine settings must not rewrite the recorded setup of a game that has already started.
2. **Record facts, do not infer them.** Configuration and event records must reflect values actually used or events actually observed.
3. **Show the active assignment.** The AI overview must distinguish the current game phase and the configuration applicable to each side. Do not display an unrelated future-phase assignment as if it were active.
4. **Keep presentation outside engine decision logic.** Recaps and expressions must not change legal moves, evaluation, search settings, timing, cancellation, or worker behavior.
5. **Respect engine differences.** Advanced settings are engine-specific. Do not force all engines into a shared list of tuning parameters.
6. **Keep the offline PWA usable.** Any stored party data and presentation must work without a network connection.

## Planned work

### A. Party identity and configuration snapshot

Design and implement a party-scoped record containing, at minimum:

- Stable party identifier and start timestamp.
- Variant and setup identity/version where available.
- Relevant game outcome and completion metadata.
- The engine configuration applicable to White and Black, including per-phase engine ID, strength, personality, and advanced overrides.
- A clear distinction between the configuration selected at game start and any configuration changes that may be permitted during an active game.

Before implementation, decide when the snapshot is taken and what happens if settings can change during a game. The recorded values must represent the configuration actually used, not merely the latest global settings at export time.

Inspect existing save/load behavior before deciding schema versioning, old-save compatibility, or migration. Do not assume that adding metadata to the current save format is backward-compatible.

### B. Event log and export

- Associate relevant events with the correct party identifier.
- Include a readable party header/metadata section in event-log exports.
- Include the party configuration snapshot or a stable, self-contained reference to it; an export must remain understandable when separated from local storage.
- Preserve timestamps, event categories, and existing filtering behavior where practical.
- Define how imported or older games with incomplete metadata are represented.
- Keep the game save/export format and debug event-log export format clearly distinguished, even if they share a party metadata model.

### C. In-game AI overview

Provide a compact White/Black overview in the game view, showing the assignment that applies now:

- Active engine.
- Active personality.
- Strength level.
- Current game phase.
- Relevant advanced settings, summarized without overwhelming the board.

The detailed settings drawer remains the place for editing and full configuration. The overview is primarily for quick visibility and should be responsive on mobile.

### D. Factual match recap

Create a concise recap from recorded game events and state transitions, for example:

- Opening and phase transitions.
- Captures and other notable material changes.
- Check, checkmate, stalemate, or game-ending events where supported.
- Other meaningful variant-specific events.

Define a small, testable set of notable-event rules before expanding the recap. Distinguish observed facts from any later evaluative or interpretive language. Do not claim to know why an engine chose a move unless that information is explicitly and reliably provided.

### E. Side expressions and thought bubbles

As an optional presentation layer, allow White and Black to show short expressions or emojis in response to defined game events.

- Expressions are triggered by observable events, not fabricated engine thoughts.
- Keep expression selection separate from move selection and engine evaluation.
- Reuse personality identity only where a deliberate mapping is defined; do not assume every engine personality automatically has dialogue or emotional behavior.
- Provide a restrained default behavior and avoid obscuring the board or essential controls.

This stage may be implemented independently of the recap, but should reuse the same event vocabulary where appropriate.

## Recommended implementation order

1. **A — Party identity and snapshot.** Establish the data model and its lifecycle first.
2. **B — Event log and export.** Make recorded games portable and independently understandable.
3. **C — AI overview.** Reuse the party/configuration model to show the currently applicable assignments.
4. **D — Factual recap.** Build summaries from reliable, recorded events.
5. **E — Expressions.** Add optional personality-flavored presentation after event semantics are stable.

The repository investigation at the start of each implementation stage must confirm the current architecture and identify the smallest safe scope. Reorder stages only when a concrete dependency requires it.

## Acceptance criteria

- Every newly started game has a stable identity.
- Its recorded configuration accurately represents the engine assignments used by both sides, including personality and advanced settings.
- Later changes to global configuration do not silently alter the historical party record.
- Game export and event-log export identify the same party and remain understandable when shared independently.
- Existing import/load behavior is deliberately preserved or versioned; compatibility behavior is covered by tests.
- The game view shows the active White and Black AI assignments and current phase accurately on mobile and desktop.
- Recap statements are grounded in recorded game events and do not invent engine reasoning.
- Expressions are event-triggered presentation only and cannot affect game rules or engine behavior.
- Automated tests cover party metadata, snapshot lifecycle, export/import compatibility, event association, and recap/expression triggers as each stage is implemented.
- Manual PWA verification is recorded separately and only after it has actually been performed.

## Out of scope

- Changes to engine algorithms, strength calibration, search strategy, or move ordering.
- A generalized analytics or telemetry service.
- Cloud sync, accounts, or online storage; the feature must remain offline-first.
- A claim that expressions reveal actual internal AI thoughts.
- A broad personality redesign or a requirement that every engine support the same personality features.
- Unrelated event-log cleanup or save/load refactoring.

## Related plans and references

- [Engine Configuration Plan](ENGINE-CONFIGURATION-PLAN.md): current per-side/per-phase engine, strength, personality, and advanced settings.
- [Engine Extensibility Plan](ENGINE-EXTENSIBILITY-PLAN.md): future engines, reusable personalities, variants, and board configurations.
- [Undo/Redo and Save/Load Consistency](UNDO-REDO-SAVE-TESTING.md): save/load and history consistency baseline.
- [Engine Plugins](ENGINE-PLUGINS.md): engine integration and verification procedures.

## Change log

- **2026-11-09:** Created as a separate planned workstream for party identity/configuration, event-log context/export, in-game AI visibility, factual recaps, and optional event-driven expressions. No implementation is authorized by this plan alone.
