# Engine Configuration Plan

Purpose: define and track configurable engine assignments, common strength levels, editable presets, and engine-specific advanced settings. Random configuration and future game dimensions are recorded as deferred work, not part of the current implementation.

## Status

**Status: In progress (2026-11-07).** The user approved the technical design and implementation using Workflow D. Implementation is underway on `feat/engine-configuration`. No merge is authorized.

## Goal

Let the player configure the engine and strength independently for every side and game phase, with optional engine-specific advanced overrides. Keep the configuration model extensible without implementing personalities, alternative boards, or other future dimensions now.

## Approved configuration model

The configuration unit is one **side × phase** assignment:

```js
{
  schemaVersion: 1,
  presetId: 'balanced',
  sides: {
    white: { phases: {
      opening: { engineId: 'minmax_legacy', strength: 'medium', advanced: {} },
      midgame: { engineId: 'minmax_legacy', strength: 'medium', advanced: {} },
      endgame: { engineId: 'minmax_legacy', strength: 'medium', advanced: {} }
    } },
    black: { phases: { /* same phase structure, independently configurable */ } }
  }
}
```

- White and Black are independent.
- Opening, midgame, and endgame are independent for each side.
- Every assignment selects an engine, a common strength, and optional advanced overrides.
- Common strengths are **Easy**, **Medium**, and **Hard**. Each engine maps them to its own algorithm settings.
- Each engine declares its own supported settings, types, defaults, ranges, labels, and descriptions.
- Advanced overrides take priority over the selected strength profile.
- Presets populate the same model and remain freely editable. A manual change marks the preset as custom.
- Phase detection only identifies the current phase; it does not select or mutate engine configuration.
- The existing Engine Contract `config` field carries the selected strength and effective engine settings.

## Validation and persistence

- Validate the complete configuration before saving and before dispatch.
- Reject unknown engines, unsupported settings, invalid types, and out-of-range values. Do not silently ignore unsupported input.
- Fill omitted advanced values from the selected engine's strength profile/defaults.
- Persist the versioned model in `localStorage` under `engineConfig`.
- No migration or backward compatibility is required. Old or invalid saved engine configuration is replaced with the new defaults.
- Preserve the existing main-thread fallback budget; fallback limits must override the normal configured time budget.

## Implementation scope

1. Add the versioned configuration model, defaults, presets, validation, and persistence.
2. Declare MinMax and MCTS strength profiles and engine-specific advanced settings.
3. Pass effective settings through the existing protocol-v1 `config` field to both worker and main-thread searches.
4. Replace the single engine/phase selectors with mobile-friendly side × phase controls and Advanced settings.
5. Keep phase detection separate from configuration selection.
6. In **2 Player Pass**, hide engine controls and prevent automated Play/Next actions at both UI and dispatch boundaries.
7. Add regression tests for all assignments, validation, presets, persistence reset, strength mapping, advanced overrides, worker/main-thread configuration, and 2 Player Pass.
8. Update engine documentation and this plan with verified implementation status.

## Deferred work

- Random generation of engine configurations is not part of this implementation. Preserve the existing random-opening/midgame behavior.
- Personality profiles, alternative or reduced board sizes, additional game variables, and future engines are not implemented now. The configuration model should not make them mandatory fields or assume a fixed engine count.

## Dependencies and boundaries

- [Engine Interface Architecture Plan](ENGINE-INTERFACE-PLAN.md) is the completed engine-contract baseline. Reuse its request, worker, lifecycle, and fallback boundaries.
- [Engine Plugins](ENGINE-PLUGINS.md) records the existing engine integration and verification gaps.
- Do not include strength calibration, bitboard migration, general engine algorithm work, or unrelated UI cleanup.

## Acceptance criteria

- All six side × phase assignments can be configured independently.
- MinMax and MCTS each map Easy/Medium/Hard to their own settings.
- Advanced settings are engine-declared, validated, editable, and override strength defaults.
- Presets populate all assignments and remain editable.
- Invalid engine IDs, unsupported settings, invalid types, and out-of-range values are rejected.
- Effective settings reach both worker and main-thread searches through the existing protocol.
- Old saved engine configuration resets safely to defaults; no migration is implemented.
- 2 Player Pass exposes no engine controls and cannot trigger automated Play/Next actions.
- Tests and browser checks support completion claims. Browser/mobile checks are recorded only after they are performed.

## Change log

- **2026-11-07:** User approved nine design decisions: independent side × phase assignments; common Easy/Medium/Hard levels; engine-declared Advanced schemas; Advanced overrides win; editable presets; reuse of protocol `config`; strict validation; no migration; phase detection remains separate.
- **2026-11-07:** Implementation started on `feat/engine-configuration` under Workflow D. Random engine configuration remains deferred.
