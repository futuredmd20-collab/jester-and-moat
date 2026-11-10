/* Purpose: persist versioned evolutionary run events, reports, exports, and atomic generation checkpoints. */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { FEATURE_IDS, FEATURE_SCHEMA_VERSION } = require('./evolutionary-features');
const { normalizeWeights } = require('./evolutionary-search');

const RECORD_SCHEMA_VERSION = 1;
const CHECKPOINT_SCHEMA_VERSION = 1;
const PARAMETER_SCHEMA_VERSION = 1;
const TRAINER_VERSION = '0.1.0';

function stableJson(value) {
  if (Array.isArray(value)) return '[' + value.map(stableJson).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stableJson(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}

function sameConfig(a, b) {
  return stableJson(a) === stableJson(b);
}

function ensureDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

function writeJsonAtomic(filePath, value) {
  const directory = path.dirname(filePath);
  ensureDirectory(directory);
  const temporary = filePath + '.tmp-' + process.pid + '-' + Date.now();
  let fd;
  try {
    fd = fs.openSync(temporary, 'wx', 0o600);
    fs.writeFileSync(fd, JSON.stringify(value, null, 2) + '\n', 'utf8');
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    fs.renameSync(temporary, filePath);
    try {
      const dirFd = fs.openSync(directory, 'r');
      fs.fsyncSync(dirFd);
      fs.closeSync(dirFd);
    } catch (_) { /* Directory fsync is not available on every supported platform. */ }
  } catch (error) {
    if (fd !== undefined) fs.closeSync(fd);
    try { fs.unlinkSync(temporary); } catch (_) {}
    throw error;
  }
}

function appendEvent(filePath, runId, sequence, type, payload = {}, generation = null) {
  if (!Number.isSafeInteger(sequence) || sequence < 1) throw new RangeError('Event sequence must be a positive safe integer.');
  if (typeof runId !== 'string' || !runId) throw new TypeError('Event runId is required.');
  if (typeof type !== 'string' || !type) throw new TypeError('Event type is required.');
  ensureDirectory(path.dirname(filePath));
  const record = { recordSchemaVersion: RECORD_SCHEMA_VERSION, runId, sequence, type, generation, timestamp: new Date().toISOString(), payload };
  fs.appendFileSync(filePath, JSON.stringify(record) + '\n', { encoding: 'utf8', flag: 'a', mode: 0o600 });
  return record;
}

function readEvents(filePath, expectedRunId) {
  if (!fs.existsSync(filePath)) return { events: [], nextSequence: 1, warning: null };
  const raw = fs.readFileSync(filePath, 'utf8');
  const completeEnd = raw.lastIndexOf('\n');
  const completeText = completeEnd < 0 ? '' : raw.slice(0, completeEnd);
  const trailing = raw.slice(completeEnd + 1);
  const lines = completeText ? completeText.split('\n') : [];
  const events = [];
  for (let index = 0; index < lines.length; index++) {
    let record;
    try { record = JSON.parse(lines[index]); }
    catch (_) { throw new Error('Malformed complete JSONL event at line ' + (index + 1) + '.'); }
    if (!record || record.recordSchemaVersion !== RECORD_SCHEMA_VERSION ||
        record.runId !== expectedRunId || record.sequence !== index + 1 ||
        typeof record.type !== 'string' || !record.payload || typeof record.payload !== 'object') {
      throw new Error('Invalid JSONL event contract at line ' + (index + 1) + '.');
    }
    events.push(record);
  }
  if (trailing) fs.writeFileSync(filePath, completeText ? completeText + '\n' : '', 'utf8');
  return {
    events,
    nextSequence: events.length + 1,
    warning: trailing ? 'Discarded an incomplete trailing JSONL record during recovery.' : null
  };
}

function validateCheckpoint(checkpoint, expected = {}) {
  if (!checkpoint || typeof checkpoint !== 'object' || Array.isArray(checkpoint)) throw new TypeError('Checkpoint must be a JSON object.');
  if (checkpoint.checkpointSchemaVersion !== CHECKPOINT_SCHEMA_VERSION) throw new Error('Unsupported checkpoint schema version.');
  if (checkpoint.featureSchemaVersion !== FEATURE_SCHEMA_VERSION ||
      checkpoint.parameterSchemaVersion !== PARAMETER_SCHEMA_VERSION) throw new Error('Checkpoint feature or parameter schema is incompatible.');
  if (checkpoint.trainerVersion !== TRAINER_VERSION) throw new Error('Checkpoint trainer version is incompatible.');
  if (typeof checkpoint.runId !== 'string' || !checkpoint.runId ||
      !Number.isSafeInteger(checkpoint.baseSeed) || checkpoint.baseSeed < 0 ||
      !Number.isSafeInteger(checkpoint.randomState) || checkpoint.randomState < 0 || checkpoint.randomState > 0xffffffff ||
      !Number.isInteger(checkpoint.completedGeneration) || checkpoint.completedGeneration < 0 ||
      !Array.isArray(checkpoint.population) || !Array.isArray(checkpoint.completedGenerations) ||
      !checkpoint.config || typeof checkpoint.config !== 'object' ||
      !checkpoint.fixtureSchedule || typeof checkpoint.fixtureSchedule !== 'object' ||
      !checkpoint.reportSnapshot || typeof checkpoint.reportSnapshot !== 'object' ||
      typeof checkpoint.sourceCommit !== 'string' || !checkpoint.sourceCommit ||
      !checkpoint.control || typeof checkpoint.control.id !== 'string' ||
      !Array.isArray(checkpoint.fixtureSchedule.fixtures) || checkpoint.fixtureSchedule.fixtures.length !== 8) {
    throw new Error('Checkpoint is malformed or incomplete.');
  }
  if (checkpoint.population.length < 4 || checkpoint.population.length > 8 ||
      checkpoint.completedGenerations.length !== checkpoint.completedGeneration + 1 ||
      checkpoint.reportSnapshot.runId !== checkpoint.runId ||
      !sameConfig(checkpoint.reportSnapshot.config, checkpoint.config) ||
      !Array.isArray(checkpoint.reportSnapshot.completedGenerations) ||
      checkpoint.reportSnapshot.completedGenerations.length !== checkpoint.completedGenerations.length) {
    throw new Error('Checkpoint generation history or report snapshot is inconsistent.');
  }
  if (expected.runId && checkpoint.runId !== expected.runId) throw new Error('Checkpoint run ID does not match the requested run.');
  if (expected.sourceCommit && checkpoint.sourceCommit !== expected.sourceCommit) throw new Error('Checkpoint source commit is incompatible with this checkout.');
  if (expected.config && !sameConfig(checkpoint.config, expected.config)) throw new Error('Checkpoint immutable run configuration does not match.');
  for (const candidate of checkpoint.population) {
    if (!candidate || typeof candidate.id !== 'string') throw new Error('Checkpoint population contains an invalid candidate.');
    normalizeWeights(candidate.weights);
  }
  if (!checkpoint.overallBest) throw new Error('Checkpoint is missing its overall-best candidate.');
  if (checkpoint.control.id !== 'equal-weight-control') throw new Error('Checkpoint equal-weight control identity is invalid.');
  normalizeWeights(checkpoint.control.weights);
  if (checkpoint.overallBest) {
    normalizeWeights(checkpoint.overallBest.weights);
    if (!Number.isFinite(checkpoint.overallBest.fitness) || checkpoint.overallBest.fitness < 0 || checkpoint.overallBest.fitness > 1) {
      throw new Error('Checkpoint overall-best fitness is invalid.');
    }
  }
  return checkpoint;
}

function readCheckpoint(filePath, expected = {}) {
  let checkpoint;
  try { checkpoint = JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch (error) { throw new Error('Unable to read checkpoint: ' + error.message); }
  return validateCheckpoint(checkpoint, expected);
}

function writeCheckpoint(filePath, checkpoint) {
  validateCheckpoint(checkpoint);
  writeJsonAtomic(filePath, checkpoint);
  return filePath;
}

function writeReport(directory, report) {
  writeJsonAtomic(path.join(directory, 'report.json'), report);
  const lines = [
    '# Evolutionary training run',
    '',
    '- Run: ' + report.runId,
    '- Status: ' + report.status,
    '- Seed: ' + report.baseSeed,
    '- Source commit: ' + (report.sourceCommit || 'unknown'),
    '- Generations completed: ' + report.completedGenerations.length + ' / ' + report.config.generations,
    '- Population: ' + report.config.populationSize,
    '- Runtime: ' + report.runtime.node + ' on ' + report.runtime.platform + ' (' + report.runtime.arch + ')',
    '',
    '## Generation results',
    '',
    '| Generation | Best fitness | Best candidate | Equal-weight control |',
    '| ---: | ---: | --- | ---: |'
  ];
  for (const generation of report.completedGenerations) {
    lines.push('| ' + generation.generation + ' | ' + generation.best.fitness.toFixed(4) + ' | ' +
      generation.best.id + ' | ' + generation.control.fitness.toFixed(4) + ' |');
  }
  lines.push('', '## Warnings', '', ...(report.warnings.length ? report.warnings.map(w => '- ' + w) : ['- None']),
    '', '## Notes', '', '- Fitness is an experimental training signal, not a strength rating.',
    '- No holdout evaluation or export is implied by a completed training run.', '');
  fs.writeFileSync(path.join(directory, 'summary.md'), lines.join('\n'), { encoding: 'utf8', mode: 0o600 });
}

function validateExport(runReport, candidateId, approval) {
  if (!runReport || runReport.status !== 'completed') throw new Error('Export requires a completed training report.');
  if (!approval || approval.approved !== true || typeof approval.reviewer !== 'string' || !approval.reviewer.trim()) {
    throw new Error('Export requires explicit human approval with a reviewer identity.');
  }
  const evaluation = runReport.holdoutEvaluations && runReport.holdoutEvaluations[candidateId];
  if (!evaluation || evaluation.status !== 'passed' || evaluation.protocolVersion == null ||
      !evaluation.independentSetId || !evaluation.baselineFloors || evaluation.baselineFloors.primary !== true ||
      evaluation.baselineFloors.secondary !== true) {
    throw new Error('Candidate has no passing, candidate-specific holdout evaluation against both references.');
  }
  const generation = runReport.completedGenerations.find(item => item.candidates.some(candidate => candidate.id === candidateId));
  const candidate = generation && generation.candidates.find(item => item.id === candidateId);
  if (!candidate) throw new Error('Candidate ID is not present in the run report.');
  return candidate;
}

function exportPackage(outputPath, runReport, candidateId, approval) {
  const candidate = validateExport(runReport, candidateId, approval);
  const pkg = {
    packageSchemaVersion: PARAMETER_SCHEMA_VERSION,
    featureSchemaVersion: FEATURE_SCHEMA_VERSION,
    modelId: 'evolutionary-' + candidateId,
    variant: { id: 'jester-moat', version: 1 },
    weights: candidate.weights,
    provenance: {
      runId: runReport.runId,
      candidateId,
      sourceCommit: runReport.sourceCommit,
      baseSeed: runReport.baseSeed,
      effectiveConfig: runReport.config,
      holdoutEvaluation: runReport.holdoutEvaluations[candidateId],
      humanApproval: { reviewer: approval.reviewer.trim(), approvedAt: approval.approvedAt || new Date().toISOString() }
    }
  };
  normalizeWeights(pkg.weights);
  writeJsonAtomic(outputPath, pkg);
  return pkg;
}

module.exports = {
  RECORD_SCHEMA_VERSION, CHECKPOINT_SCHEMA_VERSION, PARAMETER_SCHEMA_VERSION, TRAINER_VERSION,
  stableJson, sameConfig, writeJsonAtomic, appendEvent, readEvents, validateCheckpoint,
  readCheckpoint, writeCheckpoint, writeReport, validateExport, exportPackage
};
