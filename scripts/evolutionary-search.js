/* Purpose: run bounded candidate-weight MinMax/Alpha-Beta searches for offline evolutionary matches. */
'use strict';

const { FEATURE_IDS, createFeatureExtractor } = require('./evolutionary-features');

const MATE_SCORE = 100000;

function normalizeWeights(weights) {
  const values = Array.isArray(weights) ? weights.slice() : FEATURE_IDS.map(id => weights && weights[id]);
  if (values.length !== FEATURE_IDS.length ||
      values.some(value => !Number.isFinite(value) || value < 0 || value > 1)) {
    throw new TypeError('Candidate weights must contain ten finite values in [0, 1].');
  }
  const total = values.reduce((sum, value) => sum + value, 0);
  if (Math.abs(total - 1) > 1e-9) throw new RangeError('Candidate weights must sum to 1.');
  return values;
}

function createSearchAdapter(adapter) {
  const required = ['clonePosition', 'allLegalState', 'inCheck', 'applyRaw'];
  if (!adapter || required.some(key => typeof adapter[key] !== 'function')) {
    throw new TypeError('Search adapter is missing canonical game helpers.');
  }
  return adapter;
}

function applySearchMove(position, move, adapter) {
  const next = adapter.clonePosition(position);
  if (move.swap) {
    const moving = next.board[move.from.r][move.from.c];
    const swapped = next.board[move.to.r][move.to.c];
    if (!moving || !swapped) throw new Error('Canonical Jester swap references an empty square.');
    next.board[move.to.r][move.to.c] = moving;
    next.board[move.from.r][move.from.c] = swapped;
    moving.moved = true;
    swapped.moved = true;
    const mover = next.turn;
    next.turn = mover === 'w' ? 'b' : 'w';
    next.ply = (next.ply || 0) + 1;
    next.moveCounts = next.moveCounts || { w: 0, b: 0 };
    next.moveCounts[mover] = (next.moveCounts[mover] || 0) + 1;
    next.halfmoveClock = (next.halfmoveClock || 0) + 1;
    if (adapter.getPositionKey && next.positionHistory) {
      next.positionHistory = { ...next.positionHistory };
      const key = adapter.getPositionKey(next);
      next.positionHistory[key] = (next.positionHistory[key] || 0) + 1;
    }
  } else {
    adapter.applyRaw(next, move);
  }
  return next;
}

function terminalScore(position, legalMoves, adapter, ply) {
  if (!legalMoves.length) {
    const checked = adapter.inCheck(position.turn, position.board, position.moats);
    if (!checked) return 0;
    return position.turn === 'w' ? -MATE_SCORE + ply : MATE_SCORE - ply;
  }
  if (position.halfmoveClock >= 100) return 0;
  if (adapter.getPositionKey && position.positionHistory) {
    const key = adapter.getPositionKey(position);
    if ((position.positionHistory[key] || 0) >= 3) return 0;
  }
  return null;
}

function searchBestMove(position, weights, adapter, options = {}) {
  const normalized = normalizeWeights(weights);
  const rules = createSearchAdapter(adapter);
  const depth = options.depth === undefined ? 2 : options.depth;
  const nodeLimit = options.nodeLimit === undefined ? 5000 : options.nodeLimit;
  if (!Number.isInteger(depth) || depth < 1 || depth > 8) throw new RangeError('Search depth must be 1–8.');
  if (!Number.isInteger(nodeLimit) || nodeLimit < 1 || nodeLimit > 1000000) {
    throw new RangeError('Search node limit must be 1–1000000.');
  }

  const featureExtractor = createFeatureExtractor(rules);
  let nodes = 0;
  let limitReached = false;

  function evaluate(node) {
    const features = featureExtractor.extractFeatures(node);
    let score = 0;
    for (let i = 0; i < FEATURE_IDS.length; i++) score += normalized[i] * features[FEATURE_IDS[i]];
    return score;
  }

  function alphaBeta(node, remainingDepth, alpha, beta, ply) {
    nodes++;
    const legalMoves = rules.allLegalState(node, node.turn);
    const terminal = terminalScore(node, legalMoves, rules, ply);
    if (terminal !== null) return terminal;
    if (remainingDepth === 0 || nodes >= nodeLimit) {
      if (nodes >= nodeLimit) limitReached = true;
      return evaluate(node);
    }

    const maximizing = node.turn === 'w';
    let best = maximizing ? -Infinity : Infinity;
    for (const move of legalMoves) {
      if (nodes >= nodeLimit) {
        limitReached = true;
        break;
      }
      const child = applySearchMove(node, move, rules);
      const score = alphaBeta(child, remainingDepth - 1, alpha, beta, ply + 1);
      if (maximizing) {
        if (score > best) best = score;
        alpha = Math.max(alpha, best);
      } else {
        if (score < best) best = score;
        beta = Math.min(beta, best);
      }
      if (beta <= alpha) break;
    }
    return Number.isFinite(best) ? best : evaluate(node);
  }

  const rootMoves = rules.allLegalState(position, position.turn);
  const terminal = terminalScore(position, rootMoves, rules, 0);
  if (!rootMoves.length || terminal !== null) {
    return { move: null, score: terminal === null ? 0 : terminal, nodes: 0, limitReached: false };
  }

  const maximizing = position.turn === 'w';
  let bestMove = rootMoves[0];
  let bestScore = maximizing ? -Infinity : Infinity;
  for (const move of rootMoves) {
    if (nodes >= nodeLimit) {
      limitReached = true;
      break;
    }
    const child = applySearchMove(position, move, rules);
    const score = alphaBeta(child, depth - 1, -Infinity, Infinity, 1);
    if ((maximizing && score > bestScore) || (!maximizing && score < bestScore)) {
      bestScore = score;
      bestMove = move;
    }
  }

  return {
    move: bestMove,
    score: bestScore,
    nodes,
    limitReached
  };
}

module.exports = {
  MATE_SCORE,
  normalizeWeights,
  applySearchMove,
  terminalScore,
  searchBestMove
};
