/* Purpose: verify evolutionary CLI argument contracts and fail-closed evaluation/export entry points. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseArgs, helpText, evaluate } = require('../scripts/evolutionary-trainer');

test('CLI help and subcommand parsing expose the four approved operations', () => {
  assert.equal(parseArgs(['--help']).command, 'help');
  assert.equal(parseArgs(['train', '--seed', '17', '--population', '4']).command, 'train');
  assert.equal(parseArgs(['baseline', '--seed', '17', '--games', '4']).command, 'baseline');
  assert.equal(parseArgs(['resume', '--checkpoint', 'checkpoint.json']).command, 'resume');
  assert.equal(parseArgs(['evaluate', '--report', 'report.json', '--candidate-id', 'candidate-1', '--protocol', 'protocol.json']).command, 'evaluate');
  assert.equal(parseArgs(['export', '--report', 'report.json', '--candidate-id', 'candidate-1', '--approval-file', 'approval.json', '--output', 'model.json']).command, 'export');
  for (const command of ['train', 'resume', 'evaluate', 'export', 'baseline']) assert.match(helpText(), new RegExp(command));
});

test('CLI rejects unknown, duplicate, and missing options', () => {
  assert.throws(() => parseArgs(['train', '--seed', '1', '--seed', '2']), /Duplicate option/);
  assert.throws(() => parseArgs(['train', '--surprise', '1']), /Unknown option/);
  assert.throws(() => parseArgs(['resume', '--checkpoint']), /Missing value/);
});

test('holdout evaluation fails closed until baseline and statistical protocol gates are approved', () => {
  assert.throws(() => evaluate({ report: 'report.json', 'candidate-id': 'candidate-1', protocol: 'protocol.json' }),
    /baseline floors, confidence level, practical margins, fixture rules, and sequential-testing correction/);
  assert.throws(() => evaluate({}), /requires --report/);
});
