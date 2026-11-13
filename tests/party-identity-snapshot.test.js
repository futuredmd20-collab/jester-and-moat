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
  assert.match(script, /partyRecord: normalizePartyRecord\(parsed\.partyRecord, normalizedState\)/);
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
