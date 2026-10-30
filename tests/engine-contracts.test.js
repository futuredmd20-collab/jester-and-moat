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

const elements = new Map();
function mockElement(id) {
  if (!elements.has(id)) {
    elements.set(id, {
      id,
      value: id.includes('EngineSelect') ? 'minmax_legacy' : id.includes('PhaseSelect') ? 'opening' : id === 'modeSelect' ? 'human_vs_ai' : '',
      checked: false,
      hidden: false,
      disabled: false,
      title: '',
      textContent: '',
      innerHTML: '',
      dataset: {},
      children: [],
      style: {},
      classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
      addEventListener() {},
      removeEventListener() {},
      appendChild(child) { this.children.push(child); },
      append(...children) { this.children.push(...children); },
      removeChild(child) { this.children = this.children.filter(item => item !== child); },
      setAttribute() {},
      getAttribute() { return null; },
      focus() {},
      click() {}
    });
  }
  return elements.get(id);
}
const sandbox = {
  console, URLSearchParams, Blob,
  URL: { createObjectURL() { throw new Error('Blob workers blocked by test'); }, revokeObjectURL() {} },
  window: { location: { search: '' }, innerWidth: 1024, Worker: function Worker() {}, addEventListener() {} },
  document: {
    getElementById(id) { return mockElement(id); },
    querySelectorAll() { return []; },
    addEventListener() {},
    createElement(tag) { return mockElement(tag); },
    body: mockElement('body'),
    documentElement: mockElement('documentElement')
  },
  localStorage: { getItem() { return null; }, setItem() {} }
};
vm.createContext(sandbox);
vm.runInContext(source.slice(0, boundary) + `
globalThis.api = { allLegalState, getBestMove, applyRaw, getGamePhase, ensureAIWorker, play, aiPlaceMoatForColor, confirmMoatPlacement, setPendingMoat(m) { pendingMoat = m; }, setState(s) { state = s; }, getState() { return state; }, ENGINE_PHASES };
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
const { allLegalState, getBestMove, applyRaw, getGamePhase, ensureAIWorker, play, aiPlaceMoatForColor, confirmMoatPlacement, setPendingMoat, setState, getState, ENGINE_PHASES } = sandbox.api;

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
  s.board = Array.from({ length: 8 }, () => Array(10).fill(null));
  for (let i = 0; i < 34; i++) s.board[Math.floor(i / 10)][i % 10] = { type: 'p', color: i % 2 ? 'b' : 'w', moved: true };
  assert.equal(getGamePhase(s), ENGINE_PHASES.OPENING);
  s.ply = 10;
  s.board = Array.from({ length: 8 }, () => Array(10).fill(null));
  for (let i = 0; i < 20; i++) s.board[Math.floor(i / 10)][i % 10] = { type: 'p', color: i % 2 ? 'b' : 'w', moved: true };
  assert.equal(getGamePhase(s), ENGINE_PHASES.MIDGAME);
  s.board = Array.from({ length: 8 }, () => Array(10).fill(null));
  for (let i = 0; i < 16; i++) s.board[Math.floor(i / 10)][i % 10] = { type: 'p', color: i % 2 ? 'b' : 'w', moved: true };
  assert.equal(getGamePhase(s), ENGINE_PHASES.ENDGAME);
});

test('castling moves the king and rook to their variant-specific squares', () => {
  const s = position();
  s.board = Array.from({ length: 8 }, () => Array(10).fill(null));
  s.board[7][5] = { type: 'k', color: 'w', moved: false };
  s.board[0][5] = { type: 'k', color: 'b', moved: false };
  s.board[7][9] = { type: 'r', color: 'w', moved: false };

  const move = allLegalState(s).find(m => m.castling === 'kingside');
  assert.ok(move, 'kingside castling should be legal when the path is clear');
  applyRaw(s, move);
  assert.equal(s.board[7][8].type, 'k');
  assert.equal(s.board[7][7].type, 'r');
  assert.equal(s.board[7][9], null);
  assert.equal(s.board[7][5], null);
  assert.equal(s.board[7][7].moved, true);
});

test('en passant removes the captured pawn and places the capturing pawn', () => {
  const s = position();
  s.board[3][3] = { type: 'p', color: 'w', moved: true };
  s.board[1][4] = { type: 'p', color: 'b', moved: false };
  s.turn = 'b';

  applyRaw(s, { from: { r: 1, c: 4 }, to: { r: 3, c: 4 }, doublePawn: true });
  assert.equal(s.ep.r, 2);
  assert.equal(s.ep.c, 4);
  const move = allLegalState(s).find(m => m.enPassant && m.from.r === 3 && m.from.c === 3);
  assert.ok(move, 'en passant should be available immediately after the double pawn move');
  applyRaw(s, move);
  assert.equal(s.board[2][4].type, 'p');
  assert.equal(s.board[2][4].color, 'w');
  assert.equal(s.board[3][4], null);
  assert.equal(s.ep, null);
  assert.equal(s.captured.w.some(p => p.type === 'p' && p.color === 'b'), true);
});

test('a moat is destroyed when two opposing pieces occupy its cells', () => {
  const s = position();
  s.moats.w = { r: 3, c: 3 };
  s.board[3][3] = { type: 'n', color: 'b', moved: true };
  s.board[3][4] = { type: 'p', color: 'b', moved: true };
  s.board[6][0] = { type: 'r', color: 'w', moved: false };

  const result = applyRaw(s, { from: { r: 6, c: 0 }, to: { r: 5, c: 0 } });
  assert.equal(result.moatsDestroyed.length, 1);
  assert.equal(result.moatsDestroyed[0], 'w');
  assert.equal(s.moats.w, null);
  assert.equal(s.moatDestroyed.w, true);
});

test('AI worker setup falls back cleanly when blob workers are blocked', () => {
  assert.equal(ensureAIWorker(), null);
});

test('all supported promotion choices replace the pawn with the selected piece', () => {
  for (const choice of ['q', 'j', 'r', 'b', 'n']) {
    const s = position();
    s.board[1][0] = { type: 'p', color: 'w', moved: true };
    applyRaw(s, { from: { r: 1, c: 0 }, to: { r: 0, c: 0 } }, choice);
    assert.equal(s.board[0][0].type, choice, `promotion choice ${choice} should be applied`);
    assert.equal(s.board[0][0].color, 'w');
    assert.equal(s.board[0][0].moved, true);
    assert.equal(s.board[1][0], null);
    assert.equal(s.turn, 'b');
  }
});

test('promotion can redeploy a destroyed moat without leaving a pawn behind', () => {
  const s = position();
  s.board[1][0] = { type: 'p', color: 'w', moved: true };
  s.moatDestroyed.w = true;
  s.hasPlacedMoat.w = true;
  s.hasPlacedMoat.b = true;
  setState(s);

  play({ from: { r: 1, c: 0 }, to: { r: 0, c: 0 } }, 'moat', true);
  assert.equal(getState().board[1][0], null);
  assert.equal(getState().board[0][0], null);
  assert.equal(getState().phase, 'place_moat_w');
  assert.equal(getState().turn, 'w');

  aiPlaceMoatForColor('w', true);
  const after = getState();
  assert.ok(after.moats.w);
  assert.ok([4, 5].includes(after.moats.w.r));
  assert.ok(after.moats.w.c >= 1 && after.moats.w.c <= 6);
  assert.equal(after.moatDestroyed.w, false);
  assert.equal(after.hasPlacedMoat.w, true);
  assert.equal(after.phase, 'normal');
  assert.equal(after.turn, 'b');
});


test('initial moat placement starts after four moves per side and completes for both players', () => {
  const s = position();
  s.board[7][0] = { type: 'r', color: 'w', moved: false };
  s.board[0][0] = { type: 'r', color: 'b', moved: false };
  setState(s);

  const move = (fromR, toR) => play({ from: { r: fromR, c: 0 }, to: { r: toR, c: 0 } }, 'q', true);
  move(7, 6);
  move(0, 1);
  move(6, 7);
  move(1, 0);
  move(7, 6);
  move(0, 1);
  move(6, 7);
  move(1, 0);

  let after = getState();
  assert.deepEqual(after.moveCounts, { w: 4, b: 4 });
  assert.equal(after.phase, 'place_moat_w');
  assert.equal(after.turn, 'w');

  setPendingMoat({ r: 4, c: 2 });
  confirmMoatPlacement();
  after = getState();
  assert.equal(after.moats.w.r, 4);
  assert.equal(after.moats.w.c, 2);
  assert.equal(after.hasPlacedMoat.w, true);
  assert.equal(after.phase, 'place_moat_b');
  assert.equal(after.turn, 'b');

  setPendingMoat({ r: 3, c: 5 });
  confirmMoatPlacement();
  after = getState();
  assert.equal(after.moats.b.r, 3);
  assert.equal(after.moats.b.c, 5);
  assert.equal(after.hasPlacedMoat.b, true);
  assert.equal(after.moatDestroyed.w, false);
  assert.equal(after.moatDestroyed.b, false);
  assert.equal(after.phase, 'normal');
  assert.equal(after.turn, 'w');
});
