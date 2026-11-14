# Party Insight and Match Experience Plan

Purpose: plan party-specific configuration records, event-log context and export, an in-game AI configuration overview, and optional match recaps and event expressions. This document records intended work and open design questions; it is not an implementation specification or evidence of runtime support.

## Status

**Status: In progress.** Stage A (party identity and configuration snapshot) is complete in PR #170. PR #169 already delivered the first part of stage C (the White/Black expression and information tabs); stage C remains incomplete. Stages B, D, and E have not started. This plan is independent of the Engine Configuration and Engine Extensibility plans. Each implementation stage requires its own explicit approval.

## Goal

Make each game understandable during play and inspectable afterward, and let the opponent communicate restrained, personality-consistent reactions to meaningful events:

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
4. **Keep presentation outside engine decision logic.** Recaps and expressions must not change legal moves, evaluation, search settings, timing, cancellation, or worker behavior. Any personality-driven decision effect belongs to the separate personality layer defined by Engine Extensibility; this plan consumes its observable events/state for presentation only.
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

The initial snapshot is taken when a new game is established, including a validated Board Editor position. It records the full engine configuration selected at that point. If global engine settings are changed while a party is active, append timestamped configuration snapshots to the party record; do not overwrite the start snapshot. This distinguishes the starting setup from later configuration changes without silently rewriting the party's history.

Inspect existing save/load behavior before deciding schema versioning, old-save compatibility, or migration. Do not assume that adding metadata to the current save format is backward-compatible. Legacy saves without party metadata must remain importable and must not be assigned invented historical configuration.

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

#### Agreed panel concept

Use two compact, slightly rounded, clickable tabs associated with the two sides:

- One tab sits immediately above the board and one immediately below it, following the board's width. The exact responsive placement on larger screens remains a design detail to verify.
- In the default **expression view**, each tab shows a restrained emoji and/or a short event-driven reaction.
- Clicking a tab switches that side to its **information view**. Switching views must not cause the board to jump or change position; reserve a stable area or otherwise preserve layout.
- Provide presentation settings for visibility (both sides, one side, or neither), the default view, emoji/text presentation, and compact or expanded information.
- Keep the tabs visually distinct by side while preserving board space and avoiding obstruction of the board or essential controls.

#### Information levels

Use the same basic information structure for every engine, while allowing engine-specific details where supported:

- **Basic view:** identify the side/party, show the active engine currently assigned to play for that side, its strength level, active personality, and a short personality description where available. Show the current phase as context.
- Do not list every engine assigned to future phases in the basic view. Keep it focused on the engine currently active for that side.
- **Further details:** allow the player to expand or open a deeper level for a fuller personality description, engine-specific advanced settings, and the side's assignments for other phases.
- The common structure should remain consistent across engines. Do not imply that every engine exposes the same advanced parameters.

When an engine actually changes for a side, show a small, temporary or otherwise unobtrusive handover indicator so the player notices the change. Do not show it for ordinary moves when the active engine remains the same.

### D. Factual match recap

Create a concise recap from recorded game events and state transitions, for example:

- Opening and phase transitions.
- Captures and other notable material changes.
- Check, checkmate, stalemate, or game-ending events where supported.
- Other meaningful variant-specific events.

Define a small, testable set of notable-event rules before expanding the recap. Distinguish observed facts from any later evaluative or interpretive language. Do not claim to know why an engine chose a move unless that information is explicitly and reliably provided.

### E. Personality reactions and visible expressions

As an optional presentation layer, allow White and Black to show short phrases, emojis, or restrained visual reactions in response to meaningful game events and the opponent's current personality state.

- Reactions are grounded in observable game events and the personality-state interface; they must not fabricate claims about hidden engine reasoning.
- The personality layer may use dynamic emotional state to influence decisions, but this plan only presents the resulting expression. It must not feed presentation choices back into move selection or engine evaluation.
- The player may see expressive cues without being shown an exact internal emotion value or status meter.
- Different personalities may react differently to the same event. Do not assume every engine/profile supports the same reaction vocabulary.
- Provide restrained defaults, optional/quiet behaviour where appropriate, and ensure expressions never obscure the board or essential controls.
- Present expressions through the agreed side tabs in the in-game AI overview; the tab's information view is a separate presentation state, not an engine/personality decision input.
- A motor handover indicator belongs to the presentation layer and is shown only when the active engine for that side actually changes.

This stage may be implemented independently of the recap, but should reuse the same event vocabulary and a deliberately defined personality-state boundary.

## Implementation progress

- **A — Completed in PR #170:** new games and validated Board Editor positions receive a schema-versioned party record with a stable ID, start timestamp, origin, variant identity/version, setup identity, and the full engine-configuration snapshot for both sides. The start snapshot is preserved; later persisted engine-configuration changes are appended as timestamped snapshots. Completion records include status, result, reason, and finish timestamp. Game save export/import carries the party record, validates imported metadata against the saved variant/setup, and continues to accept legacy saves without party metadata without inventing historical details. The dedicated tests are source-contract checks of initialization, snapshot/change handling, save/load wiring and validation, legacy compatibility, and completion metadata; they are not runtime integration or manual PWA tests.
- **C — Partial, already present:** PR #169 added the two side tabs and the first active-engine information view. This is existing implementation, not new work in this task. Configurable visibility/presentation, richer information levels, and engine-handover indication remain outstanding.
- **B, D, E — Not started.**

## Recommended implementation order

1. **A — Completed:** party identity and configuration snapshot are established.
2. **B — Next: Event log and export.** Make recorded games portable and independently understandable.
3. **C — Continue AI overview.** Reuse the party/configuration model to show the currently applicable assignments.
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
- The in-game overview uses two compact, clickable side tabs with expression and information views; changing views does not shift the board.
- Basic information uses a common structure across engines and shows only the engine currently active for that side; engine-specific details remain optional and accurately scoped.
- Visibility and presentation modes can be configured, including hiding either or both tabs.
- An unobtrusive handover indicator appears when a side's active engine changes, not on every move.
- Recap statements are grounded in recorded game events and do not invent engine reasoning.
- Expressions are event-triggered presentation only and cannot affect game rules or engine behavior.
- Automated tests cover party metadata, snapshot lifecycle, export/import compatibility, event association, and recap/expression triggers as each stage is implemented.
- Manual PWA verification is recorded separately and only after it has actually been performed.

## Out of scope

- Changes to engine algorithms, strength calibration, search strategy, or move ordering.
- A generalized analytics or telemetry service.
- Cloud sync, accounts, or online storage; the feature must remain offline-first.
- A claim that expressions reveal actual internal AI reasoning or expose an exact emotional state.
- Implementing the personality decision filter or dynamic emotional-state model; those belong to Engine Extensibility.
- A broad personality redesign or a requirement that every engine support the same personality features.
- Unrelated event-log cleanup or save/load refactoring.

## Related plans and references

- [Engine Extensibility Plan](ENGINE-EXTENSIBILITY-PLAN.md): the separate personality decision layer and dynamic in-game state that may drive expressions.
- [Position Evaluation and Sparring Quality Plan](POSITION-EVALUATION-PLAN.md): position-based competence measures and the broader goal of useful, engaging sparring.

- [Engine Configuration Plan](ENGINE-CONFIGURATION-PLAN.md): current per-side/per-phase engine, strength, personality, and advanced settings.
- [Engine Extensibility Plan](ENGINE-EXTENSIBILITY-PLAN.md): future engines, reusable personalities, variants, board configurations, the separate personality decision layer, and dynamic in-game state.
- [Undo/Redo and Save/Load Consistency](UNDO-REDO-SAVE-TESTING.md): save/load and history consistency baseline.
- [Engine Plugins](ENGINE-PLUGINS.md): engine integration and verification procedures.

## Change log

- **2026-11-09:** Created as a separate planned workstream for party identity/configuration, event-log context/export, in-game AI visibility, factual recaps, and optional event-driven expressions. No implementation is authorized by this plan alone.
- **2026-11-13:** Recorded the agreed in-game presentation concept: compact clickable White/Black tabs around the board, expression and information views, common basic information with engine-specific detail, active-engine-only summary, configurable visibility/presentation, stable board layout, and an engine-handover indicator.
- **2026-11-14:** Reconciled the plan with PR #169, which implemented the first portion of stage C, and PR #170, which completed stage A. Recorded the party-record lifecycle, snapshot and change-history behavior, outcome metadata, save/import validation and legacy compatibility. The dedicated A tests are source-contract checks; runtime integration and manual PWA verification are not claimed.
