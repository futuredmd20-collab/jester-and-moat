/* Purpose: prevent false MCTS load warnings in the engine calibration harness. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const calibration = require('../scripts/engine-strength-calibration');

test('calibration harness loads MCTS before script engine registration', () => {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));
  try {
    const sandbox = calibration.createHarness(20261111);
    assert.equal(typeof sandbox.mctsEngine, 'function');
    assert.deepEqual(warnings, []);
    assert.equal(calibration.selfTest().ok, true);
    assert.deepEqual(warnings, []);
  } finally {
    console.warn = originalWarn;
  }
});
