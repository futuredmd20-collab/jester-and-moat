const boardStyleSelect = document.getElementById('boardStyleSelect');
function applyBoardStyle() {
  document.documentElement.dataset.boardStyle = boardStyleSelect.value;
}
boardStyleSelect.addEventListener('change', () => { applyBoardStyle(); saveOptions(); });
document.getElementById('pieceSetSelect').addEventListener('change', () => {
  activePieceSet = document.getElementById('pieceSetSelect').value === 'flat' ? 'flat' : 'classic';
  renderPalettePieces();
  render();
  saveOptions();
});

loadOptions();
applyTheme();
applyBoardStyle();
renderPalettePieces();
setup();

// === engine plugin support (step 2, small support slice) ===

const ENGINE_PHASES = { OPENING: "opening", MIDGAME: "midgame", ENDGAME: "endgame" };

function currentPhaseOf(st){
  if (st.ply < 10) return ENGINE_PHASES.OPENING;
  let pieceCount = 0;
  for (let r = 0; r < ROWS; r++){
    for (let c = 0; c < COLS; c++){
      if (st.board[r][c]) pieceCount++;
    }
  }
  if (pieceCount > 18) return ENGINE_PHASES.MIDGAME;
  return ENGINE_PHASES.ENDGAME;
}

function defaultEngineForSide(side){
  return MINMAX_LEGACY_PLUGIN;
}

const ENGINE_REGISTRY = new Map();

function registerEngine(plugin){
  if (!plugin || !plugin.name || typeof plugin.getMove !== "function") return false;
  ENGINE_REGISTRY.set(plugin.name, plugin);
  return true;
}

function engineForSidePhase(side){
  const phase = currentPhaseOf(state);
  const selected = getEnginePreferenceForPhase(phase);
  if (!selected) return defaultEngineForSide(side);
  const plugin = ENGINE_REGISTRY.get(selected);
  if (!plugin) return defaultEngineForSide(side);
  if (!plugin.phases || !plugin.phases.includes(phase)) return defaultEngineForSide(side);
  return plugin;
}

function getEnginePreferenceForPhase(phase){
  try {
    const stored = JSON.parse(localStorage.getItem("jm_engine_phase_pref_v1") || "null");
    if (stored && typeof stored === "object" && Object.prototype.hasOwnProperty.call(stored, phase)){
      return stored[phase] || null;
    }
  } catch(err){ /* ignore */ }
  return null;
}

function saveEnginePhasePreference(phase, engineName){
  try {
    const stored = JSON.parse(localStorage.getItem("jm_engine_phase_pref_v1") || "null");
    const next = stored && typeof stored === "object" ? stored : {};
    if (engineName){
      next[phase] = engineName;
    } else {
      delete next[phase];
    }
    localStorage.setItem("jm_engine_phase_pref_v1", JSON.stringify(next));
  } catch(err){ /* ignore */ }
}

const MINMAX_LEGACY_PLUGIN = {
  name: "legacy",
  id: "legacy",
  phases: [ENGINE_PHASES.OPENING, ENGINE_PHASES.MIDGAME, ENGINE_PHASES.ENDGAME],
  strength: 2,
  getMove: function(st){
    return getBestMove(st, isAIMode() ? (document.getElementById("modeSelect").value === "ai_easy" ? 1 : (document.getElementById("modeSelect").value === "ai_hard" ? 3 : 2)) : 2);
  }
};

const MINMAX_MIDGAME_SCORER_PLUGIN = {
  name: "midgame-scorer",
  id: "minmax-midgame-scorer",
  phases: [ENGINE_PHASES.MIDGAME],
  strength: 2,
  getMove: function(st){
    const moves = allLegalState(st, st.turn);
    if (!moves.length) return null;
    let bestMoves = [];
    let bestScore = -Infinity;
    const isMax = st.turn === "w";
    for (const m of moves){
      const next = clone(st);
      if (m.swap){
        const p = next.board[m.from.r][m.from.c], q = next.board[m.to.r][m.to.c];
        next.board[m.to.r][m.to.c] = p; next.board[m.from.r][m.from.c] = q;
        p.moved = true; q.moved = true; next.turn = other(next.turn); next.ply++;
      } else {
        applyRaw(next, m);
      }
      const score = evaluateBoard(next);
      if (isMax ? score > bestScore : score < bestScore){
        bestScore = score; bestMoves = [m];
      } else if (Math.abs(score - bestScore) < 0.0001){
        bestMoves.push(m);
      }
    }
    if (!bestMoves.length) return null;
    const chosen = bestMoves[Math.floor(Math.random() * bestMoves.length)];
    if (chosen.to.r >= 2 && chosen.to.r <= 5 && chosen.to.c >= 3 && chosen.to.c <= 6){
      const centerOdds = 0.25;
      if (Math.random() < centerOdds){
        const centerMoves = bestMoves.filter(m => m.to.r >= 2 && m.to.r <= 5 && m.to.c >= 3 && m.to.c <= 6);
        if (centerMoves.length > 1) return centerMoves[Math.floor(Math.random() * centerMoves.length)];
      }
    }
    return chosen;
  }
};

registerEngine(MINMAX_LEGACY_PLUGIN);
registerEngine(MINMAX_MIDGAME_SCORER_PLUGIN);

function aiMove(){
  if (gameOver || isAIThinking) return;
  isAIThinking = true;
  status("⏳ AI thinking...");

  const mode = document.getElementById("modeSelect").value;
  let depth = 2;
  if (mode === "ai_easy") depth = 1;
  if (mode === "ai_medium" || mode === "ai_vs_ai") depth = 2;
  if (mode === "ai_hard") depth = 3;

  const worker = ensureAIWorker();
  if (worker){
    const id = ++aiRequestId;
    worker.postMessage({ id, state: clone(state), depth });
    return;
  }

  const policyEngine = engineForSidePhase(state.turn);
  if (policyEngine && policyEngine.id === "minmax-midgame-scorer" && currentPhaseOf(state) === ENGINE_PHASES.MIDGAME){
    const move = policyEngine.getMove(clone(state));
    isAIThinking = false;
    if (move) play(move, "pending");
    else {
      gameOver = true;
      stopAutoPlay();
      stopClock();
      status("No legal moves available.");
    }
    return;
  }

  setTimeout(() => {
    if (gameOver){ isAIThinking = false; return; }
    const bestMove = getBestMove(state, depth);
    isAIThinking = false;
    if (bestMove) play(bestMove, "pending");
    else {
      gameOver = true;
      stopAutoPlay();
      stopClock();
      status("No legal moves available.");
    }
  }, 20);
}