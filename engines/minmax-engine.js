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
    async function getBestMoveAsync(st, depth, shouldCancel = () => false, yieldControl = () => new Promise(resolve => setTimeout(resolve, 0))) {
  const moves = allLegalState(st, st.turn);
  if (!moves.length) return { move: null, cancelled: false };
  let bestMove = null;
  const isMax = st.turn === 'w';
  let bestEval = isMax ? -Infinity : Infinity;
  const searchControl = { visitedNodes: 0 };
  moves.sort(() => Math.random() - 0.5);

  // Unlike the synchronous compatibility path, this recursive search periodically
  // yields to the Worker event loop so cancellation messages can be processed
  // even while exploring a single root branch.
  async function minimaxCooperative(nodeState, remainingDepth, alpha, beta, maximizing) {
    if (shouldCancel()) return null;
    searchControl.visitedNodes++;
    if (searchControl.visitedNodes % 32 === 0) {
      await yieldControl();
      if (shouldCancel()) return null;
    }

    const nodeMoves = allLegalState(nodeState, nodeState.turn);
    const check = inCheck(nodeState.turn, nodeState.board, nodeState.moats);
    if (remainingDepth === 0 || nodeMoves.length === 0) {
      if (nodeMoves.length === 0) {
        if (check) return maximizing ? -9999 + (3 - remainingDepth) : 9999 - (3 - remainingDepth);
        return 0;
      }
      return evaluateBoard(nodeState);
    }

    let best = maximizing ? -Infinity : Infinity;
    for (const move of nodeMoves) {
      if (shouldCancel()) return null;
      const nextState = clone(nodeState);
      if (move.swap) {
        const p = nextState.board[move.from.r][move.from.c], q = nextState.board[move.to.r][move.to.c];
        nextState.board[move.to.r][move.to.c] = p;
        nextState.board[move.from.r][move.from.c] = q;
        p.moved = true; q.moved = true;
        nextState.turn = other(nextState.turn); nextState.ply++;
      } else {
        applyRaw(nextState, move);
      }

      const value = await minimaxCooperative(nextState, remainingDepth - 1, alpha, beta, !maximizing);
      if (value === null) return null;
      if (maximizing) {
        best = Math.max(best, value);
        alpha = Math.max(alpha, value);
      } else {
        best = Math.min(best, value);
        beta = Math.min(beta, value);
      }
      if (beta <= alpha) break;
    }
    return best;
  }

  for (let i = 0; i < moves.length; i++) {
    if (shouldCancel()) return { move: null, cancelled: true };
    const move = moves[i];
    const nextState = clone(st);
    if (move.swap) {
      const p = nextState.board[move.from.r][move.from.c], q = nextState.board[move.to.r][move.to.c];
      nextState.board[move.to.r][move.to.c] = p;
      nextState.board[move.from.r][move.from.c] = q;
      p.moved = true; q.moved = true; nextState.turn = other(nextState.turn); nextState.ply++;
    } else {
      applyRaw(nextState, move);
    }

    const value = await minimaxCooperative(nextState, depth - 1, -Infinity, Infinity, !isMax);
    if (value === null) return { move: null, cancelled: true };
    if (isMax ? value > bestEval : value < bestEval) {
      bestEval = value;
      bestMove = move;
    }
    if (i < moves.length - 1) {
      await yieldControl();
      if (shouldCancel()) return { move: null, cancelled: true };
    }
  }
  return { move: bestMove, cancelled: false };
}
    return Object.freeze({ evaluateBoard, minimax, getBestMove, getBestMoveAsync });
  }
  root.MinMaxSearchCoreFactory = MinMaxSearchCoreFactory;
})(globalThis);
