/* Purpose: regression tests for engine contracts and selected variant rules. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
const mcts = fs.readFileSync(path.join(root, 'engines/mcts-engine.js'), 'utf8');
const marker = "\nif (document.readyState === 'loading')";
const boundary = source.indexOf(marker);
if (boundary < 0) throw new Error('Browser startup boundary not found');

const sandbox = {
  console, URLSearchParams,
  window: { location: { search: '' }, innerWidth: 1024, addEventListener() {} },
  document: { getElementById() { return null; }, querySelectorAll() { return []; } },
  localStorage: { getItem() { return null; }, setItem() {} }
};
vm.createContext(sandbox);
vm.runInContext(source.slice(0, boundary) + `
globalThis.api = { allLegalState, getBestMove, applyRaw, getGamePhase, ENGINE_PHASES };
`, sandbox, { filename: 'script.js' });
vm.runInContext(mcts, sandbox, { filename: 'engines/mcts-engine.js' });

function position() {
  const board = Array.from({ length: 8 }, () => Array(10).fill(null));
  board[7][4] = { type: 'k', color: 'w', moved: false };
  board[0][4] = { type: 'k', color: 'b', moved: false };
  return {
    board, turn: 'w', ply: 12, ep: null, moats: { w: null, b: null },
    moatDestroyed: { w: false, b: false }, hasPlacedMoat: { w: false, b: false },
    moveCounts: { w: 0, b: 0 }, phase: 'normal', captured: { w: [], b: [] },
    halfmoveClock: 0, positionHistory: {}, clocks: { w: 0, b: 0 }
  };
}
const { allLegalState, getBestMove, applyRaw, getGamePhase, ENGINE_PHASES } = sandbox.api;

test('MinMax returns a legal move without mutating its input', () => {
  const s = position();
  s.board[6][0] = { type: 'r', color: 'w', moved: false };
  const before = JSON.stringify(s);
  const move = getBestMove(s, 1);
  assert.ok(move);
  assert.ok(allLegalState(s).some(m => JSON.stringify(m) === JSON.stringify(move)));
  assert.equal(JSON.stringify(s), before);
});

test('MinMax and MCTS return null when there are no legal moves', () => {
  const s = position();
  s.board = Array.from({ length: 8 }, () => Array(10).fill(null));
  assert.equal(allLegalState(s).length, 0);
  assert.equal(getBestMove(s, 1), null);
  assert.equal(sandbox.mctsGetMove(s, 1), null);
});

test('Jester can swap with an adjacent moved friendly piece', () => {
  const s = position();
  s.board[4][4] = { type: 'j', color: 'w', moved: false };
  s.board[4][5] = { type: 'r', color: 'w', moved: true };
  assert.ok(allLegalState(s).some(m => m.swap && m.from.r === 4 && m.from.c === 4 && m.to.r === 4 && m.to.c === 5));
});

test('invalid/unresolved promotion choice defaults to queen', () => {
  const s = position();
  s.board[1][0] = { type: 'p', color: 'w', moved: true };
  applyRaw(s, { from: { r: 1, c: 0 }, to: { r: 0, c: 0 } }, 'pending');
  assert.equal(s.board[0][0].type, 'q');
  assert.equal(s.board[1][0], null);
  assert.equal(s.turn, 'b');
});

test('phase detection follows opening, midgame, and endgame thresholds', () => {
  const s = position();
  assert.equal(getGamePhase(s), ENGINE_PHASES.OPENING);
  s.ply = 10;
  s.board = Array.from({ length: 8 }, () => Array(10).fill(null));
  for (let i = 0; i < 20; i++) s.board[Math.floor(i / 10)][i % 10] = { type: 'p', color: i % 2 ? 'b' : 'w', moved: true };
  assert.equal(getGamePhase(s), ENGINE_PHASES.MIDGAME);
  s.board = Array.from({ length: 8 }, () => Array(10).fill(null));
  for (let i = 0; i < 16; i++) s.board[Math.floor(i / 10)][i % 10] = { type: 'p', color: i % 2 ? 'b' : 'w', moved: true };
  assert.equal(getGamePhase(s), ENGINE_PHASES.ENDGAME);
});
