#!/usr/bin/env node
/* Purpose: run bounded evolutionary training locally or in GitHub Actions using shared versioned persistence. */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const core = require('./evolutionary-core');
const persistence = require('./evolutionary-persistence');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_OUTPUT = path.join(ROOT, 'evolutionary-runs');
const DEFAULTS = Object.freeze({
  populationSize: 8,
  generations: 8,
  maxPlies: core.DEFAULTS.maxPlies,
  searchDepth: core.DEFAULTS.searchDepth,
  searchNodeLimit: core.DEFAULTS.searchNodeLimit,
  opponentBudgetScale: core.DEFAULTS.opponentBudgetScale
});

function parseArgs(argv) {
  const command = argv[0];
  if (!['train', 'resume', 'evaluate', 'export'].includes(command)) {
    if (command === '--help' || command === '-h' || command === undefined) return { command: 'help' };
    throw new Error('Unknown command: ' + command);
  }
  const options = {};
  for (let index = 1; index < argv.length; index++) {
    const token = argv[index];
    if (!token.startsWith('--')) throw new Error('Unexpected argument: ' + token);
    const equal = token.indexOf('=');
    const key = token.slice(2, equal < 0 ? undefined : equal);
    const value = equal >= 0 ? token.slice(equal + 1) : argv[++index];
    if (!key || value === undefined || value.startsWith('--')) throw new Error('Missing value for --' + key + '.');
    if (Object.prototype.hasOwnProperty.call(options, key)) throw new Error('Duplicate option: --' + key);
    options[key] = value;
  }
  const allowed = {
    train: ['seed', 'population', 'generations', 'output-dir', 'max-plies', 'search-depth', 'node-limit', 'opponent-budget-scale'],
    resume: ['checkpoint', 'output-dir'],
    evaluate: ['report', 'candidate-id', 'protocol'],
    export: ['report', 'candidate-id', 'approval-file', 'output']
  }[command];
  for (const key of Object.keys(options)) if (!allowed.includes(key)) throw new Error('Unknown option for ' + command + ': --' + key);
  return { command, options };
}

function numberOption(options, key, fallback, validate) {
  const value = options[key] === undefined ? fallback : Number(options[key]);
  if (!Number.isFinite(value) || !validate(value)) throw new RangeError('Invalid --' + key + ' value: ' + options[key]);
  return value;
}

function helpText() {
  return [
    'Evolutionary trainer CLI',
    '',
    'train --seed N [--population 4..8] [--generations 1..8] [--output-dir DIR]',
    '      [--max-plies N] [--search-depth N] [--node-limit N] [--opponent-budget-scale N]',
    'resume --checkpoint FILE [--output-dir DIR]',
    'evaluate --report FILE --candidate-id ID --protocol FILE',
    'export --report FILE --candidate-id ID --approval-file FILE --output FILE',
    '',
    'Training defaults: population 8, generations 8; Actions pilot: population 4, generations 2.',
    'Each candidate plays eight fixed fixtures per generation plus a separate equal-weight control.',
    'Runs write run.jsonl, report.json, summary.md, and an atomic checkpoint after each generation.',
    'GitHub Actions retains run and checkpoint artifacts for 30 and 14 days respectively.',
    'evaluate fails closed until baseline floors and a predeclared statistical protocol are established.',
    'export requires a passing independent holdout record and explicit human approval.',
    ''
  ].join('\n');
}

function currentCommit() {
  return process.env.GITHUB_SHA || process.env.SOURCE_COMMIT || 'local-uncommitted';
}

function makeRunId(seed) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  return 'evo-' + stamp + '-s' + seed + '-' + crypto.randomUUID().slice(0, 8);
}

function createReport(runId, seed, config, sourceCommit) {
  return {
    reportSchemaVersion: 1,
    runId,
    status: 'running',
    sourceCommit,
    trainerVersion: persistence.TRAINER_VERSION,
    recordSchemaVersion: persistence.RECORD_SCHEMA_VERSION,
    checkpointSchemaVersion: persistence.CHECKPOINT_SCHEMA_VERSION,
    featureSchemaVersion: 1,
    parameterSchemaVersion: persistence.PARAMETER_SCHEMA_VERSION,
    baseSeed: seed,
    prng: { algorithm: 'mulberry32', initialSeed: seed },
    config,
    opponents: ['minmax-2', 'mcts-2'],
    fixtureSchedule: { fixturesPerCandidate: 8, layouts: ['edges', 'center'], candidateColours: ['w', 'b'] },
    terminalRules: { maxPlies: config.maxPlies, unfinishedGame: 'draw', engineFailure: 'invalid-evaluation' },
    runtime: { node: process.version, platform: os.platform(), arch: os.arch(), runner: process.env.RUNNER_NAME || 'local' },
    startedAt: new Date().toISOString(),
    completedAt: null,
    completedGenerations: [],
    overallBest: null,
    holdoutEvaluations: {},
    warnings: []
  };
}

function append(report, directory, sequence, type, payload, generation = null) {
  return persistence.appendEvent(path.join(directory, 'run.jsonl'), report.runId, sequence, type, payload, generation);
}

function checkpointFrom(report, state, generation, population, overallBest, fixtures) {
  return {
    checkpointSchemaVersion: persistence.CHECKPOINT_SCHEMA_VERSION,
    runId: report.runId,
    sourceCommit: report.sourceCommit,
    trainerVersion: persistence.TRAINER_VERSION,
    featureSchemaVersion: report.featureSchemaVersion,
    parameterSchemaVersion: report.parameterSchemaVersion,
    config: report.config,
    baseSeed: report.baseSeed,
    randomState: state.randomState,
    completedGeneration: generation,
    population,
    control: state.control,
    completedGenerations: report.completedGenerations,
    overallBest,
    fixtureSchedule: { generation, fixtures },
    updatedAt: new Date().toISOString()
  };
}

function generationSummary(result, generation) {
  const ranked = result.evaluated.slice().sort((a, b) => b.fitness - a.fitness || a.candidate.id.localeCompare(b.candidate.id));
  const candidates = result.evaluated.map(item => ({
    id: item.candidate.id,
    weights: item.candidate.weights,
    fitness: item.fitness,
    byOpponent: item.byOpponent,
    wins: item.wins,
    draws: item.draws,
    losses: item.losses,
    matches: item.matches
  }));
  return {
    generation,
    best: { id: ranked[0].candidate.id, weights: ranked[0].candidate.weights, fitness: ranked[0].fitness, byOpponent: ranked[0].byOpponent },
    control: { id: result.control.candidate.id, fitness: result.control.fitness, byOpponent: result.control.byOpponent },
    candidates
  };
}

function runTraining(report, directory, initialState, startGeneration, nextSequence) {
  let population = initialState.population;
  const control = initialState.control;
  let random = core.createSeededRandom(report.baseSeed, initialState.randomState);
  let overallBest = report.overallBest;
  let sequence = nextSequence;
  let stopRequested = false;
  const onSignal = () => { stopRequested = true; };
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);
  try {
    for (let generation = startGeneration; generation < report.config.generations; generation++) {
      if (stopRequested) break;
      const fixtures = core.createFixtures(report.baseSeed, generation);
      append(report, directory, sequence++, 'generation-started', { fixtureSchedule: fixtures }, generation);
      const result = core.runGeneration(population, control, fixtures, core.runMatch, {
        maxPlies: report.config.maxPlies,
        searchDepth: report.config.searchDepth,
        searchNodeLimit: report.config.searchNodeLimit,
        opponentBudgetScale: report.config.opponentBudgetScale
      });
      const summary = generationSummary(result, generation);
      for (const candidate of summary.candidates) {
        for (const match of candidate.matches) append(report, directory, sequence++, 'match-completed', {
          candidateId: candidate.id, ...match, opponentConfig: { profile: match.opponent, level: 2 }
        }, generation);
      }
      append(report, directory, sequence++, 'generation-completed', summary, generation);
      report.completedGenerations.push(summary);
      if (!overallBest || summary.best.fitness > overallBest.fitness ||
          (summary.best.fitness === overallBest.fitness && summary.best.id < overallBest.id)) {
        overallBest = { ...summary.best, generation };
      }
      report.overallBest = overallBest;
      const isFinal = generation + 1 >= report.config.generations;
      const nextPopulation = isFinal ? population : core.createNextGeneration(
        result.evaluated.map(item => ({ ...item.candidate, fitness: item.fitness })),
        generation + 1,
        random
      );
      const checkpoint = checkpointFrom(report, {
        randomState: random.getState(),
        control
      }, generation, nextPopulation, overallBest, fixtures);
      persistence.writeCheckpoint(path.join(directory, 'checkpoint.json'), checkpoint);
      population = nextPopulation;
      if (stopRequested) break;
    }
  } finally {
    process.removeListener('SIGINT', onSignal);
    process.removeListener('SIGTERM', onSignal);
  }
  const completed = report.completedGenerations.length;
  const finished = completed >= report.config.generations;
  report.status = finished ? 'completed' : 'interrupted';
  report.completedAt = new Date().toISOString();
  if (!finished) {
    report.warnings.push('Run stopped at a generation boundary; resume from checkpoint.json to continue.');
    append(report, directory, sequence++, 'run-interrupted', { completedGenerations: completed });
  } else append(report, directory, sequence++, 'run-completed', { overallBest: report.overallBest });
  report.finalEventSequence = sequence - 1;
  persistence.writeReport(directory, report);
  return report;
}

function train(options) {
  const seed = numberOption(options, 'seed', undefined, value => Number.isSafeInteger(value) && value >= 0);
  const config = {
    populationSize: numberOption(options, 'population', DEFAULTS.populationSize, value => Number.isInteger(value) && value >= 4 && value <= 8),
    generations: numberOption(options, 'generations', DEFAULTS.generations, value => Number.isInteger(value) && value >= 1 && value <= 8),
    maxPlies: numberOption(options, 'max-plies', DEFAULTS.maxPlies, value => Number.isInteger(value) && value >= 2 && value <= 120),
    searchDepth: numberOption(options, 'search-depth', DEFAULTS.searchDepth, value => Number.isInteger(value) && value >= 1 && value <= 4),
    searchNodeLimit: numberOption(options, 'node-limit', DEFAULTS.searchNodeLimit, value => Number.isInteger(value) && value >= 100 && value <= 20000),
    opponentBudgetScale: numberOption(options, 'opponent-budget-scale', DEFAULTS.opponentBudgetScale, value => value > 0 && value <= 1)
  };
  const runId = makeRunId(seed);
  const directory = path.resolve(options['output-dir'] || DEFAULT_OUTPUT, runId);
  fs.mkdirSync(directory, { recursive: true });
  const report = createReport(runId, seed, config, currentCommit());
  const initial = core.createInitialPopulation(seed, config.populationSize);
  append(report, directory, 1, 'run-started', { config, sourceCommit: report.sourceCommit });
  const final = runTraining(report, directory, initial, 0, 2);
  process.stdout.write(JSON.stringify({ runId: final.runId, status: final.status, outputDirectory: directory, completedGenerations: final.completedGenerations.length }) + '\n');
  return final;
}

function resume(options) {
  if (!options.checkpoint) throw new Error('resume requires --checkpoint FILE.');
  const checkpointPath = path.resolve(options.checkpoint);
  const checkpoint = persistence.readCheckpoint(checkpointPath, { sourceCommit: currentCommit() === 'local-uncommitted' ? undefined : currentCommit() });
  const directory = path.resolve(options['output-dir'] || path.dirname(checkpointPath));
  fs.mkdirSync(directory, { recursive: true });
  if (path.resolve(directory) !== path.dirname(checkpointPath)) {
    throw new Error('Resume output directory must be the checkpoint directory to preserve the run record stream.');
  }
  const reportPath = path.join(directory, 'report.json');
  if (!fs.existsSync(reportPath)) throw new Error('Resume requires the matching report.json beside the checkpoint.');
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  if (report.runId !== checkpoint.runId || report.sourceCommit !== checkpoint.sourceCommit ||
      !persistence.sameConfig(report.config, checkpoint.config)) throw new Error('Run report does not match checkpoint identity/configuration.');
  if (report.status === 'completed') throw new Error('Completed runs cannot be resumed.');
  const events = persistence.readEvents(path.join(directory, 'run.jsonl'), checkpoint.runId);
  if (events.warning) report.warnings.push(events.warning);
  const abandoned = events.events.filter(event => event.type === 'generation-started' && event.generation > checkpoint.completedGeneration);
  if (abandoned.length) append(report, directory, events.nextSequence++, 'generation-abandoned', {
    generations: [...new Set(abandoned.map(event => event.generation))]
  }, checkpoint.completedGeneration + 1);
  report.status = 'running';
  report.completedAt = null;
  const final = runTraining(report, directory, {
    population: checkpoint.population,
    control: checkpoint.control,
    randomState: checkpoint.randomState
  }, checkpoint.completedGeneration + 1, events.nextSequence);
  process.stdout.write(JSON.stringify({ runId: final.runId, status: final.status, outputDirectory: directory, completedGenerations: final.completedGenerations.length }) + '\n');
  return final;
}

function evaluate(options) {
  if (!options.report || !options['candidate-id'] || !options.protocol) {
    throw new Error('evaluate requires --report FILE, --candidate-id ID, and a predeclared --protocol FILE.');
  }
  throw new Error('Holdout evaluation is intentionally unavailable until baseline floors, confidence level, practical margins, fixture rules, and sequential-testing correction are predeclared and approved. No holdout result was generated.');
}

function exportCandidate(options) {
  for (const key of ['report', 'candidate-id', 'approval-file', 'output']) {
    if (!options[key]) throw new Error('export requires --' + key + '.');
  }
  const report = JSON.parse(fs.readFileSync(path.resolve(options.report), 'utf8'));
  const approval = JSON.parse(fs.readFileSync(path.resolve(options['approval-file']), 'utf8'));
  const pkg = persistence.exportPackage(path.resolve(options.output), report, options['candidate-id'], approval);
  process.stdout.write(JSON.stringify({ modelId: pkg.modelId, output: path.resolve(options.output) }) + '\n');
  return pkg;
}

function main(argv = process.argv.slice(2)) {
  const parsed = parseArgs(argv);
  if (parsed.command === 'help') { process.stdout.write(helpText()); return; }
  if (parsed.command === 'train') return train(parsed.options);
  if (parsed.command === 'resume') return resume(parsed.options);
  if (parsed.command === 'evaluate') return evaluate(parsed.options);
  if (parsed.command === 'export') return exportCandidate(parsed.options);
  throw new Error('Unsupported command.');
}

if (require.main === module) {
  try { main(); }
  catch (error) {
    process.stderr.write((error && error.stack) || String(error));
    process.stderr.write('\n');
    process.exitCode = 1;
  }
}

module.exports = { DEFAULTS, parseArgs, helpText, createReport, generationSummary, train, resume, evaluate, exportCandidate, main };
