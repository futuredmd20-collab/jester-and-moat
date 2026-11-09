# Engine Plugins

Purpose: record design decisions, repository implementation, verification gaps, and remaining work. Source presence or a merged PR is not proof of runtime behavior.

## Status

**Status: In progress (2026-11-09).** The current integration and contract-test pass remain complete; PR #119 (including PR #120) is merged. PR #150 is merged and implements schema-v2 inherited engine configuration; GitHub Actions run #594 passed all 162 tests (0 failures), and the user completed manual PWA verification. The supplied runtime log confirms phase transitions, engine switches, worker searches, and main-thread recovery after a rejected worker move. The calibration runner and methodology are available. A previous run covering all 15 pairings with 20 games per pairing was completed and used to make adjustments (user-confirmed); the separate CI matrix in PR #133 was cancelled and produced no results. Full calibration is now an optional, manually requested measurement—not a prerequisite for continued engine development. Other follow-up areas remain parked; unverified browser/device behavior is not marked as passed.

## Goal and contract

Each side (White/Black) has one general engine, strength, personality, and Advanced configuration. Opening, midgame, and endgame inherit those values unless a phase stores a sparse field-level override. MinMax is the default for both sides; MCTS is available as an alternative.

```js
{
  schemaVersion: 2,
  sides: {
    white: {
      general: { engineId, strength, personalityId, advanced },
      phases: { opening: {}, midgame: { strength }, endgame: { engineId, advanced } }
    },
    black: { general: { ... }, phases: { opening: {}, midgame: {}, endgame: {} } }
  }
}
```

- Common strength levels are Easy, Medium, and Hard. Each engine declares its own strength profiles and translates the common level into its own search settings.
- Each engine declares its supported Advanced settings, including type, default, range, label, and description. Explicit Advanced overrides take priority over strength-profile values.
- Presets populate both sides' general settings and leave phase overrides empty. Manual changes mark the configuration as custom.
- Phase overrides are sparse and field-specific: changing engine, strength, or personality does not replace the other inherited fields. Removing an override restores inheritance.
- Advanced settings inherit from the general engine. A phase-level engine override starts from that engine's strength profile/defaults and uses only its own Advanced overrides; it never inherits Advanced values belonging to the general engine.
- The implementation uses `localStorage` key `engineConfig` with schema version 2. Version-1 and malformed configurations reset to safe version-2 defaults; no migration is performed.
- Effective strength and settings travel through the existing protocol-v1 `config` field. The worker and main-thread search paths validate engine-specific settings; main-thread fallback time limits continue to take precedence.
- Phase detection remains `getGamePhase()` in `script.js`: opening if ply < 10 OR total pieces >= 34; endgame if total pieces <= 16; otherwise midgame. It identifies the phase only; it does not select or modify an assignment.
- In 2 Player Pass, engine controls are hidden and automated Next/auto-play actions are blocked.
- Engine Configuration was merged in PR #138 at `bbc0357`. Its engine-configuration CI workflow passed, and the user completed manual PWA verification of the configuration features. Edit Board edge cases are tracked separately; they are not an engine-plugin verification result.
- MCTS strength profiles retain the current 200/700/2000 playouts, depth caps 10/14/18, temperatures 0.35/0.15/0.00, and 2.5s/5s/10s budgets. ELO-like labels remain estimates, not calibrated ratings.
- Strength-calibration tooling and methodology: [Engine Strength Calibration](ENGINE-STRENGTH-CALIBRATION.md). Full calibration is manual and on request; it is not a prerequisite for this configuration work.
- Random engine configuration remains deferred. Preserve the existing random-opening/midgame behavior. Personalities, alternative boards, and other future dimensions are tracked in [Engine Extensibility Plan](ENGINE-EXTENSIBILITY-PLAN.md), not in this integration plan.

## Implementation and verification status

| Area | Present in repository / source-reviewed | Still unverified or remaining |
| --- | --- | --- |
| Plugin setup | Registry, MinMax adapter, MCTS module and dispatch were exercised in manual browser play; both engines ran without visible errors. | These checks do not establish exhaustive engine correctness. |
| Side/phase UI | PR #138 delivered the earlier side × phase configuration and its PWA verification. PR #150 replaces that assignment model with schema-v2 general settings per side and sparse field-level phase overrides; CI run #594 passed 162 tests, and the user completed manual PWA verification of inheritance, overrides, engine changes, Advanced settings, and persistence. | Broader engine/phase policy validation and untested failure paths remain separate follow-up work. |
| Loading/build | MCTS script loading, service-worker precache and version alignment (PR #23); loading fix (PR #24); single-file builder embeds MCTS before `script.js`. | Exercise multi-file and built single-file pages. If MCTS fails to load on the multi-file page, startup warns and keeps board/MinMax available; MCTS selection falls back to MinMax. Confirm this recovery path in a browser. |
| Worker dispatch | The reviewed game log showed matching engine-to-worker dispatch and 108 worker replies, with no obvious worker/engine errors. Offline behavior was also verified on the user's Android: after an online load, the app reopened in airplane mode and MCTS was selectable and made a move. | Browser verification of MCTS load failure, worker-construction fallback and induced worker-runtime recovery remains outstanding. |
| Search budgets and responsiveness | PR #120 adds finite MCTS budgets for levels 1–3 (2.5s/5s/10s), request-scoped MinMax budgets (3s/6s/10s), best-so-far legal moves on budget expiry, and a 2s cap for main-thread fallback. Engine-contract workflow #364 passed 128 tests (0 failures). | Real-device/browser timing and responsiveness have not been re-verified. The mobile log's seven 15-second worker watchdog timeouts remain unexplained. |
| Phase policy and ratings | Thresholds and provisional MCTS presets/labels are defined. A reproducible, colour-balanced pairwise calibration runner and methodology are available. A previous full 15-pair × 20-game run and resulting adjustments are user-confirmed. | No current universal Elo rating is established. Further full calibration is optional and should be run only on request. |

## Decisions to preserve

- Keep one general engine/strength/personality/Advanced configuration per side, with sparse, field-level phase overrides.
- Use common Easy/Medium/Hard strength names, translated by each engine's own profiles.
- Engine-declared Advanced overrides win over strength defaults; unsupported settings are rejected.
- Presets are editable profiles, not separate configuration systems.
- Schema-v1 `engineConfig` data is reset to schema-v2 defaults; no migration is performed.
- Keep phase detection separate from engine assignment resolution.
- Default both sides to MinMax in every phase unless the user opts into MCTS.
- Classify phases using total piece count plus the existing ply condition, not material score.
- Keep thresholds provisional: opening = ply < 10 OR pieces >= 34; endgame = pieces <= 16; otherwise midgame.
- Treat MCTS ELO-like labels as estimates until repeatable calibration exists.
- Do not infer test completion from merged PRs. Record only checks actually performed.
- Follow [Engine Testing Workflow](ENGINE-TESTING-WORKFLOW.md): contract checks and focused comparisons support iteration; full calibration is manual and on request, not a routine gate.

## Remaining plan

The integration and contract-test pass is complete. No full calibration is currently required to continue engine work. Use the documented test levels according to the change being made. Full-budget strength measurement remains available as an optional on-demand activity. Other follow-up areas remain parked:

1. **Strength calibration:** runner and methodology are present; previous 15-pair × 20-game run and resulting adjustments are user-confirmed. Repeat the full tournament only when requested or when a specific decision requires a broader measurement.
2. **Search responsiveness:** PR #120 now supplies finite budgets for all MCTS levels and request-scoped MinMax searches, preserves a legal best-so-far move, and caps main-thread fallback at 2s. Browser/device timing remains unverified; investigate the observed 15s worker watchdog timeouts only if this area is resumed.
3. **Failure recovery:** browser-check MCTS load failure, worker-construction fallback, and induced worker-runtime recovery.
4. **Additional regressions:** promotions, swaps, moats, no-legal-move/game-over handling, and responsive performance as relevant to future engine changes.

## Manual browser verification checklist

**Completed on 2026-11-09 — PR #150 schema-v2 configuration:** the user confirmed that the PWA verification passed, covering general-to-phase inheritance, field-level phase overrides, engine changes, Advanced settings, and persistence. The supplied runtime log records opening → midgame → endgame transitions, MinMax/MCTS engine switches, and worker searches. One invalid worker move was rejected; the AI retried on the main thread and completed a search. Search-budget warnings indicate that configured time budgets were reached; the log shows no corresponding search failure. This verification is specific to the tested schema-v2 configuration and runtime paths; it does not cover the separate failure scenarios listed below.

**Completed on 2026-11-05:** cache-only and site-data persistence checks. With White set to MCTS/Opening and Black set to MCTS/Endgame, clearing cached images/files while retaining cookies and site data preserved all four settings after reopening the game. Clearing the game's site data separately and reopening restored the defaults: White MinMax/Midgame and Black MinMax/Midgame. This verifies the distinction between clearing browser cache files and clearing the site's stored data; it does not verify persistence after site data is deleted.

**Completed on 2026-11-05:** offline behavior was checked on the user's Android. After loading the app online, the user enabled airplane mode, closed and reopened the app, and confirmed that the app worked offline. The user also confirmed that MCTS could be selected and successfully make a move. This verifies the app shell and MCTS runtime path under the tested offline conditions; it does not cover induced service-worker/cache failures or other failure-recovery paths.

**Completed on 2026-10-31:** normal engine dispatch, side/configuration independence, phase-specific engine selection, and ordinary reload persistence were checked through browser play and the game log. In the second logged game, the opening began with 40 pieces; midgame began at ply 21 with 33 pieces; endgame began at ply 54 with 16 pieces; checkmate occurred at ply 79. The user considers this test pass complete.

**Not covered:** MCTS module-load failure, worker-construction fallback, induced worker-runtime recovery, and the full special-case regression list. Do not describe these as passed. The optional single-file build remains outside this checklist unless requested.

Historical checklist items below remain candidates for future work, not requirements to continue this test pass.

1. **Normal engine dispatch:** start an AI game with MinMax, then select MCTS for one side and make several moves. Confirm both engines return legal moves, the board continues responding, and the console has no engine errors.
2. **Side and phase isolation:** set White to MCTS for midgame only and Black to MinMax. Confirm White uses MinMax in opening/endgame and MCTS in midgame. Repeat with Black configured for a different phase.
3. **Reload persistence:** set different engine/phase options for White and Black, reload, and confirm each side's choices are restored independently.
4. **MCTS load failure:** block `engines/mcts-engine.js` in DevTools Network request blocking, reload, and confirm startup warns while the board and MinMax remain usable. Confirm MCTS cannot run while its module is absent.
5. **Worker-construction fallback:** use a test server policy that blocks Blob workers, then confirm the chosen engine still makes a legal move via the main thread. Test MinMax and MCTS separately.
6. **Worker runtime error:** induce a worker runtime failure if practical and confirm the selected engine retries once on the main thread, the failed worker is terminated, and no stale worker response is applied.

Do not mark these checks complete until they have actually been observed in a browser. The optional single-file build is outside this checklist unless a built artifact is already available or the user explicitly requests building it.

## Progress log

- **2026-11-07:** Documented the tiered engine testing workflow. The earlier full 15-pair × 20-game run and resulting adjustments were user-confirmed. PR #133's separate automatic CI matrix was cancelled; full calibration is now manually dispatched on request, not run on every push or PR.
- **2026-11-06:** Added `scripts/engine-strength-calibration.js` and `docs/ENGINE-STRENGTH-CALIBRATION.md`. The runner compares MinMax/MCTS levels 1–3 from fixed opening layouts with balanced colours, seeded randomness, existing search budgets, pairwise relative Elo estimates, and approximate 95% intervals. The runner's initial verification used a smoke test; the earlier full run and resulting adjustments are recorded as user-confirmed above, but its raw tournament output is not stored here.
- **2026-11-05:** User-confirmed Android offline check: after an online load, the app reopened in airplane mode and MCTS was selectable and made a move.
- **2026-11-05:** User-confirmed browser checks: clearing cached images/files while retaining site data preserved White MCTS/Opening and Black MCTS/Endgame; clearing site data restored MinMax/Midgame defaults for both sides.
- **2026-11-04:** Current integration/test pass marked on hold after PR #119 (including PR #120) merged. Workflow #364 passed 128 tests (0 failures). Bounded search budgets are now 2.5s/5s/10s for MCTS levels 1–3, 3s/6s/10s for MinMax request levels, and at most 2s for main-thread fallback. Browser/device responsiveness and the cause of observed mobile worker watchdog timeouts remain unverified.
- **2026-10-22:** Initial design draft on `engine-plugins-design`.
- **2026-10-23:** Engine investigation and initial decisions; MCTS merged via PR #16.
- **2026-10-24:** MinMax adapter and registry groundwork landed.
- **2026-10-26:** PRs #20–#24 added per-side/per-phase controls and integration/loading fixes. Audit found unconditional MinMax worker dispatch; the fix was recorded on `fix/engine-worker-dispatch`. Browser/runtime verification and rating calibration remain unconfirmed.
