/* mcts-engine.js — MCTS AI engine (plugin #2) for Jester & Moat
 *
 * PURPOSE
 *   A second, structurally different AI engine: Monte Carlo Tree Search
 *   (UCT selection + random playouts), complementing the existing
 *   minimax/alpha-beta engine (plugin #1). Delivered as a self-contained,
 *   worker-serializable module targeting the plugin interface drafted in
 *   docs/ENGINE-PLUGINS.md (branch engine-plugins-design):
 *       { name, phases, strength, getMove(gameState) }
 *   It serves all three phases (opening, midgame, endgame) — MCTS has no
 *   phase-specific logic, so covering all phases costs nothing extra.
 *
 * INTEGRATION CONDITIONS (what must be true for this file to work as-is)
 *   1. It relies on the canonical engine helpers that the current AI worker
 *      (ensureAIWorker in script.js) already serializes via fn.toString():
 *      clone, other, allLegalState, applyRaw, inCheck, evaluateBoard,
 *      ROWS, COLS. It defines no copies of those, so it cannot drift from
 *      the real rules. When wiring this plugin into the worker, add the
 *      mcts* functions below to the same engineFunctions list.
 *   2. Under the CURRENT worker protocol ({ id, state, depth }), the drop-in
 *      entry point is mctsGetMove(state, depth) — same signature and return
 *      shape as getBestMove, so integration is: add functions to the list,
 *      route the message to mctsGetMove instead of getBestMove.
 *   3. mctsEngine(level) returns the plugin object per the drafted
 *      interface, for when the extended protocol (plugin id + per-side
 *      config) lands. strength = { playouts, capDepth, temperature, rating }.
 *   4. Promotion sentinel: playouts let applyRaw's fallback handle
 *      promoChoice (defaults to 'q'), matching the 'pending' contract
 *      recorded in ENGINE-PLUGINS.md. Do not add promoChoice handling here.
 *   5. Moves are applied with the canonical applyRaw (and the swap
 *      convention used by minimax for jester swaps), so moat destruction,
 *      en passant, castling and promotion all behave exactly as in real
 *      play. Every node/expansion clones its state; the input state is
 *      never mutated.
 *
 * REFACTOR TRIGGERS (what would force changes to this file)
 *   - If ENGINE-PLUGINS.md finalizes gameState/phase plumbing differently
 *     (e.g. getMove(gameState, phase, strength) or a PhasePolicy passing a
 *     config object), mctsGetMove's signature and the level mapping below
 *     must be adapted; the search core (mctsSearch) is unaffected.
 *   - If the worker protocol grows a plugin id / per-side config message,
 *     the depth->level mapping (see mctsLevelFor) becomes obsolete.
 *   - If applyRaw or the move object shape changes (new fields, new
 *     special moves), mctsApplyMove must be updated in lockstep.
 *   - Performance: playout cost is dominated by allLegalState (it clones
 *     the state per candidate move for legality). If turn latency is too
 *     high on phones, either tune MCTS_LEVELS down or add a lighter
 *     playout-legality helper; that helper must live next to the canonical
 *     rules in script.js, not here, to avoid rule drift.
 *   - Strength semantics: level numbers below are provisional ELO-like
 *     estimates, not calibrated ratings.
 *
 * NOT YET WIRED: this file is not referenced by index.html and is not in
 * the sw.js precache list. That happens at integration time (steps 3-5 of
 * the ENGINE-PLUGINS.md plan), per ARCHITECTURE.md.
 */

'use strict';

/* Level presets. Level mirrors the current depth-based difficulty selector
 * (ai_easy 1 / ai_medium 2 / ai_hard 3) so it is a drop-in today; playouts
 * and capDepth are the real strength dials. temperature = probability of
 * picking among near-best root moves instead of the most-visited one
 * (deliberate weakness, per the strength = depth + temperature idea). */
var MCTS_LEVELS = {
  1: { playouts: 200,  capDepth: 10, temperature: 0.35, rating: '~800'  },
  2: { playouts: 700,  capDepth: 14, temperature: 0.15, rating: '~1200' },
  3: { playouts: 2000, capDepth: 18, temperature: 0.00, rating: '~1600' }
};

function mctsLevelFor(arg) {
  if (arg && MCTS_LEVELS[arg.level]) return arg.level;
  if (typeof arg === 'number' && MCTS_LEVELS[arg]) return arg;
  return 2;
}

/* Apply a move on a state that this module owns (already cloned).
 * Mirrors the swap convention used by minimax in script.js. */
function mctsApplyMove(s, m) {
  if (m.swap) {
    var b = s.board;
    var p = b[m.from.r][m.from.c], q = b[m.to.r][m.to.c];
    b[m.to.r][m.to.c] = p; b[m.from.r][m.from.c] = q;
    p.moved = true; q.moved = true;
    s.turn = other(s.turn); s.ply++;
    s.halfmoveClock = (s.halfmoveClock || 0) + 1;
  } else {
    applyRaw(s, m);
  }
}

/* One random playout from s. Returns white's win probability in [0,1].
 * Terminal states: side to move mated -> that side loses; no legal moves
 * without check -> stalemate, 0.5. Cap reached -> evaluateBoard squashed
 * through a sigmoid so scores map smoothly into [0,1]. */
function mctsPlayout(s, capDepth) {
  var d = 0;
  while (d < capDepth) {
    var moves = allLegalState(s, s.turn);
    if (moves.length === 0) {
      if (inCheck(s.turn, s.board, s.moats)) return s.turn === 'w' ? 0 : 1;
      return 0.5;
    }
    mctsApplyMove(s, moves[Math.floor(Math.random() * moves.length)]);
    d++;
  }
  var score = evaluateBoard(s);
  return 1 / (1 + Math.exp(-score / 2));
}

function mctsNode(state, move, parent, playerJustMoved) {
  return {
    state: state, move: move, parent: parent,
    playerJustMoved: playerJustMoved,
    wins: 0, visits: 0,
    untried: null, children: []
  };
}

var MCTS_EXPLORATION = 0.7;

function mctsUctChild(node) {
  var logN = Math.log(node.visits || 1), best = null, bestVal = -Infinity;
  for (var i = 0; i < node.children.length; i++) {
    var ch = node.children[i];
    var v = (ch.wins / ch.visits) + MCTS_EXPLORATION * Math.sqrt(logN / ch.visits);
    if (v > bestVal) { bestVal = v; best = ch; }
  }
  return best;
}

/* Core search. st is cloned immediately; the caller's state is untouched.
 * Returns the chosen move (same object shape as getBestMove) or null when
 * the side to move has no legal moves. */
function mctsSearch(st, cfg) {
  var rootState = clone(st);
  var root = mctsNode(rootState, null, null, other(rootState.turn));
  root.untried = allLegalState(rootState, rootState.turn);
  if (root.untried.length === 0) return null;

  for (var i = 0; i < cfg.playouts; i++) {
    var node = root;

    // 1. Selection: descend fully expanded nodes via UCT.
    while (node.untried !== null && node.untried.length === 0 && node.children.length > 0) {
      node = mctsUctChild(node);
    }

    // 2. Expansion: add one untried move.
    var child;
    if (node.untried !== null && node.untried.length > 0) {
      var idx = Math.floor(Math.random() * node.untried.length);
      var mv = node.untried.splice(idx, 1)[0];
      var cs = clone(node.state);
      mctsApplyMove(cs, mv);
      child = mctsNode(cs, mv, node, node.state.turn);
      node.children.push(child);
    } else {
      child = node; // terminal reached during selection
    }

    // 3. Simulation (playout), from the mover's perspective.
    var white = mctsPlayout(clone(child.state), cfg.capDepth);
    var res = child.playerJustMoved === 'w' ? white : 1 - white;

    // 4. Backpropagation; perspective alternates up the tree.
    var n = child;
    while (n) {
      n.visits++;
      n.wins += (n.playerJustMoved === child.playerJustMoved) ? res : 1 - res;
      n = n.parent;
    }
  }

  // Root choice: most-visited child, with deliberate temperature:
  // with probability cfg.temperature pick uniformly among the top 3.
  if (cfg.temperature > 0 && root.children.length > 1 && Math.random() < cfg.temperature) {
    var top = root.children.slice().sort(function (a, b) { return b.visits - a.visits; }).slice(0, 3);
    return top[Math.floor(Math.random() * top.length)].move;
  }
  var best = null;
  for (var j = 0; j < root.children.length; j++) {
    if (!best || root.children[j].visits > best.visits) best = root.children[j];
  }
  return best ? best.move : null;
}

/* Drop-in for the current worker protocol: same signature and return
 * shape as getBestMove(st, depth). depth doubles as the level 1-3. */
function mctsGetMove(st, depth) {
  return mctsSearch(st, MCTS_LEVELS[mctsLevelFor(depth)]);
}

/* Plugin object per the drafted interface, for the future extended
 * worker protocol / PhasePolicy integration (ENGINE-PLUGINS.md). */
function mctsEngine(level) {
  var lvl = mctsLevelFor(level);
  var cfg = MCTS_LEVELS[lvl];
  return {
    name: 'MCTS (' + cfg.rating + ')',
    phases: ['opening', 'midgame', 'endgame'],
    strength: cfg,
    getMove: function (gameState) { return mctsSearch(gameState, cfg); }
  };
}
