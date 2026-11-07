# Engine Configuration Plan

Purpose: plan configurable engine assignments, strength settings, presets, and expanded random setup for each side and game phase. This is an implementation plan, not proof that the planned behavior exists.

## Status

**Status: Planned (2026-11-07).** Scope comes from the user's concept discussion. No implementation, detailed technical design, or delivery sequence has been approved beyond the work areas below. Inspect the current code and tests before implementation; the existing engine registry, protocol, settings, and UI are the starting point, not constraints that every future decision must preserve.

## Goal

Let players define which engine controls each side in each game phase, how strongly each selected engine plays, and how those choices are assembled or generated. Make common configurations quick to select while keeping individual settings straightforward to customize.

The same underlying configuration should support:
- predefined presets;
- manual customization;
- random generation.

Keep the model extensible for additional engines and future configuration dimensions without implementing those future dimensions in this plan.

## Configuration scope

The intended configuration unit is one **side × phase** combination:

| Dimension | Required behavior |
| --- | --- |
| Side | White and Black are configured independently. |
| Phase | Opening, midgame, and endgame can each have their own assignment. |
| Engine | Each side/phase can use the same engine as another assignment or a different one. |
| Strength | Each assignment can have its own strength setting, within the selected engine's supported capabilities. |

The plan must not assume that all engines expose identical strength controls. Define a clear user-facing strength concept while preserving engine-specific limits and translating settings safely at the engine boundary.

## Work areas

### 1. Configuration model and engine compatibility

- Inspect the current side/phase selectors, `engineConfig` persistence, engine registry, engine capabilities, request configuration, and fallback behavior.
- Define a validated configuration representation for every side/phase assignment.
- Preserve stable engine identifiers and explicitly handle engines that do not support a requested phase or strength option.
- Define defaults and migration behavior for existing saved browser settings.
- Keep phase detection policy separate from the selected engine configuration; changing an assignment must not silently redefine when a phase begins.
- Avoid making personality, board size, or a fixed number of engines mandatory fields.

### 2. Predefined presets and customization

- Provide predefined configurations that populate all applicable side/phase assignments.
- Retain the existing game difficulty choices as recognizable starting points where appropriate; decide their mapping only after inspecting current behavior.
- Allow the player to customize any engine or strength value without changing unrelated assignments.
- Make it clear when a preset has been customized.
- Provide a simple way to reapply a preset or restore defaults.
- Avoid requiring manual setup of every assignment before a game can start.

Illustrative preset composition (not a committed preset or engine roster):

| Phase | White | Black |
| --- | --- | --- |
| Opening | Opening engine / Medium | Opening engine / Medium |
| Midgame | Midgame engine / Strong | Midgame engine / Strong |
| Endgame | Endgame engine / Weak | Endgame engine / Weak |

The two sides may instead use different engines and/or strengths in any phase.

### 3. Random configuration

- Extend the existing random/dice experience beyond its current opening-related role.
- Support random selection of engine assignments and strength settings, including a complete side-by-phase configuration.
- Define the eligible engines, supported phases, strength ranges, and exclusions before generating a result.
- Ensure random generation uses the same validated configuration model as presets and manual customization.
- Preserve the existing random-opening behavior unless a separately approved change explicitly revises it.
- Make the generated result visible and editable before play; do not silently change a player's configuration during a game.

### 4. Two Player Pass behavior

- In **2 Player Pass**, no engine can be selected or assigned for either side.
- Hide or disable engine-selection controls in this mode.
- Disable **Play** and **Next** in this mode; they must not start or advance automated engine play.
- Ensure mode changes cannot leave stale engine actions or enabled controls behind.
- Verify this behavior in the UI and at the action/dispatch boundary, not only by hiding controls.

### 5. User experience

- Make selecting a predefined configuration the fast/default path.
- Keep detailed customization accessible without forcing it on players who choose a preset.
- Organize assignments consistently by side and phase.
- Clearly communicate unsupported engine/phase combinations and any effective fallback; avoid silent substitutions that misrepresent the chosen setup.
- Keep the interaction manageable on mobile screens.

### 6. Verification

- Add focused tests for configuration validation, defaults, persistence/migration, preset application, partial customization, random generation constraints, and mode-specific restrictions.
- Cover all side/phase combinations, including same-engine and mixed-engine assignments.
- Verify that the effective engine and strength passed to a search match the selected assignment.
- Verify that 2 Player Pass cannot invoke engine Play/Next behavior.
- Perform browser/mobile checks for the preset-to-customization flow and random configuration review.
- Update relevant engine documentation only with behavior actually implemented and verified.

## Future extension boundary

The configuration model should leave room for a future **personality** value per side/phase assignment, but personality is not part of this plan's implementation scope. Personality concepts and behavior remain in [Engine and Board Ideas](ENGINE-IDEAS.md).

Additional engines, reduced or alternative board sizes, and other future game variables are also not implementation requirements here. Revisit the model when those ideas are selected; do not prematurely freeze assumptions about engine count, board geometry, or the number of configuration dimensions.

## Dependencies and boundaries

- [Engine Interface Architecture Plan](ENGINE-INTERFACE-PLAN.md) is the completed engine-contract baseline. Reuse its validated request, capability, lifecycle, and worker boundaries; do not reopen that completed work without a concrete gap.
- [Engine Plugins](ENGINE-PLUGINS.md) records current engine integration, settings behavior, and outstanding verification. It is implementation reference material, not a duplicate checklist for this plan.
- [Engine and Board Ideas](ENGINE-IDEAS.md) remains the idea-stage register for personalities, alternative board configurations, and standard-chess opponents.
- Do not include strength calibration, bitboard migration, general engine algorithm work, or unrelated UI cleanup unless a specific dependency is demonstrated and separately approved.

## Acceptance criteria

- Every side/phase assignment can independently select a compatible engine and strength.
- The same engine can be reused across assignments, or different engines can be combined.
- A predefined preset configures the complete intended setup and remains editable.
- Changing one assignment leaves all other assignments unchanged.
- Existing settings have a defined, safe migration/default path.
- Random generation produces a valid, reviewable configuration through the same model.
- 2 Player Pass offers no engine selection and cannot use Play/Next for automated engine actions.
- The design remains open to future personality settings and additional engines without implementing them now.
- Tests and browser checks support all completion claims.

## Change log

- **2026-11-07:** Initial plan created from the user's configuration concepts. Personality, alternative board sizes, and future engine expansion are explicitly kept outside implementation scope.
