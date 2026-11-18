# Party Insight and Match Experience Plan

Purpose: plan party-specific configuration records, event-log context and export, an in-game AI configuration overview, and optional match recaps and event expressions. This document records intended work and open design questions; it is not an implementation specification or evidence of runtime support.

## Status

**Status: In progress.** Stage A (party identity and configuration snapshot) is complete in PR #170. Stage B (party-scoped debug event log and self-contained event export) is implemented in PR #172. PR #169 delivered the initial White/Black expression and information tabs. C1 (saved visibility selection for both sides, White only, Black only, or neither) is complete in PR #173. C2 (phase-by-phase details and engine-declared settings) is complete in PR #174. C3 (temporary engine-handover indication) is complete in PR #175. D (party-scoped factual match events and recap) is complete in PR #176; E is in progress on `feat/party-insight-expressions`, with further expression-lifecycle and event-severity design recorded below. This plan is independent of the Engine Configuration and Engine Extensibility plans. Each implementation stage requires its own explicit approval.

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

**Implemented in PR #172:**

- Each debug log entry captures the active party ID when the event is recorded. Entries recorded without an active party remain explicitly unassigned.
- Filtered event exports are party-scoped; exporting one party does not include events from other parties or unassigned periods.
- The event export is a versioned JSON document with an explicit event-log export type, export timestamp, full party record, and filtered events. The embedded party record includes its start configuration, timestamped configuration changes, variant/setup identity, and outcome metadata, so the export is self-contained.
- Event timestamps, levels, categories, and messages are retained. Filtering does not mutate or delete the stored debug log.
- Legacy debug log entries without a party ID are normalized as unassigned. Imported legacy games without party metadata remain unassigned rather than receiving invented identity or configuration.
- Game-save JSON remains unchanged and distinct from the party event-log JSON export.

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
- Provide presentation settings for visibility (both sides, one side, or neither). Further presentation preferences can be considered separately.
- Keep the tabs visually distinct by side while preserving board space and avoiding obstruction of the board or essential controls.

#### Information levels

Use the same basic information structure for every engine, while allowing engine-specific details where supported:

- **Basic view:** identify the side/party, show the active engine currently assigned to play for that side, its strength level, active personality, and a short personality description where available. Show the current phase as context.
- Do not list every engine assigned to future phases in the basic view. Keep it focused on the engine currently active for that side.
- **Further details:** allow the player to open a separate details dialog showing the side's assignments for all game phases, the existing personality descriptions, and each engine's own declared settings with its labels and descriptions. Use the effective values for each phase; do not invent a shared settings schema or add new personality copy.
- The common structure should remain consistent across engines. Do not imply that every engine exposes the same advanced parameters.

When an engine actually changes for a side, show a small, temporary or otherwise unobtrusive handover indicator so the player notices the change. Do not show it for ordinary moves when the active engine remains the same.

### D. Factual match recap

Create a concise recap from recorded game events and state transitions, for example:

- Opening and phase transitions.
- Captures and other notable material changes.
- Check, checkmate, stalemate, or game-ending events where supported.
- Other meaningful variant-specific events.

Define a small, testable set of notable-event rules before expanding the recap. Distinguish observed facts from any later evaluative or interpretive language. Do not claim to know why an engine chose a move unless that information is explicitly and reliably provided.

#### Future enhancement: navigate from history and recap

When the game is paused, allow the player to select an entry in either the Moves history or the Recap event list and jump directly to the corresponding game position. The selected entry must lead to the position represented by that move or event, using the existing history/event state where available. This is a planned navigation capability only; it is not part of the current recap implementation.

### E. Personality reactions and visible expressions

As an optional presentation layer, allow White and Black to show short phrases, emojis, or restrained visual reactions in response to meaningful game events and the opponent's current personality state.

- Reactions are grounded in observable game events and the personality-state interface; they must not fabricate claims about hidden engine reasoning.
- The personality layer may use dynamic emotional state to influence decisions, but this plan only presents the resulting expression. It must not feed presentation choices back into move selection or engine evaluation.
- The player may see expressive cues without being shown an exact internal emotion value or status meter.
- Different personalities may react differently to the same event. Do not assume every engine/profile supports the same reaction vocabulary.
- Provide restrained defaults, optional/quiet behaviour where appropriate, and ensure expressions never obscure the board or essential controls.
- Present expressions through the agreed side tabs in the in-game AI overview; the tab's information view is a separate presentation state, not an engine/personality decision input.
- A motor handover indicator belongs to the presentation layer and is shown only when the active engine for that side actually changes.

#### Reaction lifecycle

- An event reaction is temporary, not a persistent comment. It must not remain visible indefinitely or carry over through unrelated turns.
- Support both elapsed-time and game-progress expiry. A reaction should clear when either its configured short time limit or its small move/ply limit is reached; exact thresholds are implementation details to tune after mobile testing.
- A newer meaningful event replaces the current reaction for that side. Low-significance routine events should not continually refresh or mask a more important reaction.
- When no event reaction is active, return to the side's restrained personality-appropriate idle/default expression.
- Expiry and replacement are presentation state only. They must remain consistent with the current game position when undo/redo or history navigation changes the active position.

#### Event families and emotional tone

Use observed, testable events to select reactions. Examples include:

- **Pressure or danger:** the side is in check, under a clearly detected tactical threat, or faces a materially dangerous position. Possible tones include worried, angry, sad, or sweating, subject to personality.
- **Tactical success:** a side creates a verified fork, pin, or comparable tactical threat against the opponent. The reacting side may show confidence, surprise, or satisfaction.
- **Material loss or gain:** a side loses or wins a piece. Reaction intensity should reflect the material significance, not treat every capture equally.
- **Milestones and outcomes:** pawn promotion and game victory may produce celebratory reactions; defeat may produce disappointment or sadness.

Forks, pins, and other tactical patterns must be based on explicit, testable board-state detection and the actual variant's movement/attack rules. Do not infer tactical success from the engine's hidden search, evaluation, or presumed intention. If reliable detection is not available for a position or variant, omit that reaction rather than fabricate it.

#### Significance and material impact

- Use the captured piece's actual type and the variant's applicable relative material value, where that value is reliably available.
- Scale the reaction by the significance of the loss or gain: losing a high-value piece should normally produce a stronger response than losing a low-value piece.
- Consider event context as well as piece value. A capture that leads to checkmate or a decisive tactical outcome may warrant a stronger reaction than an isolated capture.
- Do not hard-code a universal piece-value table or assume standard chess values across variants, engines, or future board configurations. If no trustworthy value exists, use a conservative event-severity fallback.
- Keep the strength of the visible reaction bounded and personality-dependent; do not expose a numeric emotion meter.

#### Personality and side isolation

- The same event may produce different tone and intensity for different personality profiles.
- Reactions belong to the side that experienced the event. A loss by White must not accidentally trigger Black's loss reaction, though Black may separately react to a verified success against White.
- Reuse the existing personality/event interfaces where they provide reliable information. Do not require every engine or future personality to support an identical reaction vocabulary.
- Keep event classification separate from personality wording/presentation so additional engines, personalities, variants, and board configurations can be added without redesigning the reaction system.

This stage may be implemented independently of the recap, but should reuse the same event vocabulary and a deliberately defined personality-state boundary.

## Implementation progress

- **A — Completed in PR #170:** new games and validated Board Editor positions receive a schema-versioned party record with a stable ID, start timestamp, origin, variant identity/version, setup identity, and the full engine-configuration snapshot for both sides. The start snapshot is preserved; later persisted engine-configuration changes are appended as timestamped snapshots. Completion records include status, result, reason, and finish timestamp. Game save export/import carries the party record, validates imported metadata against the saved variant/setup, and continues to accept legacy saves without party metadata without inventing historical details. The dedicated tests are source-contract checks of initialization, snapshot/change handling, save/load wiring and validation, legacy compatibility, and completion metadata; they are not runtime integration or manual PWA tests.
- **C — Completed:** PR #169 added the two side tabs and the first active-engine information view. **C1 — visibility selection:** completed in PR #173, with a saved setting for both sides, White only, Black only, or neither; hidden panels use `display: none` and do not leave empty layout space. **C2 — deeper information:** completed in PR #174; a separate dialog presents each phase's engine assignment, strength, existing personality description, and engine-declared effective settings. **C3 — engine handover:** completed in PR #175; a temporary marker appears only when a side's active engine ID changes, including after a current-configuration edit. New/imported games and hidden modes establish a fresh baseline.
- **B — Implemented in PR #172. D — Completed in PR #176:** a separate party-scoped match-event list records game start, phase transitions, captures, checks, terminal outcomes, and moat placement/destruction/redeployment. The list is stored in party metadata, validated on import, and defaults to empty for older party records. A Recap tab shares the move-history area with the Moves tab; only one view is visible at a time. Both views use the same Oldest first/Newest first order selector, defaulting to Newest first, with the recap rendered from a reversed copy so stored events remain unchanged. Initial moat placement is recorded once, only after both sides' final positions are set; later redeployments remain individual events. The factual event list does not use debug logging or infer engine reasoning. Per-position event/outcome snapshots now follow undo and redo, are included in game saves, and are validated on import. Legacy saves without these snapshots keep the imported recap on the current position; older undo positions fall back to the known game-start event and in-progress outcome rather than inventing event placement. Automated source-contract and runtime undo/redo tests cover recording, history synchronization, validation, persistence, and recap wiring. GitHub Actions run #817 passed all 213 tests. The user verified the final Moves/Recap view, sorting, combined initial moat event, Newest-first default, and 220 px history/recap area in the PWA. **E — In progress:** expressions derive from recorded party events and the active side's selected personality profile. This task adds a temporary reaction lifecycle: meaningful events expire after 5 seconds or 2 plies, whichever comes first; newer meaningful events replace earlier ones, and the restrained idle expression returns after expiry. Undo/redo continues to use the existing per-position party-event snapshots. Ordinary pawn promotions are recorded as party events (not moat redeployment) and receive a brief celebration. Tactical-pattern detection and material-significance scaling remain deferred because current code does not expose a sufficiently reliable, variant-aware tactical detector or a shared trustworthy piece-value contract. Expressions remain presentation-only and do not affect engine decisions. Manual PWA verification is pending.

## Recommended implementation order

1. **A — Completed:** party identity and configuration snapshot are established.
2. **B — Implemented in PR #172:** party-scoped event records and a self-contained, separately versioned JSON event export.
3. **C — Completed:** the in-game AI overview shows the active assignments and engine handovers.
4. **D — Completed:** the factual recap is built from recorded party events.
5. **E — In progress:** complete the presentation-only expression layer, including temporary reactions, verified tactical events, personality variation, and significance-scaled material reactions.

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
- While the game is paused, selecting a move-history entry or recap event can navigate directly to its corresponding game position.
- Expressions are event-triggered presentation only and cannot affect game rules or engine behavior.
- Automated tests cover party metadata, snapshot lifecycle, export/import compatibility, event association, and recap/expression triggers as each stage is implemented.
- Manual PWA verification is recorded separately and only after it has actually been performed.
- Event reactions expire after a short time limit or a small number of plies, whichever occurs first; a new meaningful event replaces the prior reaction, and an idle/default expression returns afterward.
- Tactical reactions such as fork and pin are shown only when the pattern is reliably detected from the actual variant's board rules; no hidden engine reasoning is inferred.
- Material-loss reactions scale with the captured piece's trustworthy relative value and event context, without assuming one universal value table across variants.
- Reactions are attributed to the correct side and vary by supported personality profile.

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
- **2026-11-16:** Added C1 on the feat/party-insight-display-settings task branch: configurable visibility for both side tabs, White only, Black only, or neither, persisted with the existing display options. PR #173 subsequently changed hidden panels to `display: none`, so they no longer leave empty layout space.
- **2026-11-17:** Completed C2 in PR #174 on the feat/party-insight-details task branch: a separate details dialog lists each side's engine assignment by phase and displays each engine's own declared settings and existing descriptions. No new personality copy or shared engine-settings schema is introduced.
- **2026-11-17:** Implemented C3 on the feat/party-insight-engine-handover task branch: a temporary side-specific marker appears only when that side's active engine ID changes. The active engine baseline resets for new/imported games and while panels are hidden; current engine-configuration edits refresh the overview immediately.

- **2026-11-17:** Began stage D on `feat/party-insight-match-recap`. Added party-scoped structured match events independent of the opt-in debug logger, backward-compatible save/import normalization, and a compact recap dialog. The initial event vocabulary covers game start, phase transitions, captures (including en passant through the captured-piece state), checks, terminal outcomes, and moat placement, destruction, and redeployment. Automated source-contract tests were added; manual PWA verification and CI were pending at this point in the work.

- **2026-11-17:** Added party event/outcome snapshots to the existing move history on `feat/party-insight-match-recap`. Undo restores the prior recap state; redo restores the removed events and terminal outcome. Game save/import validates and persists these snapshots. Legacy saves without the new history field retain their recap on the current position; earlier undo positions fall back to the known game-start event and in-progress outcome because historical event placement cannot be reconstructed. Automated source-contract coverage and a runtime undo/redo test were added. GitHub Actions run #790 passed all 213 tests; manual PWA verification remains pending.
- **2026-11-18:** Reworked the stage-D recap presentation on `feat/party-insight-match-recap`: Moves and Recap now share the existing move-history area as mutually exclusive views, removing the separate recap control and its extra layout space. The recap remains factual and party-scoped.
- **2026-11-18:** Extended the shared history order selector to the factual recap view. Oldest first/Newest first applies to both views; recap rendering reverses a copy of the stored event list and does not mutate saved events.
- **2026-11-18:** Consolidated initial moat placement into one factual recap event after both White and Black positions are final; individual redeployments remain separate. Changed the default history/recap order to Newest first while preserving any saved preference.
- **2026-11-18:** Added the planned paused-game navigation enhancement: selecting an entry in either Moves history or Recap should jump to its corresponding game position. This is a future item, not part of the current implementation.

- **2026-11-18:** Began stage E on `feat/party-insight-expressions`. Side expressions respond to the latest recorded match event at or before the current ply, with restrained defaults and a distinct `move_hunter` capture response. The existing personality assignment is read for presentation only; no engine decision or evaluation path is changed. Automated source-contract checks cover event grounding, side attribution, personality variation, and separation from engine logic.
- **2026-11-18:** Implemented the first reaction-lifecycle slice on `feat/party-insight-reaction-lifecycle`: event reactions expire after 5 seconds or 2 plies, whichever occurs first; a timer refreshes the panels when time expiry occurs, and ordinary panel renders enforce ply expiry and position restoration. Phase changes and initial moat placement do not mask meaningful reactions. Ordinary pawn promotions are recorded as party events and receive a brief celebration; moat redeployment is not classified as a piece promotion. Tactical-pattern detection and material-significance scaling remain deferred because the current code does not yet provide reliable variant-aware detection or a shared trustworthy value contract. Automated source-contract tests cover the lifecycle and promotion wiring; CI and manual PWA verification remain pending.
- **2026-11-18:** Expanded the stage-E design after PWA feedback: reactions should expire by a short elapsed-time limit or a small ply limit, whichever comes first; meaningful new events replace old reactions and idle expressions return afterward. Added design requirements for verified tactical reactions (such as fork and pin), celebration for promotion and victory, side-specific reactions, and material-significance scaling based on trustworthy variant-specific piece values. These are planned refinements, not claims about the current implementation.