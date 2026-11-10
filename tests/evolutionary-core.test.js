/* Purpose: verify evolutionary feature semantics, bounded operators, fixtures, and real-rule match smoke paths. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  FEATURE_IDS,
  createFeatureExtractor
} = require('../scripts/evolutionary-features');
const {
  DEFAULTS,
  equalWeights,
  createSeededRandom,
  createInitialPopulation,
  mutateWeights,
  createNextGeneration,
  scoreMatches,
  createFixtures,
  validateFixtures,
  runMatch
} = require('../scripts/evolutionary-core');
const { searchBestMove } = require('../scripts/evolutionary-search');

function samplePosition() {
  const board = Array.from({ length: 8 }, () => Array(10).fill(null));
  const put = (row, col, type, color) => { board[row][col] = { type, color, moved: true }; };
  put(7, 4, 'k', 'w');
  put(0, 4, 'k', 'b');
  put(4, 3, 'r', 'w');
  put(3, 6, 'n', 'b');
  put(5, 2, 'j', 'w');
  put(2, 7, 'j', 'b');
  put(0, 8, 'j', 'b');
  for (let i = 0; i < 5; i++) put(6, i, 'p', 'w');
  for (let i = 0; i < 4; i++) put(1, i, 'p', 'b');
  put(6, 7, 'n', 'w');
  put(2, 5, 'b', 'b');
  put(1, 8, 'n', 'b');
  put(7, 0, 'b', 'w');
  put(0, 0, 'r', 'b');
  put(7, 9, 'q', 'w');
  return {
    variant: { id: 'jester-moat', version: 1 },
    setupId: 'edges',
    board,
    turn: 'w',
    ply: 12,
    moats: { w: null, b: null },
    moatDestroyed: { w: false, b: false },
    positionHistory: {},
    halfmoveClock: 0,
    legalMoves: {
      w: [
        { from: { r: 5, c: 2 }, to: { r: 4, c: 2 } },
        { from: { r: 5, c: 2 }, to: { r: 4, c: 3 }, swap: true }
      ],
      b: [{ from: { r: 2, c: 7 }, to: { r: 3, c: 7 } }]
    },
    checks: { w: false, b: true }
  };
}

function fakeAdapter() {
  return {
    clonePosition(position) { return JSON.parse(JSON.stringify(position)); },
    allLegalState(position, side) {
      assert.equal(position.turn, side);
      return position.legalMoves[side].map(move => JSON.parse(JSON.stringify(move)));
    },
    inCheck(side) { return samplePosition().checks[side]; }
  };
}

test('schema-v1 features use the approved normalized White-minus-Black semantics', () => {
  const position = samplePosition();
  const features = createFeatureExtractor(fakeAdapter()).extractFeatures(position);
  assert.deepEqual(Object.keys(features), FEATURE_IDS);
  assert.equal(features['material.pawn'], 0.1);
  assert.equal(features['material.knight'], -0.5);
  assert.equal(features['material.queen'], 1);
  assert.equal(features['material.jester'], -0.5);
  assert.equal(features['activity.mobility'], 1 / 40);
  assert.equal(features['activity.central'], -1 / 16);
  assert.equal(features['activity.jester'], 1 / 24);
  assert.equal(features['safety.king-in-check'], 1);
  for (const value of Object.values(features)) assert.ok(value >= -1 && value <= 1);
});

test('feature extraction is read-only and rejects unsupported variants', () => {
  const position = samplePosition();
  const before = JSON.stringify(position);
  createFeatureExtractor(fakeAdapter()).extractFeatures(position);
  assert.equal(JSON.stringify(position), before);
  const unsupported = samplePosition();
  unsupported.variant.version = 2;
  assert.throws(() => createFeatureExtractor(fakeAdapter()).extractFeatures(unsupported), /jester-moat v1/);
});

test('feature costs are reported separately and remain finite', () => {
  const costs = createFeatureExtractor(fakeAdapter()).measureFeatureCosts(samplePosition(), 2);
  assert.deepEqual(Object.keys(costs), FEATURE_IDS);
  for (const value of Object.values(costs)) assert.ok(Number.isFinite(value) && value >= 0);
});

test('evolutionary PRNG state can be restored exactly', () => {
  const random = createSeededRandom(0x123456789);
  random();
  const checkpointState = random.getState();
  const expectedNext = random();
  const resumed = createSeededRandom(0x123456789, checkpointState);
  assert.equal(resumed(), expectedNext);
  assert.throws(() => createSeededRandom(1, -1), /unsigned 32-bit/);
});

test('initial population is seeded and keeps equal-weight control outside evolving candidates', () => {
  const first = createInitialPopulation(20261110, 4);
  const second = createInitialPopulation(20261110, 4);
  assert.deepEqual(first, second);
  assert.equal(first.population.length, 4);
  assert.equal(first.control.frozen, true);
  assert.equal(first.control.id, 'equal-weight-control');
  assert.ok(first.population.every(candidate => candidate.weights.length === FEATURE_IDS.length));
  assert.ok(first.population.every(candidate => Math.abs(candidate.weights.reduce((a, b) => a + b, 0) - 1) < 1e-9));
  assert.throws(() => createInitialPopulation(1, 3), /4–8/);
});

test('mutation remains bounded and normalized', () => {
  const random = (() => { let value = 0; return () => ((value++ % 7) + 1) / 8; })();
  const mutated = mutateWeights(equalWeights(), random, { mutationProbability: 1, mutationStep: 0.1 });
  assert.equal(mutated.length, FEATURE_IDS.length);
  assert.ok(mutated.every(value => Number.isFinite(value) && value >= 0 && value <= 1));
  assert.ok(Math.abs(mutated.reduce((a, b) => a + b, 0) - 1) < 1e-9);
});

test('next generation preserves elites and creates stable candidate IDs', () => {
  const population = createInitialPopulation(22, 4).population.map((candidate, index) => ({
    ...candidate,
    fitness: index / 3
  }));
  const randomA = (() => { let x = 0; return () => ((x++ * 17) % 97) / 97; })();
  const randomB = (() => { let x = 0; return () => ((x++ * 17) % 97) / 97; })();
  const a = createNextGeneration(population, 1, randomA);
  const b = createNextGeneration(population, 1, randomB);
  assert.deepEqual(a, b);
  assert.equal(a.length, 4);
  assert.deepEqual(a[0].weights, population[3].weights);
  assert.deepEqual(a[1].weights, population[2].weights);
  assert.deepEqual(a.map(candidate => candidate.id), ['g1-c01', 'g1-c02', 'g1-c03', 'g1-c04']);
});

test('fixture schedule is reproducible and balanced across both opponents, layouts, and colours', () => {
  const fixtures = createFixtures(42, 3);
  assert.deepEqual(fixtures, createFixtures(42, 3));
  assert.equal(fixtures.length, 8);
  for (const opponent of ['minmax-2', 'mcts-2']) {
    const group = fixtures.filter(fixture => fixture.opponent === opponent);
    assert.equal(group.length, 4);
    assert.deepEqual(group.map(fixture => fixture.layout).sort(), ['center', 'center', 'edges', 'edges']);
    assert.deepEqual(group.map(fixture => fixture.candidateColor).sort(), ['b', 'b', 'w', 'w']);
  }
  assert.notDeepEqual(fixtures, createFixtures(43, 3));
  const unbalanced = fixtures.slice();
  unbalanced[0] = { ...unbalanced[0], candidateColor: unbalanced[1].candidateColor };
  assert.throws(() => validateFixtures(unbalanced), /each opponent\/layout\/colour combination/);
});

test('fitness uses game scores and requires four matches against each fixed opponent', () => {
  const matches = createFixtures(9, 0).map((fixture, index) => ({
    ...fixture,
    candidateScore: index % 2 ? 0.5 : 1
  }));
  const score = scoreMatches(matches);
  assert.equal(score.fitness, 0.75);
  assert.equal(score.byOpponent['minmax-2'], 0.75);
  assert.equal(score.byOpponent['mcts-2'], 0.75);
  assert.equal(score.wins, 4);
  assert.equal(score.draws, 4);
  assert.equal(score.losses, 0);
  assert.throws(() => scoreMatches(matches.slice(0, 7)), /exactly eight/);
  assert.ok(DEFAULTS.populationSize === 8);
});

test('candidate alpha-beta search returns a canonical move without mutating its input', () => {
  const position = samplePosition();
  const before = JSON.stringify(position);
  const adapter = {
    ...fakeAdapter(),
    applyRaw(next, move) {
      next.turn = next.turn === 'w' ? 'b' : 'w';
      next.ply++;
      next.legalMoves = { w: [], b: [] };
    },
    getPositionKey() { return 'sample'; }
  };
  const result = searchBestMove(position, equalWeights(), adapter, { depth: 1, nodeLimit: 20 });
  assert.ok(result.move);
  assert.equal(JSON.stringify(position), before);
  assert.ok(result.nodes > 0);
});

test('real-rule match smoke path accepts both fixed training opponents', () => {
  const candidate = { id: 'smoke-candidate', weights: equalWeights() };
  const fixtures = createFixtures(123, 0);
  for (const opponent of ['minmax-2', 'mcts-2']) {
    const fixture = fixtures.find(item => item.opponent === opponent);
    const result = runMatch(candidate, fixture, {
      maxPlies: 2,
      searchDepth: 1,
      searchNodeLimit: 200,
      opponentBudgetScale: 0.001
    });
    assert.equal(result.plies, 2);
    assert.equal(result.termination, 'max-plies');
    assert.ok([0, 0.5, 1].includes(result.candidateScore));
  }
});
