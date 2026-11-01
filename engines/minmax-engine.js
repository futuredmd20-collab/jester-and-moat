/* engines/minmax-engine.js — extracted MinMax search core.
 * Rule generation and state transitions remain owned by script.js and are injected.
 * This module contains only evaluation and alpha-beta search logic. */
(function (root) {
  function MinMaxSearchCoreFactory(dependencies) {
    const ROWS = 8, COLS = 10;
    const { clone, other, applyRaw, allLegalState, inCheck, getJesterValue } = dependencies;
    function evaluateBoard(st) {
  const jesterVal = getJesterValue(st);
  const pieceValues = { p: 1.0, n: 3.0, b: 3.5, r: 5.0, q: 9.5, k: 200.0, j: jesterVal };
  let score = 0;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = st.board[r][c];
      if (!p) continue;

      let val = pieceValues[p.type] || 0;
      let centerBonus = 0;
      if (r >= 2 && r <= 5 && c >= 3 && c <= 6) centerBonus = 0.2;
      if (p.type === 'j' && st.ply >= 10 && (r >= 2 && r <= 5)) centerBonus += 0.4;

      const total = val + centerBonus;
      if (p.color === 'w') score += total;
      else score -= total;
    }
  }
  return score;
}
    function minimax(st, depth, alpha, beta, isMaximizing) {
  const moves = allLegalState(st, st.turn);
  const check = inCheck(st.turn, st.board, st.moats);

  if (depth === 0 || moves.length === 0) {
    if (moves.length === 0) {
      if (check) return isMaximizing ? -9999 + (3 - depth) : 9999 - (3 - depth);
      return 0;
    }
    return evaluateBoard(st);
  }

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const m of moves) {
      const nextState = clone(st);
      if (m.swap) {
        const p = nextState.board[m.from.r][m.from.c], q = nextState.board[m.to.r][m.to.c];
        nextState.board[m.to.r][m.to.c] = p; nextState.board[m.from.r][m.from.c] = q;
        p.moved = true; q.moved = true; nextState.turn = other(nextState.turn); nextState.ply++;
      } else {
        applyRaw(nextState, m);
      }
      const ev = minimax(nextState, depth - 1, alpha, beta, false);
      maxEval = Math.max(maxEval, ev);
      alpha = Math.max(alpha, ev);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const m of moves) {
      const nextState = clone(st);
      if (m.swap) {
        const p = nextState.board[m.from.r][m.from.c], q = nextState.board[m.to.r][m.to.c];
        nextState.board[m.to.r][m.to.c] = p; nextState.board[m.from.r][m.from.c] = q;
        p.moved = true; q.moved = true; nextState.turn = other(nextState.turn); nextState.ply++;
      } else {
        applyRaw(nextState, m);
      }
      const ev = minimax(nextState, depth - 1, alpha, beta, true);
      minEval = Math.min(minEval, ev);
      beta = Math.min(beta, ev);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}
    function getBestMove(st, depth) {
  const moves = allLegalState(st, st.turn);
  if (!moves.length) return null;

  let bestMove = null;
  const isMax = st.turn === 'w';
  let bestEval = isMax ? -Infinity : Infinity;

  moves.sort(() => Math.random() - 0.5);

  for (const m of moves) {
    const nextState = clone(st);
    if (m.swap) {
      const p = nextState.board[m.from.r][m.from.c], q = nextState.board[m.to.r][m.to.c];
      nextState.board[m.to.r][m.to.c] = p; nextState.board[m.from.r][m.from.c] = q;
      p.moved = true; q.moved = true; nextState.turn = other(nextState.turn); nextState.ply++;
    } else {
      applyRaw(nextState, m);
    }

    const ev = minimax(nextState, depth - 1, -Infinity, Infinity, !isMax);
    if (isMax) {
      if (ev > bestEval) { bestEval = ev; bestMove = m; }
    } else {
      if (ev < bestEval) { bestEval = ev; bestMove = m; }
    }
  }
  return bestMove;
}
    return Object.freeze({ evaluateBoard, minimax, getBestMove });
  }
  root.MinMaxSearchCoreFactory = MinMaxSearchCoreFactory;
})(globalThis);
