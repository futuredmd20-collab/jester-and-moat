/* Purpose: extract the versioned semantic evaluation features for the offline evolutionary trainer. */
'use strict';

const FEATURE_SCHEMA_VERSION = 1;
const FEATURE_IDS = Object.freeze([
  'material.pawn',
  'material.knight',
  'material.bishop',
  'material.rook',
  'material.queen',
  'material.jester',
  'activity.mobility',
  'activity.central',
  'activity.jester',
  'safety.king-in-check'
]);
const MATERIAL_LIMITS = Object.freeze({
  pawn: 10,
  knight: 2,
  bishop: 2,
  rook: 2,
  queen: 1,
  jester: 2
});
const MATERIAL_PIECE_TYPES = Object.freeze({ pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', jester: 'j' });
const CENTRAL_BOUNDS = Object.freeze({ minRow: 2, maxRow: 5, minCol: 3, maxCol: 6 });
const FEATURE_LIMITS = Object.freeze({ mobility: 40, central: 16, jester: 24 });

function clamp(value, min = -1, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function difference(white, black, cap) {
  return clamp((white - black) / cap);
}

function assertPosition(position) {
  if (!position || !Array.isArray(position.board) || position.board.length !== 8 ||
      position.board.some(row => !Array.isArray(row) || row.length !== 10)) {
    throw new TypeError('Feature extraction requires a canonical 8x10 position.');
  }
  if (!position.variant || position.variant.id !== 'jester-moat' || position.variant.version !== 1) {
    throw new TypeError('Feature extraction supports only jester-moat v1 positions.');
  }
  if (!['w', 'b'].includes(position.turn)) throw new TypeError('Position turn is invalid.');
  if (!position.moats || !position.moatDestroyed || !position.positionHistory) {
    throw new TypeError('Position is missing rule-relevant variant state.');
  }
}

function createFeatureExtractor(adapter) {
  if (!adapter || typeof adapter.clonePosition !== 'function' ||
      typeof adapter.allLegalState !== 'function' || typeof adapter.inCheck !== 'function') {
    throw new TypeError('Feature adapter requires clonePosition, allLegalState, and inCheck.');
  }

  function sideContext(position, side) {
    const sidePosition = adapter.clonePosition(position);
    sidePosition.turn = side;
    const legalMoves = adapter.allLegalState(sidePosition, side);
    if (!Array.isArray(legalMoves)) throw new TypeError('Canonical legal-move helper returned an invalid result.');
    return { sidePosition, legalMoves };
  }

  function countMaterial(position, side, type) {
    let count = 0;
    for (const row of position.board) {
      for (const piece of row) {
        if (piece && piece.color === side && piece.type === type) count++;
      }
    }
    return count;
  }

  function countCentral(position, side) {
    let count = 0;
    for (let row = CENTRAL_BOUNDS.minRow; row <= CENTRAL_BOUNDS.maxRow; row++) {
      for (let col = CENTRAL_BOUNDS.minCol; col <= CENTRAL_BOUNDS.maxCol; col++) {
        const piece = position.board[row][col];
        if (piece && piece.color === side && piece.type !== 'p') count++;
      }
    }
    return count;
  }

  function extractFeatures(position) {
    assertPosition(position);
    const white = sideContext(position, 'w');
    const black = sideContext(position, 'b');
    const features = {};

    for (const [type, cap] of Object.entries(MATERIAL_LIMITS)) {
      features['material.' + type] = difference(
        countMaterial(position, 'w', MATERIAL_PIECE_TYPES[type]),
        countMaterial(position, 'b', MATERIAL_PIECE_TYPES[type]),
        cap
      );
    }

    features['activity.mobility'] = difference(
      Math.min(white.legalMoves.length, FEATURE_LIMITS.mobility),
      Math.min(black.legalMoves.length, FEATURE_LIMITS.mobility),
      FEATURE_LIMITS.mobility
    );
    features['activity.central'] = difference(
      Math.min(countCentral(position, 'w'), FEATURE_LIMITS.central),
      Math.min(countCentral(position, 'b'), FEATURE_LIMITS.central),
      FEATURE_LIMITS.central
    );

    const countJesterMoves = (context, side) => context.legalMoves.filter(move => {
      const from = move && move.from;
      if (!from || !Number.isInteger(from.r) || !Number.isInteger(from.c)) return false;
      const piece = context.sidePosition.board[from.r] && context.sidePosition.board[from.r][from.c];
      return Boolean(piece && piece.color === side && piece.type === 'j');
    }).length;
    features['activity.jester'] = difference(
      Math.min(countJesterMoves(white, 'w'), FEATURE_LIMITS.jester),
      Math.min(countJesterMoves(black, 'b'), FEATURE_LIMITS.jester),
      FEATURE_LIMITS.jester
    );

    const whiteChecked = adapter.inCheck('w', white.sidePosition.board, white.sidePosition.moats) ? 1 : 0;
    const blackChecked = adapter.inCheck('b', black.sidePosition.board, black.sidePosition.moats) ? 1 : 0;
    features['safety.king-in-check'] = blackChecked - whiteChecked;

    for (const id of FEATURE_IDS) {
      if (!Number.isFinite(features[id]) || features[id] < -1 || features[id] > 1) {
        throw new RangeError('Feature value is outside schema-v1 bounds: ' + id);
      }
    }
    return features;
  }

  function measureFeatureCosts(position, iterations = 1) {
    assertPosition(position);
    if (!Number.isInteger(iterations) || iterations < 1 || iterations > 1000) {
      throw new RangeError('iterations must be an integer from 1 to 1000.');
    }
    const costs = Object.fromEntries(FEATURE_IDS.map(id => [id, 0]));
    const now = () => Number(process.hrtime.bigint()) / 1e6;

    for (let iteration = 0; iteration < iterations; iteration++) {
      let start = now();
      for (const [type] of Object.entries(MATERIAL_LIMITS)) {
        countMaterial(position, 'w', MATERIAL_PIECE_TYPES[type]);
        countMaterial(position, 'b', MATERIAL_PIECE_TYPES[type]);
        costs['material.' + type] += now() - start;
        start = now();
      }

      const contexts = {};
      for (const side of ['w', 'b']) {
        start = now();
        contexts[side] = sideContext(position, side);
        costs['activity.mobility'] += now() - start;
      }

      start = now();
      countCentral(position, 'w');
      countCentral(position, 'b');
      costs['activity.central'] += now() - start;

      start = now();
      for (const side of ['w', 'b']) {
        countJesterMovesForMeasurement(contexts[side], side);
      }
      costs['activity.jester'] += now() - start;

      start = now();
      adapter.inCheck('w', contexts.w.sidePosition.board, contexts.w.sidePosition.moats);
      adapter.inCheck('b', contexts.b.sidePosition.board, contexts.b.sidePosition.moats);
      costs['safety.king-in-check'] += now() - start;
    }

    for (const id of Object.keys(costs)) costs[id] /= iterations;
    return costs;
  }

  function countJesterMovesForMeasurement(context, side) {
    return context.legalMoves.filter(move => {
      const from = move && move.from;
      const piece = from && context.sidePosition.board[from.r] && context.sidePosition.board[from.r][from.c];
      return Boolean(piece && piece.color === side && piece.type === 'j');
    }).length;
  }

  return Object.freeze({ extractFeatures, measureFeatureCosts });
}

module.exports = {
  FEATURE_SCHEMA_VERSION,
  FEATURE_IDS,
  MATERIAL_LIMITS,
  MATERIAL_PIECE_TYPES,
  FEATURE_LIMITS,
  CENTRAL_BOUNDS,
  createFeatureExtractor,
  assertPosition
};
