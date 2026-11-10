/* Purpose: verify reproducible baseline fixtures, balanced comparisons, feature-cost output, and bounded CLI options. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const baseline = require('../scripts/evolutionary-baseline');
const core = require('../scripts/evolutionary-core');

test('baseline fixtures are deterministic and fully balanced across layouts and colours', () => {
  const fixtures = baseline.createFixtures(20261110, 8);
  assert.deepEqual(fixtures, baseline.createFixtures(20261110, 8));
  assert.equal(fixtures.length, 8);
  assert.equal(new Set(fixtures.map(f => f.seed)).size, 8);
  for (const layout of ['edges', 'center']) {
    for (const colour of ['w', 'b']) {
      assert.equal(fixtures.filter(f => f.layout === layout && f.candidateColor === colour).length, 2);
    }
  }
  assert.throws(() => baseline.createFixtures(1, 6), /multiple of four/);
});

test('frozen equal-weight self-play completes legal real-rule plies', () => {
  const fixture = baseline.createFixtures(123, 4)[0];
  const result = core.runSelfPlayMatch(
    { id: 'equal-weight-control', weights: core.equalWeights(), frozen: true },
    fixture,
    { maxPlies: 2, searchDepth: 1, searchNodeLimit: 200 }
  );
  assert.equal(result.plies, 2);
  assert.equal(result.opponent, 'equal-weight-control');
  assert.equal(result.termination, 'max-plies');
  assert.ok([0, 0.5, 1].includes(result.candidateScore));
});

test('baseline summary scores wins, draws, and losses without claiming a strength rating', () => {
  assert.deepEqual(baseline.summarize([
    { candidateScore: 1 }, { candidateScore: 0.5 }, { candidateScore: 0 }
  ]), { games: 3, wins: 1, draws: 1, losses: 1, score: 0.5 });
});

test('feature-cost measurement reports every feature separately for both layouts', () => {
  const result = baseline.measureFeatureCosts(17, 1);
  assert.equal(result.iterationsPerLayout, 1);
  for (const layout of ['edges', 'center']) {
    assert.ok(Object.keys(result.layouts[layout]).length > 0);
    for (const value of Object.values(result.layouts[layout])) assert.ok(Number.isFinite(value) && value >= 0);
  }
});

test('baseline CLI validates seed, game balance, and bounded measurement settings', () => {
  assert.deepEqual(baseline.parseArgs(['--seed', '17', '--games', '4']), { seed: '17', games: '4' });
  assert.throws(() => baseline.createFixtures(-1, 4), /Seed/);
  assert.throws(() => baseline.createFixtures(1, 68), /multiple of four/);
});
