/* Purpose: run reproducible equal-weight baseline matches and measure semantic feature costs offline. */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const core = require('./evolutionary-core');
const calibration = require('./engine-strength-calibration');
const { createFeatureExtractor } = require('./evolutionary-features');

const DEFAULTS = Object.freeze({
  games: 8,
  maxPlies: core.DEFAULTS.maxPlies,
  searchDepth: core.DEFAULTS.searchDepth,
  searchNodeLimit: core.DEFAULTS.searchNodeLimit,
  opponentBudgetScale: core.DEFAULTS.opponentBudgetScale,
  featureIterations: 20
});
const DEFAULT_OUTPUT = path.join(os.homedir(), '.jester-and-moat', 'evolutionary-baselines');
const FEATURE_IDS = require('./evolutionary-features').FEATURE_IDS;

function parseArgs(argv) {
  const options = {};
  const allowed = ['seed', 'games', 'max-plies', 'search-depth', 'node-limit', 'opponent-budget-scale', 'feature-iterations', 'output-dir'];
  for (let index = 0; index < argv.length; index++) {
    const token = argv[index];
    if (!token.startsWith('--')) throw new Error('Unexpected argument: ' + token);
    const equal = token.indexOf('=');
    const key = token.slice(2, equal < 0 ? undefined : equal);
    const value = equal >= 0 ? token.slice(equal + 1) : argv[++index];
    if (!key || value === undefined || value.startsWith('--')) throw new Error('Missing value for --' + key + '.');
    if (Object.prototype.hasOwnProperty.call(options, key)) throw new Error('Duplicate option: --' + key);
    if (!allowed.includes(key)) throw new Error('Unknown option for baseline: --' + key);
    options[key] = value;
  }
  return options;
}

function numberOption(options, key, fallback, validate) {
  const value = options[key] === undefined ? fallback : Number(options[key]);
  if (!Number.isFinite(value) || !validate(value)) throw new RangeError('Invalid --' + key + ' value: ' + options[key]);
  return value;
}

function sourceCommit() {
  if (process.env.GITHUB_SHA || process.env.SOURCE_COMMIT) return process.env.GITHUB_SHA || process.env.SOURCE_COMMIT;
  try { return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch (_) { return 'local-uncommitted'; }
}

function createFixtures(seed, games) {
  if (!Number.isSafeInteger(seed) || seed < 0) throw new RangeError('Seed must be a non-negative safe integer.');
  if (!Number.isInteger(games) || games < 4 || games > 64 || games % 4 !== 0) {
    throw new RangeError('Games must be a multiple of four from 4 to 64 for full colour/layout balance.');
  }
  const random = core.createSeededRandom(seed);
  return Array.from({ length: games }, (_, index) => ({
    seed: Math.floor(random() * 0x100000000),
    generation: 0,
    layout: Math.floor(index / 2) % 2 === 0 ? 'edges' : 'center',
    candidateColor: index % 2 === 0 ? 'w' : 'b'
  }));
}

function summarize(matches) {
  const wins = matches.filter(match => match.candidateScore === 1).length;
  const draws = matches.filter(match => match.candidateScore === 0.5).length;
  const losses = matches.filter(match => match.candidateScore === 0).length;
  return { games: matches.length, wins, draws, losses, score: (wins + draws * 0.5) / matches.length };
}

function measureFeatureCosts(seed, iterations) {
  const sandbox = calibration.createHarness(seed);
  const api = sandbox.calibrationApi;
  const extractor = createFeatureExtractor(core.createMatchAdapter(api));
  const layouts = {};
  for (const layout of ['edges', 'center']) {
    const position = calibration.initialPosition(layout === 'center' ? 'center' : 'classic');
    position.positionHistory[api.getPositionKey(position)] = 1;
    layouts[layout] = extractor.measureFeatureCosts(position, iterations);
  }
  return { iterationsPerLayout: iterations, unit: 'milliseconds per feature extraction', layouts };
}

function markdown(report) {
  const lines = [
    '# Evolutionary baseline measurement',
    '',
    '- Run: ' + report.runId,
    '- Source commit: ' + report.sourceCommit,
    '- Seed: ' + report.seed,
    '- Runtime: ' + report.runtime.node + ' / ' + report.runtime.platform + ' / ' + report.runtime.arch,
    '- Runner: ' + report.runtime.runner,
    '- Games per reference: ' + report.config.games,
    '- Max plies: ' + report.config.maxPlies,
    '',
    '## Primary reference — Equal-weight self-play',
    '',
    'W-D-L: ' + report.primary.wins + '-' + report.primary.draws + '-' + report.primary.losses +
      '; designated-side score: ' + (report.primary.score * 100).toFixed(1) + '%',
    '',
    '## Secondary reference — Equal-weight vs MinMax Medium',
    '',
    'W-D-L: ' + report.secondary.wins + '-' + report.secondary.draws + '-' + report.secondary.losses +
      '; Equal-weight score: ' + (report.secondary.score * 100).toFixed(1) + '%',
    '',
    '## Feature extraction cost (ms per extraction)',
    '',
    '| Feature | Edges | Center |',
    '|---|---:|---:|'
  ];
  for (const id of FEATURE_IDS) lines.push('| ' + id + ' | ' +
    report.featureCosts.layouts.edges[id].toFixed(4) + ' | ' +
    report.featureCosts.layouts.center[id].toFixed(4) + ' |');
  lines.push('', '## Limitations', '',
    '- These are baseline observations, not performance floors or holdout results.',
    '- Timed search and measured costs depend on runner/device conditions.',
    '- Equal-weight self-play measures the frozen reference against itself; it is not an independent strength rating.',
    '- The same seed/layout/colour fixtures are used for both reference comparisons.',
    '');
  return lines.join('\n');
}

function runBaseline(options = {}) {
  const seed = numberOption(options, 'seed', undefined, value => Number.isSafeInteger(value) && value >= 0);
  const config = {
    games: numberOption(options, 'games', DEFAULTS.games, value => Number.isInteger(value) && value >= 4 && value <= 64 && value % 4 === 0),
    maxPlies: numberOption(options, 'max-plies', DEFAULTS.maxPlies, value => Number.isInteger(value) && value >= 2 && value <= 120),
    searchDepth: numberOption(options, 'search-depth', DEFAULTS.searchDepth, value => Number.isInteger(value) && value >= 1 && value <= 4),
    searchNodeLimit: numberOption(options, 'node-limit', DEFAULTS.searchNodeLimit, value => Number.isInteger(value) && value >= 100 && value <= 20000),
    opponentBudgetScale: numberOption(options, 'opponent-budget-scale', DEFAULTS.opponentBudgetScale, value => value > 0 && value <= 1),
    featureIterations: numberOption(options, 'feature-iterations', DEFAULTS.featureIterations, value => Number.isInteger(value) && value >= 1 && value <= 1000)
  };
  const startedAt = new Date().toISOString();
  const started = process.hrtime.bigint();
  const runId = 'baseline-' + startedAt.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z') + '-s' + seed + '-' + crypto.randomUUID().slice(0, 8);
  const fixtures = createFixtures(seed, config.games);
  const control = { id: 'equal-weight-control', weights: core.equalWeights(), frozen: true };
  const matchOptions = {
    maxPlies: config.maxPlies,
    searchDepth: config.searchDepth,
    searchNodeLimit: config.searchNodeLimit,
    opponentBudgetScale: config.opponentBudgetScale
  };
  const primaryMatches = [];
  const secondaryMatches = [];
  for (const fixture of fixtures) {
    const primaryStart = process.hrtime.bigint();
    const primary = core.runSelfPlayMatch(control, fixture, matchOptions);
    primaryMatches.push({ ...primary, elapsedMs: Number(process.hrtime.bigint() - primaryStart) / 1e6 });
    const secondaryStart = process.hrtime.bigint();
    const secondary = core.runMatch(control, { ...fixture, opponent: 'minmax-2' }, matchOptions);
    secondaryMatches.push({ ...secondary, elapsedMs: Number(process.hrtime.bigint() - secondaryStart) / 1e6 });
  }
  const featureCosts = measureFeatureCosts(seed, config.featureIterations);
  const report = {
    reportSchemaVersion: 1,
    runId,
    status: 'completed',
    sourceCommit: sourceCommit(),
    seed,
    config,
    runtime: {
      node: process.version,
      platform: os.platform(),
      arch: os.arch(),
      runner: process.env.RUNNER_NAME || 'local',
      actionsRunId: process.env.GITHUB_RUN_ID || null,
      actionsRunAttempt: process.env.GITHUB_RUN_ATTEMPT || null
    },
    startedAt,
    completedAt: new Date().toISOString(),
    elapsedMs: Number(process.hrtime.bigint() - started) / 1e6,
    fixtureSchedule: fixtures,
    primary: { ...summarize(primaryMatches), matches: primaryMatches },
    secondary: { ...summarize(secondaryMatches), matches: secondaryMatches },
    featureCosts
  };
  const directory = path.resolve(options['output-dir'] || DEFAULT_OUTPUT, runId);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'baseline.json'), JSON.stringify(report, null, 2) + '\n');
  fs.writeFileSync(path.join(directory, 'summary.md'), markdown(report) + '\n');
  process.stdout.write(JSON.stringify({ runId, outputDirectory: directory, gamesPerReference: config.games, elapsedMs: report.elapsedMs }) + '\n');
  return report;
}

module.exports = { DEFAULTS, parseArgs, createFixtures, summarize, measureFeatureCosts, runBaseline, markdown };
