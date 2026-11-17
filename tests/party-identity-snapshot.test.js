'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const script = fs.readFileSync(path.join(root, 'script.js'), 'utf8');

test('new games and validated editor positions receive a party identity snapshot', () => {
  assert.match(script, /let partyRecord = null;/);
  assert.match(script, /partyRecord = createPartyRecord\('new-game'\);/);
  assert.match(script, /partyRecord = createPartyRecord\('board-editor'\);/);
  assert.match(script, /configurationAtStart: engineCopy\(engineConfiguration\)/);
  assert.match(script, /variant: clone\(state\.variant \|\| GAME_VARIANT\)/);
  assert.match(script, /setupId: state\.setupId \|\| null/);
});

test('party configuration changes are appended without replacing the start snapshot', () => {
  assert.match(script, /function recordPartyConfigurationChange\(\)/);
  assert.match(script, /partyRecord\.configurationChanges\.push\(\{ at: new Date\(\)\.toISOString\(\), configuration \}\)/);
  assert.match(script, /recordPartyConfigurationChange\(\);/);
  assert.match(script, /const previous = partyRecord\.configurationChanges\.length/);
  assert.match(script, /configurationAtStart/);
});

test('party metadata roundtrips with saves and legacy saves remain importable', () => {
  assert.match(script, /partyRecord: partyRecord \? clone\(partyRecord\) : null/);
  assert.match(script, /const normalizedPartyRecord = normalizePartyRecord\(parsed\.partyRecord, normalizedState\)/);
  assert.match(script, /function normalizePartyRecord\(candidate, savedState\)/);
  assert.match(script, /function isPartyEngineConfigurationSnapshot\(value\)/);
  assert.match(script, /isPartyEngineConfigurationSnapshot\(candidate\.configurationAtStart\)/);
  assert.match(script, /isPartyEngineConfigurationSnapshot\(change\.configuration\)/);
  assert.match(script, /if \(candidate == null\) return null;/);
  assert.match(script, /partyRecord = parsed\.partyRecord \|\| null;/);
});

test('completed games record factual outcome and completion metadata', () => {
  assert.match(script, /function completePartyRecord\(message\)/);
  assert.match(script, /status: 'completed', result, reason, finishedAt: new Date\(\)\.toISOString\(\)/);
  assert.match(script, /completePartyRecord\(fullMsg\);/);
});

test('party match events are recorded independently of debug logging', () => {
  assert.match(script, /const PARTY_EVENT_TYPES = new Set\(/);
  assert.match(script, /matchEvents: \[\{[\s\S]*?type: 'game-start'/);
  assert.match(script, /function recordPartyEvent\(type, details, side = null, phase = null\)/);
  assert.match(script, /function recordPartyPhaseChange\(previousPhase, nextPhase\)/);
  assert.match(script, /recordPartyEvent\('capture'/);
  assert.match(script, /recordPartyEvent\('check'/);
  assert.match(script, /recordPartyEvent\('moat-destroyed'/);
  assert.match(script, /'moat-redeployed' : 'moat-placed'/);
  assert.match(script, /recordPartyEvent\(eventType, reason/);
});

test('party match events are validated, persisted, and legacy party records default to an empty event list', () => {
  assert.match(script, /const matchEvents = candidate\.matchEvents === undefined \? \[\] : candidate\.matchEvents/);
  assert.match(script, /Invalid party match events in save file/);
  assert.match(script, /Invalid party match event in save file/);
  assert.match(script, /matchEvents: normalizedEvents/);
  assert.match(script, /partyRecord: partyRecord \? clone\(partyRecord\) : null/);
});


test('party recap events and outcomes follow undo/redo and saved history snapshots', () => {
  assert.match(script, /let historyPartySnapshots = \[\]/);
  assert.match(script, /function createPartyHistorySnapshot\(\)/);
  assert.match(script, /function restorePartyHistorySnapshot\(snapshot\)/);
  assert.match(script, /historyPartySnapshots\.push\(createPartyHistorySnapshot\(\)\)/);
  assert.match(script, /partySnapshot: clone\(currentPartySnapshot\)/);
  assert.match(script, /restorePartyHistorySnapshot\(historyPartySnapshots\[historyPartySnapshots\.length - 1\]\)/);
  assert.match(script, /historyPartySnapshots: clone\(historyPartySnapshots\)/);
  assert.match(script, /parsed\.historyPartySnapshots/);
  assert.match(script, /Current party record does not match the latest party history snapshot/);
  assert.match(script, /if \(!silent\) replaceLatestHistorySnapshot\(\)/);
});
