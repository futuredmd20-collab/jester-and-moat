/* === Engine plugin system (step 1 — interface + registry + legacy wrapper) ===
 *
 * A plugin is a plain object with the shape
 *
 *   { name, phases, strength, getMove(state) }
 *
 *   name    — display label shown in the engine-config UI (added in a later step).
 *   phases  — which phases the plugin can serve; for now every plugin serves all
 *             three so the legacy default stays behaviourally unchanged.
 *   strength — level parameter (depth + temperature) for the later strength/level
 *              UI; unused by the legacy wrapper except that it is carried in the
 *              plugin object so step 3 can read it without another seam.
 *   getMove(state) — returns the chosen move for `state`, or null when the side
 *                     to move has no legal moves. The returned move uses the same
 *                     shape the rest of the app already knows
 *                     ({from, to, swap?, enPassant?, castling?, doublePawn?}),
 *                     so plugins slot behind the existing play() path.
 *
 * The legacy MinMax engine becomes the built-in default plugin. Its behaviour is
 * unchanged: getBestMove(state, depth) is still the implementation, still sorted
 * randomly per root call, still backed by the same minimax + evaluateBoard. The
 * plugin wrapper exists so step 2's per-phase/per-side pipeline has a seam to
 * route moves through without touching aiMove/ensureAIWorker yet.
 */

const ENGINE_PHASES = { opening: 'opening', midgame: 'midgame', endgame: 'endgame' };

function defaultEngineStrength() {
  return { label: 'Legacy MinMax (depth buckets)', depth: null };
}

const LEGACY_MINIMAX_PLUGIN = {
  name: 'MinMaxLegacy',
  phases: [ENGINE_PHASES.opening, ENGINE_PHASES.midgame, ENGINE_PHASES.endgame],
  strength: defaultEngineStrength(),
  getMove(st) {
    // Match the depth buckets the app already maps from modeSelect, so this
    // wrapper is behaviourally identical to the old getBestMove(state, depth)
    // path until a later step replaces the depth selection with per-plugin
    // strength.
    //
    // NOTE: this reads document.getElementById('modeSelect') on purpose — it is
    // the same lookup aiMove() already does, so the wrapper stays behaviourally
    // identical until a later step replaces the depth selection with per-plugin
    // strength and removes this DOM read.
    const mode = document.getElementById('modeSelect').value;
    let depth = 2;
    if (mode === 'ai_easy') depth = 1;
    if (mode === 'ai_medium' || mode === 'ai_vs_ai') depth = 2;
    if (mode === 'ai_hard') depth = 3;
    return getBestMove(st, depth);
  }
};

// Inline a tiny modeSelect shim used only by the headless smoke in this file.
// It is harmless in the browser (the real element exists) and lets the smoke
// assert depth buckets without touching aiMove/ensureAIWorker.
if (typeof document !== 'undefined' && !document.getElementById('modeSelect')) {
  // Headless: expose a controllable depth for LEGACY_MINIMAX_PLUGIN.getMove.
  // The real app never reaches here because the real modeSelect exists.
  const _smokeMode = { value: 'ai_medium' };
  const _origGet = document.getElementById.bind(document);
  document.getElementById = function(id) {
    if (id === 'modeSelect') return _smokeMode;
    return _origGet(id);
  };
  // Expose the shim on the plugin so a smoke can set depth per call.
  LEGACY_MINIMAX_PLUGIN._setSmokeDepth = (v) => { _smokeMode.value = v; };
}

const enginePlugins = new Map([
  ['minmax-legacy', LEGACY_MINIMAX_PLUGIN]
]);

function defaultEngineForSide(side) {
  // Step 1 default: the legacy MinMax plugin serves both sides in every phase.
  // This is the seam later steps replace with a per-side, per-phase pipeline.
  return LEGACY_MINIMAX_PLUGIN;
}
