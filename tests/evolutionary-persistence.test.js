/* Purpose: verify atomic evolutionary persistence, strict recovery, and guarded package export. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  RECORD_SCHEMA_VERSION, CHECKPOINT_SCHEMA_VERSION, PARAMETER_SCHEMA_VERSION, TRAINER_VERSION,
  appendEvent, readEvents, writeCheckpoint, readCheckpoint, validateCheckpoint,
  validateExport, exportPackage
} = require('../scripts/evolutionary-persistence');
const { equalWeights, createInitialPopulation, createFixtures } = require('../scripts/evolutionary-core');

function temporaryDirectory() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'jester-evo-'));
}

function checkpoint(overrides = {}) {
  return {
    checkpointSchemaVersion: CHECKPOINT_SCHEMA_VERSION,
    runId: 'run-test',
    sourceCommit: 'abc123',
    trainerVersion: TRAINER_VERSION,
    featureSchemaVersion: 1,
    parameterSchemaVersion: PARAMETER_SCHEMA_VERSION,
    config: { populationSize: 4, generations: 2, maxPlies: 120, searchDepth: 2, searchNodeLimit: 5000, opponentBudgetScale: 1 },
    baseSeed: 17,
    randomState: 99,
    completedGeneration: 0,
    population: createInitialPopulation(17, 4).population,
    control: { id: 'equal-weight-control', weights: equalWeights(), frozen: true },
    completedGenerations: [{ generation: 0 }],
    overallBest: { id: 'g0-c01', weights: equalWeights(), fitness: 0.75 },
    fixtureSchedule: { generation: 0, fixtures: createFixtures(17, 0) },
    reportSnapshot: { runId: 'run-test', status: 'running', sourceCommit: 'abc123', config: { populationSize: 4, generations: 2, maxPlies: 120, searchDepth: 2, searchNodeLimit: 5000, opponentBudgetScale: 1 }, completedGenerations: [{ generation: 0 }], prng: { finalState: 99 } },
    ...overrides
  };
}

test('generation checkpoints are atomically written and strictly read back', () => {
  const directory = temporaryDirectory();
  const file = path.join(directory, 'checkpoint.json');
  writeCheckpoint(file, checkpoint());
  const loaded = readCheckpoint(file, { sourceCommit: 'abc123', config: { populationSize: 4, generations: 2, maxPlies: 120, searchDepth: 2, searchNodeLimit: 5000, opponentBudgetScale: 1 } });
  assert.equal(loaded.runId, 'run-test');
  assert.equal(fs.readdirSync(directory).some(name => name.includes('.tmp-')), false);
  assert.throws(() => readCheckpoint(file, { sourceCommit: 'different' }), /source commit is incompatible/);
  assert.throws(() => readCheckpoint(file, { config: { populationSize: 8 } }), /configuration does not match/);
});

test('checkpoint validation rejects unsupported, incomplete, and invalid population data', () => {
  assert.throws(() => validateCheckpoint(checkpoint({ checkpointSchemaVersion: 99 })), /Unsupported checkpoint/);
  assert.throws(() => validateCheckpoint(checkpoint({ randomState: -1 })), /malformed or incomplete/);
  assert.throws(() => validateCheckpoint(checkpoint({ population: [{ id: 'bad', weights: [1, 2] }] })), /schema-v1 feature set/);
});

test('JSONL events enforce schema, run identity, and monotonic sequence', () => {
  const directory = temporaryDirectory();
  const file = path.join(directory, 'run.jsonl');
  appendEvent(file, 'run-test', 1, 'run-started', { seed: 1 });
  appendEvent(file, 'run-test', 2, 'generation-completed', { fitness: 0.5 }, 0);
  const read = readEvents(file, 'run-test');
  assert.equal(read.events.length, 2);
  assert.equal(read.nextSequence, 3);
  assert.equal(read.events[0].recordSchemaVersion, RECORD_SCHEMA_VERSION);
  assert.throws(() => readEvents(file, 'other-run'), /contract/);
});

test('JSONL recovery reports an incomplete trailing record without accepting malformed complete records', () => {
  const directory = temporaryDirectory();
  const file = path.join(directory, 'run.jsonl');
  appendEvent(file, 'run-test', 1, 'run-started', {});
  fs.appendFileSync(file, '{"recordSchemaVersion":1');
  const read = readEvents(file, 'run-test');
  assert.equal(read.events.length, 1);
  assert.match(read.warning, /incomplete trailing/);
  assert.equal(fs.readFileSync(file, 'utf8').endsWith('\n'), true);
  fs.writeFileSync(file, '{"broken":true}\n');
  assert.throws(() => readEvents(file, 'run-test'), /Malformed complete JSONL/);
});

test('export is blocked without passing independent holdout evidence and explicit approval', () => {
  const report = {
    status: 'completed',
    completedGenerations: [{ candidates: [{ id: 'candidate-a', weights: equalWeights() }] }],
    holdoutEvaluations: {}
  };
  assert.throws(() => validateExport(report, 'candidate-a', { approved: true, reviewer: 'human' }), /no passing/);
  report.holdoutEvaluations['candidate-a'] = {
    status: 'passed', protocolVersion: 1, independentSetId: 'holdout-unique',
    baselineFloors: { primary: true, secondary: true }
  };
  assert.throws(() => validateExport(report, 'candidate-a', { approved: true }), /explicit human approval/);
  assert.equal(validateExport(report, 'candidate-a', { approved: true, reviewer: 'human' }).id, 'candidate-a');
});

test('validated export writes a versioned package with provenance', () => {
  const directory = temporaryDirectory();
  const report = {
    status: 'completed', runId: 'run-test', sourceCommit: 'abc123', baseSeed: 17,
    config: { populationSize: 4, generations: 2 },
    completedGenerations: [{ candidates: [{ id: 'candidate-a', weights: equalWeights() }] }],
    holdoutEvaluations: {
      'candidate-a': { status: 'passed', protocolVersion: 1, independentSetId: 'holdout-a',
        baselineFloors: { primary: true, secondary: true } }
    }
  };
  const output = path.join(directory, 'model.json');
  const pkg = exportPackage(output, report, 'candidate-a', { approved: true, reviewer: 'user' });
  const saved = JSON.parse(fs.readFileSync(output, 'utf8'));
  assert.equal(saved.packageSchemaVersion, 1);
  assert.equal(saved.modelId, 'evolutionary-candidate-a');
  assert.equal(saved.provenance.runId, 'run-test');
  assert.equal(pkg.provenance.humanApproval.reviewer, 'user');
});
