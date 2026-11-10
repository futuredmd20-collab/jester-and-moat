/* Purpose: provide deterministic population operations, fixed fixtures, and offline candidate match evaluation. */
'use strict';

const calibration = require('./engine-strength-calibration');
const { FEATURE_IDS } = require('./evolutionary-features');
const { normalizeWeights, searchBestMove } = require('./evolutionary-search');

const DEFAULTS = Object.freeze({
  populationSize: 8,
  eliteCount: 2,
  tournamentSize: 3,
  mutationProbability: 0.20,
  mutationStep: 0.10,
  generations: 8,
  maxPlies: 120,
  searchDepth: 2,
  searchNodeLimit: 5000,
  opponentBudgetScale: 1
});
const OPPONENTS = Object.freeze(['minmax-2', 'mcts-2']);
const LAYOUTS = Object.freeze(['edges', 'center']);
const COLOURS = Object.freeze(['w', 'b']);

function validateSeed(seed) {
  if (!Number.isSafeInteger(seed) || seed < 0) throw new RangeError('Seed must be a non-negative safe integer.');
  return seed;
}

function equalWeights() {
  return FEATURE_IDS.map(() => 1 / FEATURE_IDS.length);
}

function randomWeights(random) {
  if (typeof random !== 'function') throw new TypeError('A seeded random function is required.');
  const values = FEATURE_IDS.map(() => random());
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!Number.isFinite(total) || total <= 0) throw new Error('Seeded initialization produced an invalid weight vector.');
  return values.map(value => value / total);
}

function validateCandidate(candidate) {
  if (!candidate || typeof candidate.id !== 'string' || !candidate.id.trim()) {
    throw new TypeError('Candidate requires a stable non-empty ID.');
  }
  normalizeWeights(candidate.weights);
  return candidate;
}

function createInitialPopulation(seed, populationSize = DEFAULTS.populationSize) {
  validateSeed(seed);
  if (!Number.isInteger(populationSize) || populationSize < 4 || populationSize > 8) {
    throw new RangeError('Population size must be 4–8 evolving candidates.');
  }
  const random = calibration.seededRandom(seed);
  const population = Array.from({ length: populationSize }, (_, index) => ({
    id: 'g0-c' + String(index + 1).padStart(2, '0'),
    weights: randomWeights(random)
  }));
  return {
    population,
    control: { id: 'equal-weight-control', weights: equalWeights(), frozen: true },
    randomState: null
  };
}

function normalizeMutatedWeights(values) {
  const bounded = values.map(value => Math.max(0, Math.min(1, value)));
  const total = bounded.reduce((sum, value) => sum + value, 0);
  if (!Number.isFinite(total) || total <= 0) return null;
  const normalized = bounded.map(value => value / total);
  if (normalized.some(value => !Number.isFinite(value) || value < 0 || value > 1)) return null;
  return normalized;
}

function mutateWeights(weights, random, settings = {}) {
  const source = normalizeWeights(weights);
  if (typeof random !== 'function') throw new TypeError('A seeded random function is required.');
  const probability = settings.mutationProbability === undefined ? DEFAULTS.mutationProbability : settings.mutationProbability;
  const step = settings.mutationStep === undefined ? DEFAULTS.mutationStep : settings.mutationStep;
  if (!Number.isFinite(probability) || probability < 0 || probability > 1) throw new RangeError('Mutation probability must be in [0, 1].');
  if (!Number.isFinite(step) || step <= 0 || step > 1) throw new RangeError('Mutation step must be in (0, 1].');

  for (let attempt = 0; attempt < 100; attempt++) {
    const changed = source.map(value => random() < probability ? value + ((random() * 2) - 1) * step : value);
    const normalized = normalizeMutatedWeights(changed);
    if (normalized) return normalized;
  }
  throw new Error('Unable to produce a valid mutated candidate after 100 attempts.');
}

function rankPopulation(population) {
  return population.map(validateCandidate).slice().sort((a, b) => {
    const fitnessDifference = (b.fitness || 0) - (a.fitness || 0);
    return fitnessDifference || a.id.localeCompare(b.id);
  });
}

function tournamentSelect(population, random, tournamentSize = DEFAULTS.tournamentSize) {
  if (!Array.isArray(population) || population.length < 2) throw new TypeError('Tournament requires at least two candidates.');
  if (typeof random !== 'function') throw new TypeError('A seeded random function is required.');
  if (!Number.isInteger(tournamentSize) || tournamentSize < 2) throw new RangeError('Tournament size must be at least 2.');
  let winner = null;
  for (let i = 0; i < tournamentSize; i++) {
    const candidate = population[Math.floor(random() * population.length)];
    if (!winner || (candidate.fitness || 0) > (winner.fitness || 0) ||
        ((candidate.fitness || 0) === (winner.fitness || 0) && candidate.id < winner.id)) winner = candidate;
  }
  return winner;
}

function createNextGeneration(evaluatedPopulation, generation, random, settings = {}) {
  if (!Number.isInteger(generation) || generation < 1) throw new RangeError('Generation index must be a positive integer.');
  if (typeof random !== 'function') throw new TypeError('A seeded random function is required.');
  const population = rankPopulation(evaluatedPopulation);
  const eliteCount = settings.eliteCount === undefined ? DEFAULTS.eliteCount : settings.eliteCount;
  const tournamentSize = settings.tournamentSize === undefined ? DEFAULTS.tournamentSize : settings.tournamentSize;
  if (!Number.isInteger(eliteCount) || eliteCount < 1 || eliteCount >= population.length) {
    throw new RangeError('Elite count must be positive and smaller than the population.');
  }

  const next = population.slice(0, eliteCount).map((candidate, index) => ({
    id: 'g' + generation + '-c' + String(index + 1).padStart(2, '0'),
    weights: normalizeWeights(candidate.weights)
  }));
  while (next.length < population.length) {
    const parent = tournamentSelect(population, random, tournamentSize);
    next.push({
      id: 'g' + generation + '-c' + String(next.length + 1).padStart(2, '0'),
      weights: mutateWeights(parent.weights, random, settings)
    });
  }
  return next;
}

function scoreMatches(matches) {
  if (!Array.isArray(matches) || matches.length !== 8) {
    throw new RangeError('Each candidate requires exactly eight completed v1 fixtures.');
  }
  if (matches.some(match => !match || match.valid === false ||
      ![0, 0.5, 1].includes(match.candidateScore) || !OPPONENTS.includes(match.opponent))) {
    throw new Error('Candidate evaluation contains an invalid match result.');
  }
  const byOpponent = {};
  for (const opponent of OPPONENTS) {
    const group = matches.filter(match => match.opponent === opponent);
    if (group.length !== 4) throw new Error('Each v1 opponent must have exactly four fixtures.');
    byOpponent[opponent] = group.reduce((sum, match) => sum + match.candidateScore, 0) / group.length;
  }
  return {
    fitness: matches.reduce((sum, match) => sum + match.candidateScore, 0) / matches.length,
    byOpponent,
    wins: matches.filter(match => match.candidateScore === 1).length,
    draws: matches.filter(match => match.candidateScore === 0.5).length,
    losses: matches.filter(match => match.candidateScore === 0).length
  };
}

function hashSeed(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createFixtures(baseSeed, generation) {
  validateSeed(baseSeed);
  if (!Number.isInteger(generation) || generation < 0 || generation >= DEFAULTS.generations) {
    throw new RangeError('Generation must be within the v1 range 0–7.');
  }
  const fixtures = [];
  for (const opponent of OPPONENTS) {
    for (const layout of LAYOUTS) {
      for (const candidateColor of COLOURS) {
        const key = [baseSeed, generation, opponent, layout, candidateColor].join('|');
        fixtures.push({
          seed: hashSeed(key),
          generation,
          opponent,
          layout,
          candidateColor
        });
      }
    }
  }
  return fixtures;
}

function createMatchAdapter(api) {
  return {
    clonePosition: api.clone,
    allLegalState: api.allLegalState,
    inCheck: api.inCheck,
    applyRaw: api.applyRaw,
    getPositionKey: api.getPositionKey
  };
}

function terminalResult(api, state) {
  const legalMoves = api.allLegalState(state, state.turn);
  if (!legalMoves.length) {
    const checked = api.inCheck(state.turn, state.board, state.moats);
    return {
      winner: checked ? (state.turn === 'w' ? 'b' : 'w') : null,
      termination: checked ? 'checkmate' : 'stalemate'
    };
  }
  return null;
}

function runMatch(candidate, fixture, options = {}) {
  validateCandidate(candidate);
  if (!fixture || !Number.isSafeInteger(fixture.seed) || fixture.seed < 0 ||
      !OPPONENTS.includes(fixture.opponent) || !LAYOUTS.includes(fixture.layout) ||
      !COLOURS.includes(fixture.candidateColor)) {
    throw new TypeError('Match fixture is invalid.');
  }

  const maxPlies = options.maxPlies === undefined ? DEFAULTS.maxPlies : options.maxPlies;
  const searchDepth = options.searchDepth === undefined ? DEFAULTS.searchDepth : options.searchDepth;
  const searchNodeLimit = options.searchNodeLimit === undefined ? DEFAULTS.searchNodeLimit : options.searchNodeLimit;
  const opponentBudgetScale = options.opponentBudgetScale === undefined ? DEFAULTS.opponentBudgetScale : options.opponentBudgetScale;
  if (!Number.isInteger(maxPlies) || maxPlies < 2) throw new RangeError('maxPlies must be at least 2.');
  const sandbox = calibration.createHarness(fixture.seed);
  const api = sandbox.calibrationApi;
  const adapter = createMatchAdapter(api);
  let state = calibration.initialPosition(fixture.layout === 'center' ? 'center' : 'classic');
  state.positionHistory[api.getPositionKey(state)] = 1;
  api.setState(state);
  let plies = 0;
  let outcome = null;
  let candidateNodes = 0;

  while (plies < maxPlies) {
    state = api.getState();
    outcome = terminalResult(api, state);
    if (outcome) break;

    let move;
    if (state.turn === fixture.candidateColor) {
      const result = searchBestMove(state, candidate.weights, adapter, {
        depth: searchDepth,
        nodeLimit: searchNodeLimit
      });
      candidateNodes += result.nodes;
      move = api.findLegalMoveMatch(state, result.move);
      if (!move) throw new Error('Candidate ' + candidate.id + ' failed to return a canonical legal move.');
    } else {
      const result = calibration.searchMove(sandbox, state, fixture.opponent, opponentBudgetScale);
      if (!result.move) throw new Error(fixture.opponent + ' failed to return a move in a non-terminal position.');
      move = result.move;
    }

    api.play(move, 'q', true);
    plies++;
    state = api.getState();
    if (state.phase === 'place_moat_w' || state.phase === 'place_moat_b') {
      state = calibration.finishMoats(sandbox, state);
    }
    if (api.getGameOver()) {
      outcome = terminalResult(api, state) || { winner: null, termination: 'draw' };
      break;
    }
  }

  if (!outcome) outcome = terminalResult(api, api.getState()) || { winner: null, termination: 'max-plies' };
  const candidateScore = outcome.winner === null ? 0.5 :
    (outcome.winner === fixture.candidateColor ? 1 : 0);

  return {
    candidateId: candidate.id,
    seed: fixture.seed,
    generation: fixture.generation,
    opponent: fixture.opponent,
    layout: fixture.layout,
    candidateColor: fixture.candidateColor,
    candidateScore,
    winner: outcome.winner,
    termination: outcome.termination,
    plies,
    candidateNodes
  };
}

function evaluateCandidate(candidate, fixtures, matchRunner = runMatch, options = {}) {
  validateCandidate(candidate);
  if (!Array.isArray(fixtures) || fixtures.length !== 8 || typeof matchRunner !== 'function') {
    throw new TypeError('Candidate evaluation requires the fixed eight-fixture v1 schedule.');
  }
  const matches = fixtures.map(fixture => matchRunner(candidate, fixture, options));
  return { candidate: { id: candidate.id, weights: normalizeWeights(candidate.weights) }, ...scoreMatches(matches), matches };
}

function runGeneration(population, control, fixtures, matchRunner = runMatch, options = {}) {
  if (!Array.isArray(population) || population.length < 4 || population.length > 8) {
    throw new RangeError('Generation requires 4–8 evolving candidates.');
  }
  validateCandidate(control);
  const evaluated = population.map(candidate => evaluateCandidate(candidate, fixtures, matchRunner, options));
  const controlEvaluation = evaluateCandidate(control, fixtures, matchRunner, options);
  return { generation: fixtures[0].generation, evaluated, control: controlEvaluation };
}

module.exports = {
  DEFAULTS,
  OPPONENTS,
  equalWeights,
  randomWeights,
  validateCandidate,
  createInitialPopulation,
  mutateWeights,
  tournamentSelect,
  createNextGeneration,
  scoreMatches,
  createFixtures,
  runMatch,
  evaluateCandidate,
  runGeneration
};
