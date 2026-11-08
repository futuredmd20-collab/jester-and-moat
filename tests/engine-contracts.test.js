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
const minmax = fs.readFileSync(path.join(root, 'engines/minmax-engine.js'), 'utf8');
const marker = "\nif (document.readyState === 'loading')";
const boundary = source.indexOf(marker);
if (boundary < 0) throw new Error('Browser startup boundary not found');

const elements = new Map();
const storedValues = new Map();
const scheduledCallbacks = [];
const scheduledTimeouts = [];
let storageThrowsOnRead = false;
let storageThrowsOnWrite = false;
function mockElement(id) {
  if (!elements.has(id)) {
    elements.set(id, {
      id,
      value: id.includes('EngineSelect') ? 'minmax_legacy' : id.includes('PhaseSelect') ? 'opening' : id === 'modeSelect' ? 'ai' : '',
      checked: false,
      hidden: false,
      disabled: false,
      title: '',
      textContent: '',
      innerHTML: '',
      dataset: {},
      children: [],
      style: { setProperty(name, value) { this[name] = value; } },
      classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
      addEventListener() {},
      removeEventListener() {},
      appendChild(child) { this.children.push(child); },
      append(...children) { this.children.push(...children); },
      removeChild(child) { this.children = this.children.filter(item => item !== child); },
      setAttribute() {},
      querySelector() { return null; },
      getAttribute() { return null; },
      focus() {},
      click() {}
    });
  }
  return elements.get(id);
}
const sandbox = {
  console, URLSearchParams, Blob, Date,
  setTimeout(callback, delay) {
    callback.delay = delay;
    if (delay === 15000 || delay === 250) { scheduledTimeouts.push(callback); return -scheduledTimeouts.length; }
    scheduledCallbacks.push(callback);
    return scheduledCallbacks.length;
  },
  clearTimeout() {},
  setInterval(callback, delay) { return { callback, delay, testInterval: true }; },
  clearInterval() {},
  URL: { createObjectURL() { throw new Error('Blob workers blocked by test'); }, revokeObjectURL() {} },
  window: { location: { search: '' }, innerWidth: 1024, Worker: function Worker() {}, addEventListener() {} },
  document: {
    getElementById(id) { return mockElement(id); },
    querySelector(selector) { return selector === '.board-frame-wrap' ? mockElement('board-frame-wrap') : null; },
    querySelectorAll() { return []; },
    addEventListener() {},
    createElement(tag) { return mockElement(tag); },
    body: mockElement('body'),
    documentElement: mockElement('documentElement')
  },
  localStorage: {
    getItem(key) {
      if (storageThrowsOnRead) throw new Error('storage read blocked');
      return storedValues.has(key) ? storedValues.get(key) : null;
    },
    setItem(key, value) {
      if (storageThrowsOnWrite) throw new Error('storage write blocked');
      storedValues.set(key, String(value));
    }
  }
};
vm.createContext(sandbox);
vm.runInContext(minmax, sandbox);
vm.runInContext(source.slice(0, boundary) + `
globalThis.api = { GAME_VARIANT, GAME_SETUP_IDS, createGameIdentity, EngineContract, PERSONALITY_PROFILES, DEFAULT_PERSONALITY_ID, assertEnginePersonalityCompatibility, MinMaxLegacy, cancelActiveAIRequest, setActiveAIForTest(worker, request) { aiWorker = worker; pendingAIRequest = request; aiRequestId = request.id; isAIThinking = true; }, getActiveAIForTest() { return { worker: aiWorker, request: pendingAIRequest, thinking: isAIThinking, id: aiRequestId }; }, allLegalState, inCheck, findLegalMoveMatch, MinMaxSearchCore, getBestMove: MinMaxSearchCore.getBestMove, getBestMoveAsync: MinMaxSearchCore.getBestMoveAsync, applyRaw, initializeEditorCastlingRights, getGamePhase, ensureAIWorker, aiMove, enginePlugins, resetAIWorker() { if (aiWorkerTimeout !== null && typeof clearTimeout === 'function') clearTimeout(aiWorkerTimeout); aiWorkerTimeout = null; if (aiWorker && typeof aiWorker.terminate === 'function') aiWorker.terminate(); aiWorker = null; pendingAIRequest = null; isAIThinking = false; gameOver = false; gameOverMessage = ''; }, play, aiPlaceMoatForColor, confirmMoatPlacement, loadEngineConfig, updateEngineConfigUI, getEngineForSide, getEngineConfig, getEngineConfiguration() { return engineCopy(engineConfiguration); }, setEngineConfiguration(config) { engineConfiguration = validateEngineConfiguration(config); updateEngineConfigUI(); }, validateEngineConfiguration, getEngineAssignment, applyEnginePreset, isAIMode, updateModeUI, stepNextMove, toggleAutoPlay, setPendingMoat(m) { pendingMoat = m; }, setState(s) { state = s; }, getState() { return state; }, setHistoryForTest(states, logs, isOver = false) { history = clone(states); historyMoveLogs = clone(logs); state = clone(history[history.length - 1]); moveLog = clone(historyMoveLogs[historyMoveLogs.length - 1]); redoStack = []; gameOver = isOver; gameOverMessage = isOver ? document.getElementById('status').textContent : ''; }, getHistory() { return clone(history); }, getHistoryMoveLogs() { return clone(historyMoveLogs); }, getMoveLog() { return moveLog.slice(); }, getRedoStack() { return clone(redoStack); }, getGameOver() { return gameOver; }, pushHistorySnapshot, replaceLatestHistorySnapshot, undoHistoryStep, redoHistoryStep, exportGameData, parseGameData, applyLoadedGame, resumeLoadedGamePlayback, getAutoPlayForTest() { return autoPlayInterval; }, stopAutoPlayForTest: stopAutoPlay, ENGINE_PHASES, debugLogger, DebugLogger, status };
`, sandbox, { filename: 'script.js' });
vm.runInContext(mcts, sandbox, { filename: 'engines/mcts-engine.js' });
// The app's HTML loads the MCTS module before script.js; register its plugin here
// because this test harness evaluates script.js first to expose the test API.
sandbox.api.enginePlugins.set('mcts', sandbox.mctsEngine(2));
sandbox.api.updateEngineConfigUI();
const canonicalEngineMetadata = new Map(['minmax_legacy', 'mcts'].map(engineId => {
  const engine = sandbox.api.enginePlugins.get(engineId);
  return [engineId, { capabilities: engine.capabilities, strengths: engine.strengths, settings: engine.settings,
    supportedVariants: engine.supportedVariants, supportedPersonalities: engine.supportedPersonalities }];
}));

function engineMetadata(engineId) {
  const metadata = canonicalEngineMetadata.get(engineId);
  return {
    id: engineId,
    capabilities: metadata.capabilities,
    strengths: metadata.strengths,
    settings: metadata.settings,
    supportedVariants: metadata.supportedVariants,
    supportedPersonalities: metadata.supportedPersonalities
  };
}

function configureEngine(side, phase, engineId) {
  const config = sandbox.api.getEngineConfiguration();
  config.sides[side].phases[phase] = { engineId, strength: 'medium', advanced: {} };
  sandbox.api.setEngineConfiguration(config);
}

function position() {
  const board = Array.from({ length: 8 }, () => Array(10).fill(null));
  board[7][4] = { type: 'k', color: 'w', moved: false };
  board[0][4] = { type: 'k', color: 'b', moved: false };
  return {
    variant: { id: 'jester-moat', version: 1 }, setupId: null,
    board, turn: 'w', ply: 12, ep: null, moats: { w: null, b: null },
    moatDestroyed: { w: false, b: false }, hasPlacedMoat: { w: false, b: false },
    moveCounts: { w: 0, b: 0 }, phase: 'normal', captured: { w: [], b: [] },
    halfmoveClock: 0, positionHistory: {}, clocks: { w: 0, b: 0 }
  };
}

test('sliding pieces can move horizontally through the same moat they start on', () => {
  for (const { type, toCol } of [
    { type: 'r', toCol: 6 },
    { type: 'q', toCol: 6 },
    { type: 'j', toCol: 5 }
  ]) {
    const s = position();
    s.board[5][2] = { type, color: 'w', moved: false };
    s.moats.w = { r: 5, c: 2 };
    const moves = allLegalState(s).filter(m => m.from.r === 5 && m.from.c === 2);
    assert.ok(moves.some(m => m.to.r === 5 && m.to.c === toCol),
      `${type} should pass through its starting moat horizontally`);
  }
});

test('a sliding move that starts outside a moat stops on its first moat square', () => {
  const s = position();
  s.board[5][1] = { type: 'r', color: 'w', moved: false };
  s.moats.w = { r: 5, c: 2 };
  const moves = allLegalState(s).filter(m => m.from.r === 5 && m.from.c === 1);
  assert.ok(moves.some(m => m.to.r === 5 && m.to.c === 2));
  assert.ok(!moves.some(m => m.to.r === 5 && m.to.c > 2));
});

test('sliding attacks use the attacking piece origin when applying moat passage rules', () => {
  const blocked = position();
  blocked.board = Array.from({ length: 8 }, () => Array(10).fill(null));
  blocked.board[5][2] = { type: 'k', color: 'w', moved: true };
  blocked.board[5][6] = { type: 'r', color: 'b', moved: true };
  blocked.board[0][9] = { type: 'k', color: 'b', moved: true };
  blocked.moats.w = { r: 5, c: 2 };
  assert.equal(sandbox.api.inCheck('w', blocked.board, blocked.moats), false,
    'an attacker outside the moat cannot pass through it to reach a king beyond it');

  const allowed = position();
  allowed.board = Array.from({ length: 8 }, () => Array(10).fill(null));
  allowed.board[5][6] = { type: 'k', color: 'w', moved: true };
  allowed.board[5][2] = { type: 'r', color: 'b', moved: true };
  allowed.board[0][9] = { type: 'k', color: 'b', moved: true };
  allowed.moats.b = { r: 5, c: 2 };
  assert.equal(sandbox.api.inCheck('w', allowed.board, allowed.moats), true,
    'an attacker starting on a moat can pass through that same moat');
});

function terminalPosition(kind) {
  const s = position();
  if (kind === 'unexpected-no-move') return s;
  s.board = Array.from({ length: 8 }, () => Array(10).fill(null));
  s.board[2][2] = { type: 'k', color: 'w', moved: true };
  s.board[0][0] = { type: 'k', color: 'b', moved: true };
  s.board[kind === 'checkmate' ? 1 : 2][1] = { type: 'q', color: 'w', moved: true };
  s.turn = 'b';
  s.ply = 40;
  return s;
}
const { EngineContract, allLegalState, getBestMove, getBestMoveAsync, applyRaw, getGamePhase, ensureAIWorker, play, aiPlaceMoatForColor, confirmMoatPlacement, setPendingMoat, setState, getState, setHistoryForTest, getHistory, getHistoryMoveLogs, getMoveLog, getGameOver, undoHistoryStep, redoHistoryStep, replaceLatestHistorySnapshot, exportGameData, parseGameData, ENGINE_PHASES } = sandbox.api;

test('loading a saved AI-vs-AI game resumes auto-play after import paused it', () => {
  sandbox.api.resetAIWorker();
  sandbox.api.stopAutoPlayForTest();
  mockElement('modeSelect').value = 'ai_vs_ai';
  mockElement('autoBtn').textContent = '▶';
  const current = position();
  const parsed = {
    state: current,
    gameStarted: true,
    playerColor: 'w',
    moveLog: [],
    history: [current],
    historyMoveLogs: [[]],
    gameOver: false,
    gameOverMessage: ''
  };

  sandbox.api.applyLoadedGame(parsed);
  assert.equal(sandbox.api.getAutoPlayForTest(), null);
  sandbox.api.resumeLoadedGamePlayback();

  assert.equal(sandbox.api.getAutoPlayForTest().testInterval, true);
  assert.equal(mockElement('autoBtn').textContent, 'Ⅱ');
  sandbox.api.stopAutoPlayForTest();
  sandbox.api.resetAIWorker();
});

test('MinMax returns a legal move without mutating its input', () => {
  const s = position();
  s.board[6][0] = { type: 'r', color: 'w', moved: false };
  const before = JSON.stringify(s);
  const move = getBestMove(s, 1);
  assert.ok(move);
  assert.ok(allLegalState(s).some(m => JSON.stringify(m) === JSON.stringify(move)));
  assert.equal(JSON.stringify(s), before);
});

test('MinMax bounded synchronous search returns a legal best-so-far move when its budget expires', () => {
  const s = position();
  s.board[6][0] = { type: 'r', color: 'w', moved: false };
  const before = JSON.stringify(s);
  let checks = 0;
  const move = sandbox.api.MinMaxSearchCore.getBestMove(s, 5, () => ++checks > 3);
  assert.ok(move, 'bounded search should retain a legal fallback move');
  assert.ok(allLegalState(s).some(candidate => JSON.stringify(candidate) === JSON.stringify(move)));
  assert.ok(checks > 3, 'search should consult the stop condition during recursion');
  assert.equal(JSON.stringify(s), before);
});

test('MinMax cooperative search can cancel inside recursive search and preserves the input position', async () => {
  const s = position();
  s.board[6][0] = { type: 'r', color: 'w', moved: false };
  const before = JSON.stringify(s);
  let yields = 0;
  const outcome = await getBestMoveAsync(s, 4, () => yields >= 2, async () => { yields++; });
  assert.equal(outcome.cancelled, true);
  assert.equal(outcome.move, null);
  assert.ok(yields >= 2, 'search should yield repeatedly while exploring a root branch');
  assert.equal(JSON.stringify(s), before, 'cancellation must not mutate the input position');
});

test('MinMax cooperative search returns a legal best-so-far move when its deadline expires', async () => {
  const s = position();
  s.board[6][0] = { type: 'r', color: 'w', moved: false };
  const before = JSON.stringify(s);
  let checks = 0;
  const outcome = await sandbox.api.MinMaxSearchCore.getBestMoveAsync(s, 5, () => false, async () => {}, () => ++checks > 2);
  assert.equal(outcome.cancelled, false);
  assert.equal(outcome.timedOut, true);
  assert.ok(outcome.move);
  assert.ok(allLegalState(s).some(candidate => JSON.stringify(candidate) === JSON.stringify(outcome.move)));
  assert.equal(JSON.stringify(s), before);
});

test('MCTS levels all declare finite worker and fallback search budgets', () => {
  for (const level of [1, 2, 3]) {
    assert.ok(Number.isFinite(sandbox.MCTS_LEVELS[level].timeBudgetMs));
    assert.ok(sandbox.MCTS_LEVELS[level].timeBudgetMs > 0);
  }
  assert.deepEqual([1, 2, 3].map(level => sandbox.MCTS_LEVELS[level].timeBudgetMs), [2500, 5000, 10000]);
});

test('MCTS playout resolves checkmate and stalemate after its final permitted move', () => {
  for (const fixture of [
    { kind: 'checkmate', queenFrom: { r: 1, c: 2 }, queenTo: { r: 1, c: 1 }, expected: 1 },
    { kind: 'stalemate', queenFrom: { r: 1, c: 3 }, queenTo: { r: 1, c: 2 }, expected: 0.5 }
  ]) {
    const s = position();
    s.board = Array.from({ length: 8 }, () => Array(10).fill(null));
    s.board[2][2] = { type: 'k', color: 'w', moved: true };
    s.board[0][0] = { type: 'k', color: 'b', moved: true };
    s.board[fixture.queenFrom.r][fixture.queenFrom.c] = { type: 'q', color: 'w', moved: true };
    s.turn = 'w';

    const legal = allLegalState(s, 'w');
    const selected = legal.find(move =>
      move.from.r === fixture.queenFrom.r && move.from.c === fixture.queenFrom.c &&
      move.to.r === fixture.queenTo.r && move.to.c === fixture.queenTo.c
    );
    assert.ok(selected, fixture.kind + ': fixture move must be legal');

    const originalAllLegalState = sandbox.allLegalState;
    let forceFixtureMove = true;
    sandbox.allLegalState = (state, color) => {
      if (forceFixtureMove) {
        forceFixtureMove = false;
        return [selected];
      }
      return originalAllLegalState(state, color);
    };
    try {
      const outcome = sandbox.mctsPlayout(s, 1, () => false);
      assert.equal(outcome, fixture.expected,
        fixture.kind + ': terminal result after the final playout move must override material evaluation');
    } finally {
      sandbox.allLegalState = originalAllLegalState;
    }
  }
});

test('MCTS playout resolves a terminal result when time expires immediately after the final move', () => {
  for (const fixture of [
    { kind: 'checkmate', queenFrom: { r: 1, c: 2 }, queenTo: { r: 1, c: 1 }, expected: 1 },
    { kind: 'stalemate', queenFrom: { r: 1, c: 3 }, queenTo: { r: 1, c: 2 }, expected: 0.5 }
  ]) {
    const s = position();
    s.board = Array.from({ length: 8 }, () => Array(10).fill(null));
    s.board[2][2] = { type: 'k', color: 'w', moved: true };
    s.board[0][0] = { type: 'k', color: 'b', moved: true };
    s.board[fixture.queenFrom.r][fixture.queenFrom.c] = { type: 'q', color: 'w', moved: true };
    s.turn = 'w';
    const selected = allLegalState(s, 'w').find(move =>
      move.from.r === fixture.queenFrom.r && move.from.c === fixture.queenFrom.c &&
      move.to.r === fixture.queenTo.r && move.to.c === fixture.queenTo.c
    );
    assert.ok(selected, fixture.kind + ': fixture move must be legal');

    const originalAllLegalState = sandbox.allLegalState;
    let forceFixtureMove = true;
    sandbox.allLegalState = (state, color) => {
      if (forceFixtureMove) {
        forceFixtureMove = false;
        return [selected];
      }
      return originalAllLegalState(state, color);
    };
    try {
      let stopChecks = 0;
      const outcome = sandbox.mctsPlayout(s, 2, () => ++stopChecks > 1);
      assert.equal(stopChecks, 2, fixture.kind + ': time check must interrupt after the terminal move');
      assert.equal(outcome, fixture.expected,
        fixture.kind + ': timeout after the final move must preserve its terminal result');
    } finally {
      sandbox.allLegalState = originalAllLegalState;
    }
  }
});

test('MCTS playout resolves terminal positions when the time check stops before another move', () => {
  for (const fixture of [
    { kind: 'checkmate', expected: 1 },
    { kind: 'stalemate', expected: 0.5 }
  ]) {
    const outcome = sandbox.mctsPlayout(terminalPosition(fixture.kind), 5, () => true);
    assert.equal(outcome, fixture.expected,
      fixture.kind + ': a time-interrupted playout must preserve its terminal result');
  }
});

test('MCTS cooperative search yields and exits when cancellation is requested', async () => {
  const s = position();
  s.board[6][0] = { type: 'r', color: 'w', moved: false };
  const before = JSON.stringify(s);
  let yields = 0;
  const outcome = await sandbox.mctsSearchAsync(
    s, { playouts: 10, capDepth: 2, temperature: 0 },
    () => yields > 0,
    async () => { yields++; }
  );
  assert.equal(outcome.cancelled, true);
  assert.equal(outcome.move, null);
  assert.equal(yields, 1);
  assert.equal(JSON.stringify(s), before, 'cancellation must not mutate the input position');
});

test('MinMax contract search returns a structured legal move without mutating its frozen request', () => {
  const s = position();
  s.board[6][0] = { type: 'r', color: 'w', moved: false };
  const request = EngineContract.createRequest({
    requestId: 'minmax-contract-legal',
    generation: 3,
    engineId: 'minmax_legacy',
    position: s,
    limits: { depth: 1 }
  });
  const before = JSON.stringify(request);
  const result = sandbox.api.MinMaxLegacy.search(request);

  assert.equal(result.status, EngineContract.statuses.COMPLETED, JSON.stringify(result));
  assert.equal(result.requestId, request.requestId);
  assert.equal(result.generation, request.generation);
  assert.equal(result.protocolVersion, EngineContract.version);
  assert.equal(result.engineId, request.engineId);
  assert.ok(EngineContract.validateMove(result.move));
  assert.ok(allLegalState(s).some(m => JSON.stringify(m) === JSON.stringify(result.move)));
  assert.equal(JSON.stringify(request), before);
});


test('MinMax search core owns protocol-v1 validation and structured outcomes', () => {
  const s = position();
  s.board[6][0] = { type: 'r', color: 'w', moved: false };
  const request = EngineContract.createRequest({
    requestId: 'minmax-core-search',
    generation: 12,
    engineId: 'minmax_legacy',
    position: s,
    limits: { depth: 1 }
  });
  const before = JSON.stringify(request);
  const result = sandbox.api.MinMaxSearchCore.search(request);

  assert.equal(result.status, EngineContract.statuses.COMPLETED, JSON.stringify(result));
  assert.equal(EngineContract.matchesRequest(result, request), true);
  assert.ok(allLegalState(s).some(move => JSON.stringify(move) === JSON.stringify(result.move)));
  assert.equal(JSON.stringify(request), before);

  const wrongEngine = sandbox.api.MinMaxSearchCore.search({ ...request, engineId: 'mcts' });
  assert.equal(wrongEngine.status, EngineContract.statuses.FAILED);
  assert.equal(wrongEngine.error.code, EngineContract.errorCodes.INVALID_REQUEST);

  const invalidPosition = sandbox.api.MinMaxSearchCore.search({
    ...request, position: { ...s, board: [] }
  });
  assert.equal(invalidPosition.status, EngineContract.statuses.FAILED);
  assert.equal(invalidPosition.error.code, EngineContract.errorCodes.INVALID_POSITION);

  const invalidDepth = sandbox.api.MinMaxSearchCore.search({
    ...request, limits: { depth: 11 }
  });
  assert.equal(invalidDepth.status, EngineContract.statuses.FAILED);
  assert.equal(invalidDepth.error.code, EngineContract.errorCodes.INVALID_CONFIG);
});
test('MCTS contract search returns a structured legal move without mutating its frozen request', () => {
  const s = position();
  s.board[6][0] = { type: 'r', color: 'w', moved: false };
  const request = EngineContract.createRequest({
    requestId: 'mcts-contract-legal',
    generation: 5,
    engineId: 'mcts',
    position: s,
    limits: { depth: 1 }
  });
  const before = JSON.stringify(request);
  const engine = sandbox.mctsEngine(1);
  const result = engine.search(request);

  assert.equal(result.status, EngineContract.statuses.COMPLETED);
  assert.equal(result.requestId, request.requestId);
  assert.equal(result.generation, request.generation);
  assert.ok(EngineContract.validateMove(result.move));
  assert.ok(allLegalState(s).some(m => JSON.stringify(m) === JSON.stringify(result.move)));
  assert.equal(JSON.stringify(request), before);
});

test('MinMax contract search reports no-move and rejects requests for another engine', () => {
  const s = position();
  s.board = Array.from({ length: 8 }, () => Array(10).fill(null));
  const noMoveRequest = EngineContract.createRequest({
    requestId: 21, generation: 4, engineId: 'minmax_legacy', position: s, limits: { depth: 1 }
  });
  const noMove = sandbox.api.MinMaxLegacy.search(noMoveRequest);
  assert.equal(noMove.status, EngineContract.statuses.NO_MOVE);
  assert.equal(noMove.move, null);

  const wrongEngineRequest = EngineContract.createRequest({
    requestId: 22, generation: 4, engineId: 'mcts', position: position(), limits: { depth: 1 }
  });
  const rejected = sandbox.api.MinMaxLegacy.search(wrongEngineRequest);
  assert.equal(rejected.status, EngineContract.statuses.FAILED);
  assert.ok(rejected.error);
});


test('MCTS contract search rejects unsupported protocol versions and mismatched engine IDs', () => {
  const engine = sandbox.mctsEngine(1);
  const base = {
    protocolVersion: EngineContract.version,
    requestId: 'mcts-invalid-contract-request',
    generation: 6,
    engineId: 'mcts',
    position: position(),
    limits: { depth: 1 },
    config: {}
  };

  const wrongVersion = engine.search({ ...base, protocolVersion: EngineContract.version + 1 });
  assert.equal(wrongVersion.status, EngineContract.statuses.FAILED);
  assert.equal(wrongVersion.error.code, EngineContract.errorCodes.INVALID_REQUEST);

  const wrongEngine = engine.search({ ...base, engineId: 'minmax_legacy' });
  assert.equal(wrongEngine.status, EngineContract.statuses.FAILED);
  assert.equal(wrongEngine.error.code, EngineContract.errorCodes.INVALID_REQUEST);
});

test('MinMax contract search rejects unsupported protocol versions and mismatched engine IDs', () => {
  const base = {
    protocolVersion: EngineContract.version,
    requestId: 'minmax-invalid-contract-request',
    generation: 7,
    engineId: 'minmax_legacy',
    position: position(),
    limits: { depth: 1 },
    config: {}
  };

  const wrongVersion = sandbox.api.MinMaxLegacy.search({
    ...base,
    protocolVersion: EngineContract.version + 1
  });
  assert.equal(wrongVersion.status, EngineContract.statuses.FAILED);
  assert.equal(wrongVersion.error.code, EngineContract.errorCodes.INVALID_REQUEST);

  const wrongEngine = sandbox.api.MinMaxLegacy.search({
    ...base,
    engineId: 'mcts'
  });
  assert.equal(wrongEngine.status, EngineContract.statuses.FAILED);
  assert.equal(wrongEngine.error.code, EngineContract.errorCodes.INVALID_REQUEST);
});

test('MinMax and MCTS convert thrown search errors into failed contract results', () => {
  const engines = [
    ['minmax_legacy', sandbox.api.MinMaxLegacy],
    ['mcts', sandbox.mctsEngine(1)]
  ];

  for (const [engineId, engine] of engines) {
    const circularPosition = position();
    circularPosition.self = circularPosition;
    const request = {
      protocolVersion: EngineContract.version,
      requestId: `error-${engineId}`,
      generation: 1,
      engineId,
      position: circularPosition,
      limits: { depth: 1 },
      config: {}
    };

    const result = engine.search(request);
    assert.equal(result.status, EngineContract.statuses.FAILED, `${engineId} should report a failed search`);
    assert.equal(result.requestId, request.requestId);
    assert.equal(result.generation, request.generation);
    assert.equal(result.error.code, EngineContract.errorCodes.SEARCH_FAILED);
  }
});

test('structured worker serializes and invokes the MinMax contract entry point', () => {
  const workerSourceStart = source.indexOf('const workerSource = `');
  const workerSourceEnd = source.indexOf('`;\n  let blob, url;', workerSourceStart);
  assert.ok(workerSourceStart >= 0 && workerSourceEnd > workerSourceStart,
    'worker source template should be present');
  const workerSource = source.slice(workerSourceStart, workerSourceEnd);
  assert.match(source, /function createEngineContract\(\)/,
    'the main thread should define the canonical engine contract factory');
  assert.match(workerSource, /\$\{createEngineContract\.toString\(\)\}/,
    'the worker should serialize the canonical contract factory rather than maintain a duplicate');
  assert.doesNotMatch(workerSource, /const EngineContract = \{/,
    'the worker must not define a second hand-maintained contract object');
  assert.match(workerSource, /const MinMaxLegacy = \{ id: 'minmax_legacy', search: \\?\$\{MinMaxLegacy\.search\.toString\(\)\} \}/);
  assert.match(workerSource, /MinMaxSearchCore\.getBestMoveAsync/,
    'structured MinMax worker requests must use the cooperative asynchronous search entry point');
});

test('structured worker keeps cooperative cancellation dispatch for both engines', () => {
  const workerSourceStart = source.indexOf('const workerSource = `');
  const workerSourceEnd = source.indexOf('`;', workerSourceStart);
  assert.ok(workerSourceStart >= 0 && workerSourceEnd > workerSourceStart,
    'worker source template should be present');
  const workerSource = source.slice(workerSourceStart, workerSourceEnd);

  assert.match(workerSource, /mctsSearchAsync/,
    'the MCTS async search must be serialized into the worker');
  assert.match(workerSource, /if \(request\.engineId === 'mcts'\)/,
    'structured MCTS requests must use their dedicated worker branch');
  assert.match(workerSource, /mctsSearchAsync\(/,
    'structured MCTS requests must use the cooperative async search entry point');
  assert.match(workerSource, /MinMaxSearchCore\.getBestMoveAsync\(/,
    'structured MinMax requests must use the cooperative async search entry point');
  assert.match(workerSource, /EngineContract\.createCancellationAcknowledgment\(/,
    'the worker must acknowledge cooperative cancellation using the shared contract');
  assert.match(workerSource, /activeSearches\.delete\(key\)/,
    'completed or cancelled worker searches must be removed from the active registry');
});

test('worker rejects failed and malformed completed results for both engine selectors', () => {
  const previousCreateObjectURL = sandbox.URL.createObjectURL;
  const previousRevokeObjectURL = sandbox.URL.revokeObjectURL;
  const previousWorker = sandbox.Worker;
  const previousWindowWorker = sandbox.window.Worker;
  const workers = [];

  class ResponseWorker {
    constructor(url) {
      this.url = url;
      this.terminated = false;
      this.onmessage = null;
      this.onerror = null;
      this.request = null;
      workers.push(this);
    }
    postMessage(request) { this.request = request; }
    terminate() { this.terminated = true; }
  }

  sandbox.api.resetAIWorker();
  sandbox.URL.createObjectURL = () => 'blob:engine-result-validation-test';
  sandbox.URL.revokeObjectURL = () => {};
  sandbox.Worker = ResponseWorker;
  sandbox.window.Worker = ResponseWorker;

  try {
    for (const engineId of ['minmax_legacy', 'mcts']) {
      for (const resultKind of ['failed', 'malformed', 'wrong-protocol', 'wrong-engine', 'wrong-request-id', 'wrong-generation']) {
        sandbox.api.resetAIWorker();
        configureEngine('white', 'endgame', engineId);
      configureEngine('black', 'opening', 'minmax_legacy');
        sandbox.api.updateEngineConfigUI();
        sandbox.api.setState(position());
        sandbox.api.aiMove();

        const worker = workers[workers.length - 1];
        const contractRequest = worker.request.contractRequest;
        assert.equal(contractRequest.engineId, engineId, 'the worker request should target the selected engine');
        const validMove = { from: { r: 7, c: 4 }, to: { r: 6, c: 4 } };
        const result = resultKind === 'failed'
          ? EngineContract.failed(contractRequest, EngineContract.errorCodes.SEARCH_FAILED, 'simulated search failure')
          : {
              protocolVersion: resultKind === 'wrong-protocol' ? EngineContract.version + 1 : EngineContract.version,
              engineId: resultKind === 'wrong-engine' ? (engineId === 'mcts' ? 'minmax_legacy' : 'mcts') : engineId,
              status: EngineContract.statuses.COMPLETED,
              requestId: resultKind === 'wrong-request-id' ? `${contractRequest.requestId}-stale` : contractRequest.requestId,
              generation: resultKind === 'wrong-generation' ? contractRequest.generation + 1 : contractRequest.generation,
              move: resultKind === 'malformed'
                ? { from: { r: -1, c: 0 }, to: { r: 0, c: 0 } }
                : validMove
            };

        worker.onmessage({ data: { id: worker.request.id, result } });

        const expectedError = {
          failed: /AI error: simulated search failure/,
          malformed: /AI error: engine returned an invalid move/,
          'wrong-protocol': /AI error: stale or mismatched engine result/,
          'wrong-engine': /AI error: stale or mismatched engine result/,
          'wrong-request-id': /AI error: stale or mismatched engine result/,
          'wrong-generation': /AI error: stale or mismatched engine result/
        }[resultKind];
        assert.match(sandbox.document.getElementById('status').textContent, expectedError);
        assert.equal(sandbox.api.getGameOver(), false, 'an engine error must not be mistaken for checkmate');
        assert.equal(sandbox.api.getActiveAIForTest().thinking, false, 'the failed request should no longer be active');
      }
    }
  } finally {
    sandbox.api.resetAIWorker();
    sandbox.URL.createObjectURL = previousCreateObjectURL;
    sandbox.URL.revokeObjectURL = previousRevokeObjectURL;
    sandbox.Worker = previousWorker;
    sandbox.window.Worker = previousWindowWorker;
  }
});

test('engine cancellation messages preserve request identity and distinguish outcomes', () => {
  const request = EngineContract.createRequest({
    requestId: 'cancel-42', generation: 7, engineId: 'minmax_legacy',
    position: { board: Array.from({ length: 8 }, () => Array(10).fill(null)), turn: 'w' }, limits: { depth: 2 }
  });
  const cancellation = EngineContract.createCancellationRequest(request, 'undo');
  assert.deepEqual({ ...cancellation }, {
    type: 'cancel', protocolVersion: 1, engineId: 'minmax_legacy',
    requestId: 'cancel-42', generation: 7, reason: 'undo'
  });
  const ack = EngineContract.createCancellationAcknowledgment(cancellation, 'cancelled');
  assert.equal(EngineContract.matchesCancellationAcknowledgment(ack, cancellation), true);
  assert.equal(EngineContract.matchesCancellationAcknowledgment(
    { ...ack, requestId: 'different-request' }, cancellation), false);
  assert.equal(EngineContract.matchesCancellationAcknowledgment(
    { ...ack, generation: 8 }, cancellation), false);
  assert.equal(EngineContract.createCancellationAcknowledgment(cancellation, 'already-finished').outcome, 'already-finished');
  assert.equal(EngineContract.createCancellationAcknowledgment(cancellation, 'not-found').outcome, 'not-found');
  assert.throws(() => EngineContract.createCancellationAcknowledgment(cancellation, 'success'));
});

test('engine contract matches only the corresponding request identity and generation', () => {
  const request = EngineContract.createRequest({
    requestId: 31, generation: 8, engineId: 'minmax_legacy', position: position(), limits: { depth: 1 }
  });
  const result = EngineContract.completed(request, {
    from: { r: 7, c: 4 }, to: { r: 6, c: 4 }
  });
  assert.equal(EngineContract.matchesRequest(result, request), true);
  assert.equal(EngineContract.matchesRequest({ ...result, requestId: 32 }, request), false);
  assert.equal(EngineContract.matchesRequest({ ...result, generation: 9 }, request), false);
  assert.equal(EngineContract.matchesRequest({ ...result, protocolVersion: EngineContract.version + 1 }, request), false);
  assert.equal(EngineContract.matchesRequest({ ...result, protocolVersion: undefined }, request), false);
  assert.equal(EngineContract.matchesRequest({ ...result, engineId: 'mcts' }, request), false);
  assert.equal(EngineContract.matchesRequest({ ...result, engineId: undefined }, request), false);
});

test('MCTS contract search returns a correctly identified no-move result', () => {
  const s = position();
  s.board = Array.from({ length: 8 }, () => Array(10).fill(null));
  const request = EngineContract.createRequest({
    requestId: 'mcts-contract-no-move',
    generation: 11,
    engineId: 'mcts',
    position: s,
    limits: { depth: 1 }
  });

  const result = sandbox.mctsEngine(1).search(request);
  assert.equal(result.status, EngineContract.statuses.NO_MOVE);
  assert.equal(result.move, null);
  assert.equal(result.protocolVersion, request.protocolVersion);
  assert.equal(result.engineId, request.engineId);
  assert.equal(result.requestId, request.requestId);
  assert.equal(result.generation, request.generation);
  assert.equal(EngineContract.matchesRequest(result, request), true);
});

test('MinMax contract search returns a correctly identified no-move result', () => {
  const s = position();
  s.board = Array.from({ length: 8 }, () => Array(10).fill(null));
  const request = EngineContract.createRequest({
    requestId: 'minmax-contract-no-move',
    generation: 10,
    engineId: 'minmax_legacy',
    position: s,
    limits: { depth: 1 }
  });

  const result = sandbox.api.MinMaxLegacy.search(request);
  assert.equal(result.status, EngineContract.statuses.NO_MOVE);
  assert.equal(result.move, null);
  assert.equal(result.protocolVersion, request.protocolVersion);
  assert.equal(result.engineId, request.engineId);
  assert.equal(result.requestId, request.requestId);
  assert.equal(result.generation, request.generation);
  assert.equal(EngineContract.matchesRequest(result, request), true);
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


test('en passant expires after the eligible side makes another move', () => {
  const s = position();
  s.board[3][3] = { type: 'p', color: 'w', moved: true };
  s.board[1][4] = { type: 'p', color: 'b', moved: false };
  s.turn = 'b';

  applyRaw(s, { from: { r: 1, c: 4 }, to: { r: 3, c: 4 }, doublePawn: true });
  assert.ok(allLegalState(s).some(m => m.enPassant));

  const kingMove = allLegalState(s).find(m =>
    m.from.r === 7 && m.from.c === 4 && m.to.r === 7 && m.to.c === 5
  );
  assert.ok(kingMove, 'a safe king move should be available');
  applyRaw(s, kingMove);

  assert.equal(s.ep, null);
  assert.equal(allLegalState(s).some(m => m.enPassant), false);
});

test('en passant rejects an occupied target or a non-pawn captured piece', () => {
  const cases = [
    { name: 'no adjacent piece', adjacent: null, target: null },
    { name: 'adjacent enemy knight', adjacent: { type: 'n', color: 'b', moved: true }, target: null },
    { name: 'friendly piece on target', adjacent: { type: 'p', color: 'b', moved: true }, target: { type: 'n', color: 'w', moved: true } }
  ];

  for (const scenario of cases) {
    const s = position();
    s.board[3][3] = { type: 'p', color: 'w', moved: true };
    s.board[3][4] = scenario.adjacent;
    s.board[2][4] = scenario.target;
    s.ep = { r: 2, c: 4 };
    s.turn = 'w';

    assert.equal(
      allLegalState(s).some(m => m.enPassant && m.from.r === 3 && m.from.c === 3),
      false,
      `en passant should be unavailable for: ${scenario.name}`
    );
  }
});

test('en passant is illegal when removing both pawns exposes the king to check', () => {
  const s = position();
  s.board[7][4] = null;
  s.board[3][0] = { type: 'k', color: 'w', moved: true };
  s.board[3][4] = { type: 'p', color: 'w', moved: true };
  s.board[3][5] = { type: 'p', color: 'b', moved: true };
  s.board[3][9] = { type: 'r', color: 'b', moved: true };
  s.ep = { r: 2, c: 5 };
  s.turn = 'w';

  assert.equal(
    allLegalState(s).some(m => m.enPassant && m.from.r === 3 && m.from.c === 4),
    false,
    'en passant must not expose the moving side king to a rook attack'
  );
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

test('engine move matching ignores object property order but rejects illegal moves', () => {
  const s = position();
  const legal = allLegalState(s)[0];
  assert.ok(legal, 'the initial position should have legal moves');

  const reordered = {
    to: { c: legal.to.c, r: legal.to.r },
    from: { c: legal.from.c, r: legal.from.r }
  };
  for (const key of Object.keys(legal)) {
    if (key !== 'from' && key !== 'to') reordered[key] = legal[key];
  }
  assert.ok(sandbox.api.findLegalMoveMatch(s, reordered),
    'a legal move with reordered JSON properties should be accepted');
  assert.equal(
    JSON.stringify(sandbox.api.findLegalMoveMatch(s, reordered)),
    JSON.stringify(legal),
    'the validator should return the canonical legal move object'
  );

  const illegal = { ...reordered, to: { r: (legal.to.r + 3) % 8, c: legal.to.c } };
  assert.equal(sandbox.api.findLegalMoveMatch(s, illegal), null,
    'a move to a different square must remain rejected');
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
  assert.equal(JSON.stringify(after.moveCounts), JSON.stringify({ w: 4, b: 4 }));
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


test('main-thread dispatch rechecks engine variant compatibility immediately before search', () => {
  const engine = sandbox.api.enginePlugins.get('mcts');
  const originalVariants = engine.supportedVariants;
  const originalSearch = engine.search;
  const originalConfig = sandbox.api.getEngineConfiguration();
  const previousWorker = sandbox.Worker;
  const previousWindowWorker = sandbox.window.Worker;
  let searchCalls = 0;
  const callbackIndex = scheduledCallbacks.length;
  try {
    sandbox.api.resetAIWorker();
    engine.supportedVariants = [{ id: 'jester-moat', versions: [1] }];
    engine.search = function(request) { searchCalls++; return originalSearch.call(this, request); };
    configureEngine('white', 'endgame', 'mcts');
    sandbox.api.setState(position());
    mockElement('modeSelect').value = 'ai';
    sandbox.Worker = undefined;
    sandbox.window.Worker = undefined;
    sandbox.api.aiMove();
    assert.equal(scheduledCallbacks.length, callbackIndex + 1, 'main-thread search should be scheduled');
    engine.supportedVariants = [];
    scheduledCallbacks[callbackIndex]();
    assert.equal(searchCalls, 0, 'incompatible engine must be rejected before search');
    assert.match(mockElement('status').textContent, /does not support variant jester-moat v1/);
    assert.equal(sandbox.api.getActiveAIForTest().thinking, false);
  } finally {
    engine.supportedVariants = originalVariants;
    engine.search = originalSearch;
    sandbox.api.setEngineConfiguration(originalConfig);
    sandbox.api.resetAIWorker();
    sandbox.Worker = previousWorker;
    sandbox.window.Worker = previousWindowWorker;
    scheduledCallbacks.splice(callbackIndex);
  }
});

test('worker dispatches MinMax and returns a legal move', async () => {
  const workerBlobs = new Map();
  sandbox.URL.createObjectURL = blob => {
    const url = `blob:engine-contract-test-${workerBlobs.size}`;
    workerBlobs.set(url, blob);
    return url;
  };
  sandbox.URL.revokeObjectURL = () => {};
  sandbox.Worker = class {
    constructor(url) { this.url = url; this.onmessage = null; this.onerror = null; }
    async postMessage(data) {
      const source = await workerBlobs.get(this.url).text();
      let response;
      const workerContext = {
        postMessage(message) { response = message; },
        setTimeout(callback) { callback(); return 1; }
      };
      vm.createContext(workerContext);
      vm.runInContext(source, workerContext, { filename: 'ai-worker.js' });
      await workerContext.onmessage({ data });
      if (this.onmessage) this.onmessage({ data: response });
      return response;
    }
  };

  const worker = ensureAIWorker();
  assert.ok(worker, 'worker should initialize when Blob workers are available');
  const s = position();
  s.board[6][0] = { type: 'r', color: 'w', moved: false };
  const contractRequest = EngineContract.createRequest({
    requestId: 101, generation: 7, engineId: 'minmax_legacy',
    position: s, limits: { depth: 1 }
  });
  const response = await new Promise(async resolve => {
    worker.onmessage = event => resolve(event.data);
    await worker.postMessage({ id: 101, contractRequest });
  });

  assert.equal(response.id, 101);
  assert.equal(response.error, undefined);
  assert.equal(response.result.protocolVersion, 1);
  assert.equal(response.result.requestId, contractRequest.requestId);
  assert.equal(response.result.generation, contractRequest.generation);
  assert.equal(response.result.engineId, contractRequest.engineId);
  assert.equal(response.result.status, EngineContract.statuses.COMPLETED, JSON.stringify(response.result));
  assert.ok(response.result.move, 'structured MinMax worker should return a move');
  assert.ok(allLegalState(s).some(m => JSON.stringify(m) === JSON.stringify(response.result.move)));
});

test('worker dispatches structured MCTS requests and returns a legal move', async () => {
  const worker = ensureAIWorker();
  const s = position();
  s.board[6][0] = { type: 'r', color: 'w', moved: false };
  const contractRequest = EngineContract.createRequest({
    requestId: 102, generation: 9, engineId: 'mcts',
    position: s, limits: { depth: 1 }
  });
  const response = await new Promise(async resolve => {
    worker.onmessage = event => resolve(event.data);
    await worker.postMessage({ id: 102, contractRequest });
  });

  assert.equal(response.id, 102);
  assert.equal(response.error, undefined);
  assert.equal(response.result.protocolVersion, 1);
  assert.equal(response.result.requestId, contractRequest.requestId);
  assert.equal(response.result.generation, contractRequest.generation);
  assert.equal(response.result.engineId, 'mcts');
  assert.equal(response.result.status, EngineContract.statuses.COMPLETED);
  assert.ok(response.result.move, 'structured MCTS worker should return a move');
  assert.ok(allLegalState(s).some(m => JSON.stringify(m) === JSON.stringify(response.result.move)));
});

test('structured MCTS worker routes requests through the engine contract', async () => {
  const worker = ensureAIWorker();
  const s = position();
  const invalidRequest = {
    protocolVersion: 99, requestId: 'mcts-worker-invalid-protocol',
    generation: 10, engineId: 'mcts', position: s, limits: { depth: 1 }, config: {}
  };
  const response = await new Promise(async resolve => {
    worker.onmessage = event => resolve(event.data);
    await worker.postMessage({ id: 105, contractRequest: invalidRequest });
  });

  assert.equal(response.id, 105);
  assert.equal(response.result.status, EngineContract.statuses.FAILED);
  assert.equal(response.result.error.code, EngineContract.errorCodes.INVALID_REQUEST);
  assert.equal(response.result.requestId, invalidRequest.requestId);
  assert.equal(response.result.generation, invalidRequest.generation);
  assert.equal(response.result.engineId, invalidRequest.engineId);
});

test('worker keeps legacy MCTS selector available during migration', async () => {
  const worker = ensureAIWorker();
  const s = position();
  s.board[6][0] = { type: 'r', color: 'w', moved: false };
  const response = await new Promise(async resolve => {
    worker.onmessage = event => resolve(event.data);
    await worker.postMessage({ id: 104, state: s, depth: 1, workerFn: 'mctsGetMove' });
  });

  assert.equal(response.id, 104);
  assert.equal(response.error, undefined);
  assert.ok(response.move, 'legacy MCTS compatibility path should return a move');
  assert.ok(allLegalState(s).some(m => JSON.stringify(m) === JSON.stringify(response.move)));
});

test('worker reports unsupported engine selectors explicitly', async () => {
  const worker = ensureAIWorker();
  const response = await new Promise(async resolve => {
    worker.onmessage = event => resolve(event.data);
    await worker.postMessage({ id: 103, state: position(), depth: 1, workerFn: 'unknownEngine' });
  });

  assert.equal(response.id, 103);
  assert.match(response.error, /Unsupported worker function: unknownEngine/);
});

test('structured worker dispatch rejects unsupported variant identities with a stable error', async () => {
  const workerBlobs = new Map();
  const previousCreateObjectURL = sandbox.URL.createObjectURL;
  const previousRevokeObjectURL = sandbox.URL.revokeObjectURL;
  const previousWorker = sandbox.Worker;
  const previousWindowWorker = sandbox.window.Worker;
  sandbox.URL.createObjectURL = blob => {
    const url = `blob:unsupported-variant-${workerBlobs.size}`;
    workerBlobs.set(url, blob);
    return url;
  };
  sandbox.URL.revokeObjectURL = () => {};
  sandbox.Worker = class {
    constructor(url) { this.url = url; this.onmessage = null; this.onerror = null; }
    async postMessage(data) {
      const source = await workerBlobs.get(this.url).text();
      let response;
      const workerContext = { postMessage(message) { response = message; }, setTimeout(callback) { callback(); return 1; } };
      vm.createContext(workerContext);
      vm.runInContext(source, workerContext, { filename: 'ai-worker.js' });
      await workerContext.onmessage({ data });
      if (this.onmessage) this.onmessage({ data: response });
      return response;
    }
    terminate() {}
  };
  sandbox.window.Worker = sandbox.Worker;
  sandbox.api.resetAIWorker();
  try {
    const worker = ensureAIWorker();
    for (const engineId of ['minmax_legacy', 'mcts']) {
      const requestId = engineId === 'mcts' ? 202 : 201;
      const unsupportedPosition = position();
      unsupportedPosition.variant = { id: 'unregistered-variant', version: 1 };
      const request = EngineContract.createRequest({ requestId, generation: requestId, engineId,
        position: unsupportedPosition, limits: { depth: 1, timeMs: 1000 },
        config: { strength: 'medium', settings: {} } });
      const response = await new Promise(resolve => {
        worker.onmessage = event => resolve(event.data);
        worker.postMessage({ id: requestId, contractRequest: request });
      });
      assert.equal(response.id, requestId);
      assert.equal(response.result.status, 'failed');
      assert.equal(response.result.error.code, 'UNSUPPORTED_VARIANT');
      assert.match(response.result.error.message, /does not support variant unregistered-variant v1/);
    }
    for (const engineId of ['minmax_legacy', 'mcts']) {
      const requestId = engineId === 'mcts' ? 204 : 203;
      const request = EngineContract.createRequest({ requestId, generation: requestId, engineId,
        position: position(), limits: { depth: 1, timeMs: 1000 },
        config: { strength: 'medium', settings: {}, personalityId: 'aggressive' } });
      const response = await new Promise(resolve => {
        worker.onmessage = event => resolve(event.data);
        worker.postMessage({ id: requestId, contractRequest: request });
      });
      assert.equal(response.result.status, 'failed');
      assert.equal(response.result.error.code, 'UNSUPPORTED_PERSONALITY');
      assert.match(response.result.error.message, /does not support personality profile aggressive/);
    }
  } finally {
    sandbox.api.resetAIWorker();
    sandbox.URL.createObjectURL = previousCreateObjectURL;
    sandbox.URL.revokeObjectURL = previousRevokeObjectURL;
    sandbox.Worker = previousWorker;
    sandbox.window.Worker = previousWindowWorker;
  }
});


test('engine configuration defaults cover every side and phase independently', () => {
  sandbox.api.applyEnginePreset('balanced');
  const config = sandbox.api.getEngineConfiguration();
  assert.equal(config.schemaVersion, 1);
  assert.equal(config.presetId, 'balanced');
  assert.deepEqual(Object.keys(sandbox.api.PERSONALITY_PROFILES), ['default']);
  assert.equal(sandbox.api.PERSONALITY_PROFILES.default.name, 'Default');
  for (const engineId of ['minmax_legacy', 'mcts']) {
    assert.deepEqual(Array.from(sandbox.api.enginePlugins.get(engineId).supportedPersonalities), ['default']);
  }
  for (const side of ['white', 'black']) {
    for (const phase of ['opening', 'midgame', 'endgame']) {
      assert.equal(JSON.stringify(config.sides[side].phases[phase]), JSON.stringify({
        engineId: 'minmax_legacy', strength: 'medium', personalityId: 'default', advanced: {}
      }));
    }
  }
});

test('side and phase assignments accept mixed engines, strengths, and independent advanced settings', () => {
  const config = sandbox.api.getEngineConfiguration();
  config.sides.white.phases.opening = {
    engineId: 'mcts', strength: 'hard', advanced: { playouts: 3000 }
  };
  config.sides.white.phases.midgame = {
    engineId: 'minmax_legacy', strength: 'easy', advanced: { depth: 4 }
  };
  config.sides.black.phases.endgame = {
    engineId: 'mcts', strength: 'easy', advanced: { temperature: 0.7 }
  };
  sandbox.api.setEngineConfiguration(config);

  const whiteOpening = sandbox.api.getEngineAssignment('w', 'opening');
  const whiteMidgame = sandbox.api.getEngineAssignment('w', 'midgame');
  const blackEndgame = sandbox.api.getEngineAssignment('b', 'endgame');
  assert.equal(whiteOpening.engine.id, 'mcts');
  assert.equal(whiteOpening.personalityId, 'default');
  assert.equal(whiteOpening.personality.name, 'Default');
  assert.equal(whiteOpening.strength, 'hard');
  assert.equal(whiteOpening.settings.playouts, 3000);
  assert.equal(whiteOpening.settings.capDepth, 18);
  assert.equal(whiteMidgame.engine.id, 'minmax_legacy');
  assert.equal(whiteMidgame.settings.depth, 4);
  assert.equal(blackEndgame.engine.id, 'mcts');
  assert.equal(blackEndgame.settings.temperature, 0.7);
  assert.equal(blackEndgame.settings.playouts, 200);
  assert.equal(sandbox.api.getEngineAssignment('b', 'opening').engine.id, 'minmax_legacy');
});

test('engine configuration rejects unsupported personality profiles explicitly', () => {
  const engine = sandbox.api.enginePlugins.get('mcts');
  const original = engine.supportedPersonalities;
  try {
    engine.supportedPersonalities = [];
    const config = sandbox.api.getEngineConfiguration();
    config.sides.white.phases.opening.engineId = 'mcts';
    assert.throws(() => sandbox.api.validateEngineConfiguration(config), error =>
      error.code === 'UNSUPPORTED_PERSONALITY' && /mcts does not support personality profile default/.test(error.message));
  } finally {
    engine.supportedPersonalities = original;
  }
  const unknownProfile = sandbox.api.getEngineConfiguration();
  unknownProfile.sides.black.phases.endgame.personalityId = 'aggressive';
  assert.throws(() => sandbox.api.validateEngineConfiguration(unknownProfile), error =>
    error.code === 'UNSUPPORTED_PERSONALITY' && /personality profile aggressive/.test(error.message));
});

test('main-thread engine search rejects unsupported personality profiles', () => {
  for (const engineId of ['minmax_legacy', 'mcts']) {
    const request = EngineContract.createRequest({
      requestId: 'unsupported-personality-' + engineId,
      generation: 1,
      engineId,
      position: position(),
      limits: { depth: 1, timeMs: 1000 },
      config: { strength: 'medium', settings: {}, personalityId: 'aggressive' }
    });
    const result = sandbox.api.enginePlugins.get(engineId).search(request);
    assert.equal(result.status, EngineContract.statuses.FAILED);
    assert.equal(result.error.code, 'UNSUPPORTED_PERSONALITY');
    assert.match(result.error.message, /does not support personality profile aggressive/);
  }
});

test('MinMax treats a null request config as the default personality', () => {
  const request = EngineContract.createRequest({
    requestId: 'null-config-default-personality',
    generation: 1,
    engineId: 'minmax_legacy',
    position: position(),
    limits: { depth: 1, timeMs: 1000 },
    config: null
  });
  const result = sandbox.api.enginePlugins.get('minmax_legacy').search(request);
  assert.equal(result.status, EngineContract.statuses.COMPLETED);
  assert.ok(result.move);
});

test('engine configuration rejects engines that do not declare support for the active variant', () => {
  const engine = sandbox.api.enginePlugins.get('mcts');
  const original = engine.supportedVariants;
  try {
    engine.supportedVariants = [];
    const config = sandbox.api.getEngineConfiguration();
    config.sides.white.phases.opening.engineId = 'mcts';
    assert.throws(() => sandbox.api.validateEngineConfiguration(config), error =>
      error.code === 'UNSUPPORTED_VARIANT' && /mcts does not support variant jester-moat v1/.test(error.message));
  } finally {
    engine.supportedVariants = original;
  }
  const wrongVersion = sandbox.api.getEngineConfiguration();
  assert.throws(() => sandbox.api.validateEngineConfiguration(wrongVersion,
    { variant: { id: 'jester-moat', version: 2 } }), error =>
    error.code === 'UNSUPPORTED_VARIANT' && /jester-moat v2/.test(error.message));
});

test('engine configuration rejects unknown engines, unsupported settings, and out-of-range values', () => {
  const base = sandbox.api.getEngineConfiguration();
  const unknownEngine = JSON.parse(JSON.stringify(base));
  unknownEngine.sides.white.phases.opening.engineId = 'missing-engine';
  assert.throws(() => sandbox.api.validateEngineConfiguration(unknownEngine), /Invalid white opening engine assignment/);

  const unsupportedSetting = JSON.parse(JSON.stringify(base));
  unsupportedSetting.sides.black.phases.midgame.advanced = { exploration: 2 };
  assert.throws(() => sandbox.api.validateEngineConfiguration(unsupportedSetting), /Unsupported setting/);

  const outOfRange = JSON.parse(JSON.stringify(base));
  outOfRange.sides.white.phases.endgame = {
    engineId: 'mcts', strength: 'medium', advanced: { temperature: 1.5 }
  };
  assert.throws(() => sandbox.api.validateEngineConfiguration(outOfRange), /Invalid value/);
});

test('strength profiles supply engine-specific settings and Advanced overrides take priority', () => {
  const config = sandbox.api.getEngineConfiguration();
  config.sides.white.phases.opening = {
    engineId: 'mcts', strength: 'medium', advanced: { playouts: 1200 }
  };
  config.sides.black.phases.opening = {
    engineId: 'minmax_legacy', strength: 'hard', advanced: { depth: 5 }
  };
  sandbox.api.setEngineConfiguration(config);

  const mcts = sandbox.api.getEngineAssignment('w', 'opening');
  const minmax = sandbox.api.getEngineAssignment('b', 'opening');
  assert.equal(mcts.settings.playouts, 1200);
  assert.equal(mcts.settings.capDepth, 14);
  assert.equal(mcts.settings.temperature, 0.15);
  assert.equal(minmax.settings.depth, 5);
  assert.equal(minmax.settings.timeMs, 10000);
});

test('presets populate all assignments and manual changes mark the configuration custom', () => {
  assert.equal(sandbox.api.applyEnginePreset('easy'), true);
  let config = sandbox.api.getEngineConfiguration();
  assert.equal(config.presetId, 'easy');
  assert.equal(config.sides.white.phases.endgame.strength, 'easy');
  assert.equal(config.sides.black.phases.opening.strength, 'easy');

  config.sides.white.phases.opening.engineId = 'mcts';
  config.presetId = null;
  sandbox.api.setEngineConfiguration(config);
  assert.equal(sandbox.api.getEngineConfiguration().presetId, null);
  assert.equal(sandbox.api.applyEnginePreset('balanced'), true);
  config = sandbox.api.getEngineConfiguration();
  assert.equal(config.presetId, 'balanced');
  assert.equal(config.sides.white.phases.opening.engineId, 'minmax_legacy');
  assert.equal(config.sides.black.phases.endgame.strength, 'medium');
});

test('new configuration persists and restores; old or malformed saved shapes reset to defaults', () => {
  const config = sandbox.api.getEngineConfiguration();
  config.sides.white.phases.opening = {
    engineId: 'mcts', strength: 'hard', advanced: { playouts: 2500 }
  };
  sandbox.api.setEngineConfiguration(config);
  const saved = JSON.parse(storedValues.get('engineConfig'));
  assert.equal(saved.schemaVersion, 1);
  assert.equal(saved.sides.white.phases.opening.engineId, 'mcts');
  assert.equal(saved.sides.white.phases.opening.personalityId, 'default');

  delete saved.sides.white.phases.opening.personalityId;
  storedValues.set('engineConfig', JSON.stringify(saved));
  sandbox.api.loadEngineConfig();
  assert.equal(sandbox.api.getEngineAssignment('w', 'opening').engine.id, 'mcts');
  assert.equal(sandbox.api.getEngineAssignment('w', 'opening').personalityId, 'default');
  assert.equal(sandbox.api.getEngineAssignment('w', 'opening').settings.playouts, 2500);

  storedValues.set('engineConfig', JSON.stringify({ whiteEngine: 'mcts', whitePhase: 'opening' }));
  sandbox.api.loadEngineConfig();
  assert.equal(sandbox.api.getEngineAssignment('w', 'opening').engine.id, 'minmax_legacy');
  assert.equal(sandbox.api.getEngineConfiguration().presetId, 'balanced');

  storedValues.set('engineConfig', '{broken json');
  sandbox.api.loadEngineConfig();
  assert.equal(sandbox.api.getEngineAssignment('b', 'endgame').engine.id, 'minmax_legacy');
});

test('storage read and write failures do not throw during engine configuration setup', () => {
  storageThrowsOnRead = true;
  storageThrowsOnWrite = true;
  assert.doesNotThrow(() => sandbox.api.loadEngineConfig());
  storageThrowsOnRead = false;
  storageThrowsOnWrite = false;
});

test('2 Player Pass hides engine controls and cannot dispatch Play or Next AI actions', () => {
  mockElement('modeSelect').value = 'pvp';
  sandbox.api.updateModeUI();
  assert.equal(mockElement('aiEngineSection').hidden, true);
  assert.equal(mockElement('stepBtn').disabled, true);
  assert.equal(mockElement('autoBtn').disabled, true);

  sandbox.api.aiMove();
  sandbox.api.stepNextMove();
  sandbox.api.toggleAutoPlay();
  assert.equal(sandbox.api.getActiveAIForTest().thinking, false);
  assert.equal(sandbox.api.getAutoPlayForTest(), null);
});


function castleEdgePosition(side = 'kingside', options = {}) {
  const s = position();
  s.board = Array.from({ length: 8 }, () => Array(10).fill(null));
  s.board[7][options.kingColumn ?? 5] = { type: 'k', color: 'w', moved: !!options.kingMoved };
  s.board[0][options.blackKingColumn ?? 5] = { type: 'k', color: 'b', moved: false };
  const rookColumn = side === 'kingside' ? 9 : 0;
  if (!options.rookMissing) {
    s.board[7][rookColumn] = { type: 'r', color: 'w', moved: !!options.rookMoved };
  }
  if (options.blockedColumn !== undefined) {
    s.board[7][options.blockedColumn] = { type: 'n', color: 'w', moved: true };
  }
  if (options.kingInCheck) {
    s.board[options.checkRookRow ?? 4][5] = { type: 'r', color: 'b', moved: true };
    s.board[0][5] = null;
    s.board[0][4] = { type: 'k', color: 'b', moved: false };
  }
  if (options.attackedPathSquare) {
    s.board[0][5] = null;
    s.board[0][4] = { type: 'k', color: 'b', moved: false };
    s.board[6][7] = { type: 'b', color: 'b', moved: true };
  }
  s.turn = 'w';
  return s;
}

function castleEdgeMove(s, side) {
  return allLegalState(s).find(m => m.castling === side);
}

test('Jester cannot swap with an unmoved friendly piece, an enemy, or a non-adjacent piece', () => {
  const unmoved = position();
  unmoved.board[4][4] = { type: 'j', color: 'w', moved: false };
  unmoved.board[4][5] = { type: 'r', color: 'w', moved: false };
  const unmovedBefore = JSON.stringify(unmoved);
  assert.equal(allLegalState(unmoved).some(m => m.swap), false);
  assert.equal(JSON.stringify(unmoved), unmovedBefore);

  const enemy = position();
  enemy.board[4][4] = { type: 'j', color: 'w', moved: false };
  enemy.board[4][5] = { type: 'r', color: 'b', moved: true };
  const enemyBefore = JSON.stringify(enemy);
  assert.equal(allLegalState(enemy).some(m => m.swap), false);
  assert.equal(JSON.stringify(enemy), enemyBefore);

  const nonAdjacent = position();
  nonAdjacent.board[4][4] = { type: 'j', color: 'w', moved: false };
  nonAdjacent.board[4][6] = { type: 'r', color: 'w', moved: true };
  const nonAdjacentBefore = JSON.stringify(nonAdjacent);
  assert.equal(allLegalState(nonAdjacent).some(m => m.swap), false);
  assert.equal(JSON.stringify(nonAdjacent), nonAdjacentBefore);
});

test('Jester swap is rejected if it leaves its king in check', () => {
  const s = position();
  s.board[4][4] = { type: 'j', color: 'w', moved: false };
  s.board[4][5] = { type: 'r', color: 'w', moved: true };
  s.board[7][9] = { type: 'r', color: 'b', moved: true };
  const before = JSON.stringify(s);
  assert.equal(allLegalState(s).some(m => m.swap && m.from.r === 4 && m.from.c === 4), false);
  assert.equal(JSON.stringify(s), before);
});

test('queenside castling relocates the king and rook to the variant-specific squares', () => {
  const s = castleEdgePosition('queenside');
  const move = castleEdgeMove(s, 'queenside');
  assert.ok(move, 'queenside castling should be legal when its path is clear');
  applyRaw(s, move);
  assert.equal(s.board[7][1].type, 'k');
  assert.equal(s.board[7][2].type, 'r');
  assert.equal(s.board[7][0], null);
  assert.equal(s.board[7][5], null);
  assert.equal(s.board[7][2].moved, true);
});

test('castling is rejected after the king has moved or when the rook is absent or moved', () => {
  assert.equal(castleEdgeMove(castleEdgePosition('kingside', { kingMoved: true }), 'kingside'), undefined);
  assert.equal(castleEdgeMove(castleEdgePosition('kingside', { rookMissing: true }), 'kingside'), undefined);
  assert.equal(castleEdgeMove(castleEdgePosition('kingside', { rookMoved: true }), 'kingside'), undefined);
  assert.equal(castleEdgeMove(castleEdgePosition('queenside', { rookMissing: true }), 'queenside'), undefined);
  assert.equal(castleEdgeMove(castleEdgePosition('queenside', { rookMoved: true }), 'queenside'), undefined);
});

test('castling is rejected when its path is blocked on either side', () => {
  assert.equal(castleEdgeMove(castleEdgePosition('kingside', { blockedColumn: 7 }), 'kingside'), undefined);
  assert.equal(castleEdgeMove(castleEdgePosition('queenside', { blockedColumn: 3 }), 'queenside'), undefined);
});

test('castling is rejected while the king is in check or crosses an attacked square', () => {
  assert.equal(castleEdgeMove(castleEdgePosition('kingside', { kingInCheck: true }), 'kingside'), undefined);
  assert.equal(castleEdgeMove(castleEdgePosition('kingside', { attackedPathSquare: true }), 'kingside'), undefined);
});

test('castling is rejected when the king is not on its original square', () => {
  const s = castleEdgePosition('kingside', { kingColumn: 4 });
  assert.equal(castleEdgeMove(s, 'kingside'), undefined);
});


test('loading an editor position restores castling rights for a home king and corner rooks', () => {
  const s = castleEdgePosition('kingside', { kingMoved: true, rookMoved: true });
  s.board[7][0] = { type: 'r', color: 'w', moved: true };

  sandbox.api.initializeEditorCastlingRights(s.board);

  assert.equal(s.board[7][5].moved, false, 'the king on its home square should be treated as unmoved');
  assert.equal(s.board[7][0].moved, false, 'the queenside rook on its home square should be treated as unmoved');
  assert.equal(s.board[7][9].moved, false, 'the kingside rook on its home square should be treated as unmoved');
  assert.ok(castleEdgeMove(s, 'queenside'), 'queenside castling should be available after loading the position');
  assert.ok(castleEdgeMove(s, 'kingside'), 'kingside castling should be available after loading the position');
});


test('loading a saved game cancels the old engine request and permits a fresh search', () => {
  const previousCreateObjectURL = sandbox.URL.createObjectURL;
  const previousRevokeObjectURL = sandbox.URL.revokeObjectURL;
  const previousWorker = sandbox.Worker;
  const previousWindowWorker = sandbox.window.Worker;
  const workers = [];

  class SaveLoadWorker {
    constructor(url) {
      this.url = url;
      this.terminated = false;
      this.onmessage = null;
      this.onerror = null;
      workers.push(this);
    }
    postMessage(request) { this.request = request; }
    terminate() { this.terminated = true; }
  }

  sandbox.api.resetAIWorker();
  sandbox.URL.createObjectURL = () => `blob:save-load-test-${workers.length}`;
  sandbox.URL.revokeObjectURL = () => {};
  sandbox.Worker = SaveLoadWorker;
  sandbox.window.Worker = SaveLoadWorker;

  try {
    mockElement('modeSelect').value = 'ai';
    configureEngine('white', 'opening', 'minmax_legacy');
    sandbox.api.updateEngineConfigUI();

    const savedPosition = position();
    savedPosition.board[6][0] = { type: 'r', color: 'w', moved: false };
    sandbox.api.setHistoryForTest([savedPosition], [[]]);
    const parsed = sandbox.api.parseGameData(JSON.stringify(sandbox.api.exportGameData()), 0);
    assert.ok(parsed, 'the saved game fixture should parse');

    sandbox.api.setState(position());
    sandbox.api.aiMove();
    const staleWorker = workers[0];
    const staleRequest = staleWorker.request;
    assert.ok(staleRequest?.contractRequest, 'an engine request should be active before loading');

    sandbox.api.applyLoadedGame(parsed);
    assert.equal(staleWorker.terminated, false, 'loading a save should first request cooperative cancellation');
    const cancellation = staleWorker.request.cancellation;
    assert.ok(cancellation, 'loading should send a cancellation envelope for the old request');
    staleWorker.onmessage?.({ data: { id: staleRequest.id, cancellationAck: EngineContract.createCancellationAcknowledgment(cancellation, 'cancelled') } });
    assert.equal(staleWorker.terminated, true, 'the acknowledged old worker should then be terminated');
    assert.equal(sandbox.api.getActiveAIForTest().request, null, 'loading should clear the old request');
    assert.equal(sandbox.api.getActiveAIForTest().thinking, false, 'loading should release the AI thinking lock');
    assert.equal(sandbox.api.getState().board[6][0].type, 'r', 'the saved position should become authoritative');

    sandbox.api.aiMove();
    const resumedWorker = workers[1];
    assert.ok(resumedWorker, 'a new engine worker should be created for the loaded game');
    assert.notEqual(resumedWorker, staleWorker);
    assert.equal(sandbox.api.getActiveAIForTest().request.id, resumedWorker.request.id);

    const rookMove = allLegalState(parsed.state).find(move =>
      move.from.r === 6 && move.from.c === 0 && move.to.r === 5 && move.to.c === 0
    );
    assert.ok(rookMove, 'the loaded position should have a legal rook move');

    staleWorker.onmessage?.({
      data: {
        id: staleRequest.id,
        result: EngineContract.completed(staleRequest.contractRequest, rookMove)
      }
    });
    assert.equal(sandbox.api.getActiveAIForTest().request.id, resumedWorker.request.id,
      'a stale response must not replace the active request after loading');

    assert.equal(sandbox.api.getState().board[6][0].type, 'r',
      'the stale result must not alter the loaded position');
    assert.equal(sandbox.api.getActiveAIForTest().thinking, true,
      'the fresh search should remain active after the stale reply is ignored');
  } finally {
    sandbox.api.resetAIWorker();
    sandbox.URL.createObjectURL = previousCreateObjectURL;
    sandbox.URL.revokeObjectURL = previousRevokeObjectURL;
    sandbox.Worker = previousWorker;
    sandbox.window.Worker = previousWindowWorker;
    scheduledCallbacks.length = 0;
    scheduledTimeouts.length = 0;
  }
});

test('cancelled worker contract result releases the active AI request without ending the game', () => {
  const previousCreateObjectURL = sandbox.URL.createObjectURL;
  const previousRevokeObjectURL = sandbox.URL.revokeObjectURL;
  const previousWorker = sandbox.Worker;
  const previousWindowWorker = sandbox.window.Worker;
  let workerInstance;

  class CancelledResultWorker {
    constructor(url) {
      this.url = url;
      this.terminated = false;
      this.onmessage = null;
      this.onerror = null;
      workerInstance = this;
    }
    postMessage(request) { this.request = request; }
    terminate() { this.terminated = true; }
  }

  sandbox.api.resetAIWorker();
  sandbox.URL.createObjectURL = () => 'blob:worker-cancelled-result-test';
  sandbox.URL.revokeObjectURL = () => {};
  sandbox.Worker = CancelledResultWorker;
  sandbox.window.Worker = CancelledResultWorker;
  const s = position();
  s.board[6][0] = { type: 'r', color: 'w', moved: false };
  sandbox.api.setState(s);
  const before = JSON.stringify(s);

  try {
    mockElement('modeSelect').value = 'ai';
    configureEngine('white', 'opening', 'minmax_legacy');
    sandbox.api.updateEngineConfigUI();
    sandbox.api.aiMove();

    const request = workerInstance.request;
    assert.ok(request.contractRequest, 'worker should receive a structured engine request');
    workerInstance.onmessage({
      data: { id: request.id, result: EngineContract.cancelled(request.contractRequest) }
    });

    const active = sandbox.api.getActiveAIForTest();
    assert.equal(active.thinking, false, 'cancelled worker result must release the thinking lock');
    assert.equal(active.request, null, 'cancelled worker result must clear the active request');
    assert.equal(sandbox.api.getGameOver(), false, 'cancellation must not end the game');
    assert.equal(JSON.stringify(sandbox.api.getState()), before, 'cancellation must not change the board');
    assert.match(mockElement('status').textContent, /AI search cancelled/);
  } finally {
    sandbox.api.resetAIWorker();
    sandbox.URL.createObjectURL = previousCreateObjectURL;
    sandbox.URL.revokeObjectURL = previousRevokeObjectURL;
    sandbox.Worker = previousWorker;
    sandbox.window.Worker = previousWindowWorker;
    scheduledTimeouts.length = 0;
  }
});


test('cancelled main-thread contract search releases the active AI request', () => {
  const originalEngine = sandbox.api.enginePlugins.get('minmax_legacy');
  const previousWorker = sandbox.Worker;
  const previousWindowWorker = sandbox.window.Worker;
  const cancelledEngine = {
    ...engineMetadata('minmax_legacy'),
    id: 'minmax_legacy',
    name: 'Cancelled search test engine',
    phases: ['opening', 'midgame', 'endgame'],
    search(request) {
      return EngineContract.cancelled(request);
    }
  };
  sandbox.api.resetAIWorker();
  sandbox.Worker = undefined;
  sandbox.window.Worker = undefined;
  sandbox.api.enginePlugins.set('minmax_legacy', cancelledEngine);
  mockElement('modeSelect').value = 'ai_easy';
  const s = position();
  s.board[6][0] = { type: 'r', color: 'w', moved: false };
  sandbox.api.setState(s);
  const callbackIndex = scheduledCallbacks.length;

  try {
    sandbox.api.aiMove();
    assert.equal(scheduledCallbacks.length, callbackIndex + 1, 'main-thread search should be scheduled');
    scheduledCallbacks[callbackIndex]();
    const active = sandbox.api.getActiveAIForTest();
    assert.equal(active.thinking, false, 'cancelled search must not leave the AI locked as thinking');
    assert.equal(active.request, null, 'cancelled search must clear the active request');
    assert.equal(sandbox.api.getGameOver(), false, 'cancellation must not end the game');
    assert.match(mockElement('status').textContent, /AI search cancelled/);
  } finally {
    sandbox.api.enginePlugins.set('minmax_legacy', originalEngine);
    sandbox.api.resetAIWorker();
    sandbox.Worker = previousWorker;
    sandbox.window.Worker = previousWindowWorker;
    scheduledCallbacks.splice(callbackIndex);
  }
});



test('unresponsive worker times out, retries once on the main thread, and ignores its late reply', () => {
  const previousCreateObjectURL = sandbox.URL.createObjectURL;
  const previousRevokeObjectURL = sandbox.URL.revokeObjectURL;
  const previousWorker = sandbox.Worker;
  const previousWindowWorker = sandbox.window.Worker;
  const originalMinMax = sandbox.api.enginePlugins.get('minmax_legacy');
  let workerInstance;
  let fallbackCalls = 0;

  class HangingWorker {
    constructor(url) {
      this.url = url;
      this.terminated = false;
      this.onmessage = null;
      this.onerror = null;
      workerInstance = this;
    }
    postMessage(request) { this.request = request; }
    terminate() { this.terminated = true; }
  }

  sandbox.api.resetAIWorker();
  sandbox.URL.createObjectURL = () => 'blob:worker-timeout-test';
  sandbox.URL.revokeObjectURL = () => {};
  sandbox.Worker = HangingWorker;
  sandbox.window.Worker = HangingWorker;
  sandbox.api.enginePlugins.set('minmax_legacy', {
    ...engineMetadata('minmax_legacy'),
    id: 'minmax_legacy',
    name: 'MinMax timeout fallback probe',
    phases: ['opening', 'midgame', 'endgame'],
    search(request) {
      fallbackCalls++;
      return EngineContract.failed(request, EngineContract.errorCodes.SEARCH_FAILED, 'timeout fallback probe');
    }
  });

  try {
    mockElement('modeSelect').value = 'ai';
    configureEngine('white', 'opening', 'minmax_legacy');
      configureEngine('black', 'opening', 'minmax_legacy');
    sandbox.api.updateEngineConfigUI();
    sandbox.api.setState(position());
    sandbox.api.aiMove();

    const originalRequest = workerInstance.request;
    assert.ok(originalRequest.contractRequest, 'the hanging worker should receive a structured request');
    const timeoutCallback = scheduledTimeouts.findLast(callback => callback.delay === 15000);
    assert.ok(timeoutCallback, 'a worker response watchdog should be scheduled');

    timeoutCallback();
    assert.equal(workerInstance.terminated, true, 'the unresponsive worker should be terminated');
    assert.match(mockElement('status').textContent, /retrying on the main thread/i);
    assert.equal(fallbackCalls, 0, 'fallback should wait for its scheduled callback');

    const retryRequest = sandbox.api.getActiveAIForTest().request;
    assert.notEqual(retryRequest.id, originalRequest.id, 'fallback must receive a fresh request ID');
    assert.equal(retryRequest.contractRequest.requestId, retryRequest.id,
      'contract request identity must match the fallback attempt');
    assert.equal(retryRequest.contractRequest.generation, retryRequest.id,
      'fallback must use a fresh generation');
    assert.equal(JSON.stringify(retryRequest.contractRequest.position), JSON.stringify(sandbox.api.getState()),
      'fallback must use a fresh snapshot of the current position');

    workerInstance.onmessage({
      data: {
        id: originalRequest.id,
        result: EngineContract.completed(originalRequest.contractRequest, allLegalState(position())[0])
      }
    });
    assert.equal(fallbackCalls, 0, 'a late response from the timed-out worker must be ignored');

    const fallbackCallback = scheduledCallbacks.findLast(callback => callback.delay === 20);
    assert.ok(fallbackCallback, 'the main-thread retry should be scheduled');
    fallbackCallback();
    assert.equal(fallbackCalls, 1, 'the selected engine should be retried exactly once');
    assert.equal(sandbox.api.getActiveAIForTest().thinking, false);
    assert.equal(sandbox.api.getActiveAIForTest().request, null);
    assert.match(mockElement('status').textContent, /timeout fallback probe/);
  } finally {
    sandbox.api.enginePlugins.set('minmax_legacy', originalMinMax);
    sandbox.api.resetAIWorker();
    sandbox.URL.createObjectURL = previousCreateObjectURL;
    sandbox.URL.revokeObjectURL = previousRevokeObjectURL;
    sandbox.Worker = previousWorker;
    sandbox.window.Worker = previousWindowWorker;
    scheduledCallbacks.length = 0;
    scheduledTimeouts.length = 0;
  }
});

test('worker runtime errors retry the selected engine on the main thread', () => {
  const previousCreateObjectURL = sandbox.URL.createObjectURL;
  const previousRevokeObjectURL = sandbox.URL.revokeObjectURL;
  const previousWorker = sandbox.Worker;
  const previousWindowWorker = sandbox.window.Worker;
  const originalMinMax = sandbox.api.enginePlugins.get('minmax_legacy');
  let workerInstance;
  let calls = 0;
  let receivedState;
  let receivedSide;

  class FailingWorker {
    constructor(url) {
      this.url = url;
      this.terminated = false;
      workerInstance = this;
    }
    postMessage(request) { this.request = request; }
    terminate() { this.terminated = true; }
  }

  sandbox.api.resetAIWorker();
  sandbox.URL.createObjectURL = () => 'blob:worker-test';
  sandbox.URL.revokeObjectURL = () => {};
  sandbox.Worker = FailingWorker;
  sandbox.window.Worker = FailingWorker;
  sandbox.api.enginePlugins.set('minmax_legacy', {
    ...engineMetadata('minmax_legacy'),
    name: 'MinMax runtime fallback probe',
    phases: ['opening', 'midgame', 'endgame'],
    getMove(gameState, side) {
      calls++;
      receivedState = gameState;
      receivedSide = side;
      return null;
    }
  });

  try {
    const s = position();
    s.board[6][0] = { type: 'r', color: 'w', moved: false };
    sandbox.api.setState(s);

    sandbox.api.aiMove();
    assert.ok(workerInstance, 'AI should create a worker');
    assert.equal(calls, 0, 'engine should initially be dispatched to the worker');
    const failedWorker = workerInstance;
    const failedRequestId = failedWorker.request.id;

    failedWorker.onerror({ message: 'simulated worker runtime failure' });
    assert.equal(failedWorker.terminated, true, 'failed worker should be terminated');
    assert.match(sandbox.document.getElementById('status').textContent, /retrying on the main thread/i);
    assert.equal(scheduledCallbacks.length, 1, 'runtime failure should schedule one fallback attempt');

    scheduledCallbacks.shift()();
    assert.equal(calls, 1, 'selected engine should be retried exactly once');
    assert.equal(receivedSide, 'w');
    assert.notEqual(receivedState, s, 'fallback engine should receive a cloned position');
    assert.equal(JSON.stringify(receivedState), JSON.stringify(s), 'fallback clone should preserve the position');
    assert.ok(failedRequestId > 0, 'worker request should have a valid identifier');

    // The fallback deliberately returns null and ends the game; start a fresh test position
    // before checking that a later request creates a replacement worker.
    sandbox.api.resetAIWorker();
    sandbox.api.setState(position());
    sandbox.api.aiMove();
    const replacementWorker = workerInstance;
    assert.notEqual(replacementWorker, failedWorker, 'a later request should create a fresh worker');
    failedWorker.onerror({ message: 'late stale worker error' });
    assert.equal(replacementWorker.terminated, false, 'a stale error must not terminate the replacement worker');
    assert.equal(scheduledCallbacks.length, 0, 'a stale error must not trigger another fallback');
  } finally {
    sandbox.api.enginePlugins.set('minmax_legacy', originalMinMax);
    sandbox.api.resetAIWorker();
    sandbox.URL.createObjectURL = previousCreateObjectURL;
    sandbox.URL.revokeObjectURL = previousRevokeObjectURL;
    sandbox.Worker = previousWorker;
    sandbox.window.Worker = previousWindowWorker;
    scheduledCallbacks.length = 0;
  }
});


test('late worker result after a crash cannot bypass or duplicate the scheduled main-thread fallback', () => {
  const previousCreateObjectURL = sandbox.URL.createObjectURL;
  const previousRevokeObjectURL = sandbox.URL.revokeObjectURL;
  const previousWorker = sandbox.Worker;
  const previousWindowWorker = sandbox.window.Worker;
  const originalMinMax = sandbox.api.enginePlugins.get('minmax_legacy');
  let workerInstance;
  let calls = 0;

  class CrashingWorker {
    constructor(url) {
      this.url = url;
      this.terminated = false;
      this.onmessage = null;
      this.onerror = null;
      workerInstance = this;
    }
    postMessage(request) { this.request = request; }
    terminate() { this.terminated = true; }
  }

  sandbox.api.resetAIWorker();
  sandbox.URL.createObjectURL = () => 'blob:worker-crash-late-result-test';
  sandbox.URL.revokeObjectURL = () => {};
  sandbox.Worker = CrashingWorker;
  sandbox.window.Worker = CrashingWorker;
  sandbox.api.enginePlugins.set('minmax_legacy', {
    ...engineMetadata('minmax_legacy'),
    id: 'minmax_legacy',
    name: 'MinMax crash fallback probe',
    phases: ['opening', 'midgame', 'endgame'],
    search(request) {
      calls++;
      return EngineContract.failed(request, EngineContract.errorCodes.SEARCH_FAILED, 'fallback probe');
    }
  });

  try {
    mockElement('modeSelect').value = 'ai_vs_ai';
    configureEngine('white', 'opening', 'minmax_legacy');
      configureEngine('black', 'opening', 'minmax_legacy');
    sandbox.api.updateEngineConfigUI();
    const s = position();
    s.board[6][0] = { type: 'r', color: 'w', moved: false };
    sandbox.api.setState(s);
    const stateBeforeFailure = JSON.stringify(s);

    sandbox.api.aiMove();
    const failedWorker = workerInstance;
    assert.ok(failedWorker?.request?.contractRequest, 'AI should dispatch a contract request to the worker');
    const originalRequest = failedWorker.request;
    const originalContractRequest = originalRequest.contractRequest;
    const lateLegalMove = allLegalState(s)[0];

    failedWorker.onerror({ message: 'simulated crash before result' });
    assert.equal(failedWorker.terminated, true);
    assert.equal(calls, 0, 'fallback must remain scheduled until its callback runs');
    assert.equal(scheduledCallbacks.length, 1, 'the crash should schedule exactly one fallback');

    failedWorker.onmessage({
      data: {
        id: originalRequest.id,
        result: EngineContract.completed(originalContractRequest, lateLegalMove)
      }
    });

    assert.equal(JSON.stringify(sandbox.api.getState()), stateBeforeFailure,
      'a late result from the crashed worker must not apply its move');
    assert.equal(calls, 0, 'a late result must not run or replace the fallback');
    assert.equal(scheduledCallbacks.length, 1, 'a late result must not schedule a second fallback');

    scheduledCallbacks.shift()();
    assert.equal(calls, 1, 'the selected engine should run exactly once on the main thread');
    assert.equal(scheduledCallbacks.length, 0, 'no duplicate fallback should remain scheduled');
  } finally {
    sandbox.api.enginePlugins.set('minmax_legacy', originalMinMax);
    sandbox.api.resetAIWorker();
    sandbox.URL.createObjectURL = previousCreateObjectURL;
    sandbox.URL.revokeObjectURL = previousRevokeObjectURL;
    sandbox.Worker = previousWorker;
    sandbox.window.Worker = previousWindowWorker;
    scheduledCallbacks.length = 0;
  }
});


test('main-thread fallback rejects unsupported contract result statuses without ending the game', () => {
  const previousCreateObjectURL = sandbox.URL.createObjectURL;
  const originalMinMax = sandbox.api.enginePlugins.get('minmax_legacy');
  sandbox.api.resetAIWorker();
  sandbox.URL.createObjectURL = () => { throw new Error('Blob workers blocked by test'); };
  sandbox.api.enginePlugins.set('minmax_legacy', {
    ...engineMetadata('minmax_legacy'),
    id: 'minmax_legacy',
    name: 'MinMax unsupported status probe',
    phases: ['opening', 'midgame', 'endgame'],
    search(request) {
      return {
        ...EngineContract.completed(request, null),
        status: 'unknown-status'
      };
    }
  });

  try {
    const s = position();
    s.board[6][0] = { type: 'r', color: 'w', moved: false };
    sandbox.api.setState(s);
    sandbox.api.aiMove();
    assert.equal(scheduledCallbacks.length, 1, 'fallback search should be scheduled');
    scheduledCallbacks.shift()();

    assert.equal(sandbox.api.getGameOver(), false, 'an unsupported status must not be treated as no legal moves');
    const active = sandbox.api.getActiveAIForTest();
    assert.equal(active.thinking, false, 'failed result should release the thinking state');
    assert.equal(active.request, null, 'failed result should clear the active request');
    assert.match(mockElement('status').textContent, /unsupported result status/i);
  } finally {
    sandbox.api.enginePlugins.set('minmax_legacy', originalMinMax);
    sandbox.api.resetAIWorker();
    sandbox.URL.createObjectURL = previousCreateObjectURL;
    scheduledCallbacks.length = 0;
  }
});


test('main-thread fallback calls the selected engine when Blob workers are blocked', () => {
  const previousCreateObjectURL = sandbox.URL.createObjectURL;
  const originalMinMax = sandbox.api.enginePlugins.get('minmax_legacy');
  let calls = 0;
  let receivedState;
  let receivedSide;

  sandbox.api.resetAIWorker();
  sandbox.URL.createObjectURL = () => { throw new Error('Blob workers blocked by test'); };
  sandbox.api.enginePlugins.set('minmax_legacy', {
    ...engineMetadata('minmax_legacy'),
    name: 'MinMax construction fallback probe',
    phases: ['opening', 'midgame', 'endgame'],
    getMove(gameState, side) {
      calls++;
      receivedState = gameState;
      receivedSide = side;
      return null;
    }
  });

  try {
    const s = position();
    s.board[6][0] = { type: 'r', color: 'w', moved: false };
    sandbox.api.setState(s);

    sandbox.api.aiMove();
    assert.equal(scheduledCallbacks.length, 1, 'AI move should be scheduled on the main thread');
    scheduledCallbacks.shift()();

    assert.equal(calls, 1, 'selected plugin getMove should be called exactly once');
    assert.equal(receivedSide, 'w');
    assert.notEqual(receivedState, s, 'the engine should receive a cloned state');
    assert.equal(JSON.stringify(receivedState), JSON.stringify(s), 'the cloned state should preserve the position');
  } finally {
    sandbox.api.enginePlugins.set('minmax_legacy', originalMinMax);
    sandbox.api.resetAIWorker();
    sandbox.URL.createObjectURL = previousCreateObjectURL;
    scheduledCallbacks.length = 0;
  }
});


test('undo and redo restore complete move-log snapshots, including extra moat notices', () => {
  const before = position();
  const after = position();
  after.turn = 'b';
  after.moats.w = { r: 4, c: 2 };
  after.moatDestroyed.w = true;
  const expectedLog = ['💥 MOAT DESTROYED: White moat has been destroyed!', '1. White: Rook A2-A3 (05:00)'];
  setHistoryForTest([before, after], [[], expectedLog]);

  assert.equal(undoHistoryStep(), true);
  assert.equal(getState().turn, 'w');
  assert.equal(JSON.stringify(getMoveLog()), JSON.stringify([]));
  assert.equal(redoHistoryStep(), true);
  assert.equal(JSON.stringify(getState()), JSON.stringify(after));
  assert.equal(JSON.stringify(getMoveLog()), JSON.stringify(expectedLog));
  assert.equal(JSON.stringify(getHistoryMoveLogs()), JSON.stringify([[], expectedLog]));
});

test('history snapshots preserve the next moat-placement phase and turn', () => {
  const before = position();
  const after = position();
  after.moats.w = { r: 4, c: 2 };
  after.hasPlacedMoat.w = true;
  after.phase = 'place_moat_b';
  after.turn = 'b';
  setHistoryForTest([before, after], [[], ['1. White: Moat C4-E4 (05:00)']]);

  assert.equal(undoHistoryStep(), true);
  assert.equal(getState().phase, 'normal');
  assert.equal(getState().turn, 'w');
  assert.equal(redoHistoryStep(), true);
  assert.equal(getState().phase, 'place_moat_b');
  assert.equal(getState().turn, 'b');
  assert.equal(JSON.stringify(getState().moats.w), JSON.stringify({ r: 4, c: 2 }));
});

test('redo restores terminal-game status after undoing a finished game', () => {
  const before = position();
  const terminal = position();
  terminal.turn = 'b';
  terminal.ply = 13;
  sandbox.document.getElementById('status').textContent = 'Checkmate! Black wins.';
  setHistoryForTest([before, terminal], [[], ['1. White: checkmate']], true);

  assert.equal(undoHistoryStep(), true);
  assert.equal(getGameOver(), false);
  assert.equal(redoHistoryStep(), true);
  assert.equal(getGameOver(), true);
  assert.equal(sandbox.document.getElementById('status').textContent, 'Checkmate! Black wins.');
  assert.equal(getState().turn, 'b');
});

test('export/import roundtrip preserves current state, history, logs, and terminal status', () => {
  const before = position();
  before.clocks = { w: 275, b: 301 };
  const current = position();
  current.turn = 'b';
  current.phase = 'place_moat_b';
  current.moats.w = { r: 4, c: 2 };
  current.hasPlacedMoat.w = true;
  current.clocks = { w: 260, b: 299 };
  const logs = [[], ['1. White: Rook A2-A3 (04:35)', '💥 MOAT DESTROYED: Black moat has been destroyed!']];
  sandbox.document.getElementById('status').textContent = 'Draw by stalemate.';
  setHistoryForTest([before, current], logs, true);
  const exported = JSON.parse(JSON.stringify(exportGameData()));
  const imported = parseGameData(JSON.stringify(exported), 600);

  assert.equal(JSON.stringify(imported.state), JSON.stringify(current));
  assert.equal(JSON.stringify(imported.history), JSON.stringify([before, current]));
  assert.equal(JSON.stringify(imported.moveLog), JSON.stringify(logs[1]));
  assert.equal(JSON.stringify(imported.historyMoveLogs), JSON.stringify(logs));
  assert.equal(imported.gameOver, true);
  assert.equal(imported.gameOverMessage, 'Draw by stalemate.');
  assert.equal(imported.playerColor, 'w');
});

test('save import rejects malformed boards, invalid pieces, and mismatched history logs', () => {
  const state = position();
  const base = { state, history: [state], moveLog: [], historyMoveLogs: [[]] };
  const badBoard = JSON.parse(JSON.stringify(base));
  badBoard.state.board.pop();
  assert.throws(() => parseGameData(badBoard), /board dimensions/i);

  const badPiece = JSON.parse(JSON.stringify(base));
  badPiece.state.board[4][4] = { type: 'dragon', color: 'w', moved: false };
  assert.throws(() => parseGameData(badPiece), /invalid piece/i);

  const badLogs = JSON.parse(JSON.stringify(base));
  badLogs.historyMoveLogs = [];
  assert.throws(() => parseGameData(badLogs), /history log snapshots/i);
});

test('save import rejects a current position that differs from the latest history snapshot', () => {
  const state = position();
  const latest = position();
  latest.turn = 'b';
  const save = { state, history: [latest], moveLog: [], historyMoveLogs: [[]] };
  assert.throws(() => parseGameData(save), /current state does not match the latest history snapshot/i);
});

test('save import rejects a current move log that differs from its latest history log snapshot', () => {
  const state = position();
  const save = { state, history: [state], moveLog: ['current log'], historyMoveLogs: [['different history log']] };
  assert.throws(() => parseGameData(save), /current move log does not match/i);
});

test('save import rejects invalid provided phase, clocks, and coordinates instead of silently defaulting', () => {
  const base = () => ({ state: position(), history: [position()], moveLog: [], historyMoveLogs: [[]] });
  const badPhase = base(); badPhase.state.phase = ''; badPhase.history[0].phase = '';
  assert.throws(() => parseGameData(badPhase), /invalid game phase/i);
  const badClock = base(); badClock.state.clocks.w = -1; badClock.history[0].clocks.w = -1;
  assert.throws(() => parseGameData(badClock), /invalid clocks/i);
  const badMoat = base(); badMoat.state.moats.w = { r: 4, c: 8 }; badMoat.history[0].moats.w = { r: 4, c: 8 };
  assert.throws(() => parseGameData(badMoat), /invalid moat coordinates/i);
  const badEp = base(); badEp.state.ep = { r: 8, c: 0 }; badEp.history[0].ep = { r: 8, c: 0 };
  assert.throws(() => parseGameData(badEp), /invalid en passant target/i);
});

test('legacy saves may omit optional state fields, but supplied invalid values are rejected', () => {
  const state = position();
  for (const field of ['variant','setupId','phase','ply','ep','moats','moatDestroyed','hasPlacedMoat','moveCounts','captured','halfmoveClock','positionHistory','clocks']) delete state[field];
  const legacy = { state, history: [state], moveLog: ['legacy log'] };
  const imported = parseGameData(legacy, 180);
  assert.equal(imported.state.phase, 'normal');
  assert.equal(imported.state.ply, 0);
  assert.equal(imported.state.clocks.w, 180);
  assert.deepEqual(JSON.parse(JSON.stringify(imported.state.variant)), { id: 'jester-moat', version: 1 });
  assert.equal(imported.state.setupId, null, 'legacy saves have no reliable record of the selected starting setup');
  assert.equal(JSON.stringify(imported.historyMoveLogs), JSON.stringify([['legacy log']]));
});

test('new games receive explicit variant and setup identity', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(sandbox.api.createGameIdentity('edges'))), {
    variant: { id: 'jester-moat', version: 1 }, setupId: 'edges'
  });
  assert.deepEqual(JSON.parse(JSON.stringify(sandbox.api.createGameIdentity('center'))), {
    variant: { id: 'jester-moat', version: 1 }, setupId: 'center'
  });
  assert.equal(sandbox.api.createGameIdentity('unknown').setupId, null);
});

test('variant identity and setup ID survive save/load roundtrips', () => {
  const state = position();
  Object.assign(state, sandbox.api.createGameIdentity('center'));
  const imported = parseGameData({ state, history: [state], moveLog: [], historyMoveLogs: [[]] });
  assert.deepEqual(JSON.parse(JSON.stringify(imported.state.variant)), { id: 'jester-moat', version: 1 });
  assert.equal(imported.state.setupId, 'center');
  assert.equal(imported.history[0].setupId, 'center');
});

test('save import rejects unsupported variant identities and setup IDs', () => {
  const unsupportedVariant = position();
  unsupportedVariant.variant = { id: 'other-game', version: 1 };
  assert.throws(() => parseGameData({
    state: unsupportedVariant, history: [unsupportedVariant], moveLog: [], historyMoveLogs: [[]]
  }), /unsupported game variant/i);

  const unsupportedSetup = position();
  unsupportedSetup.setupId = 'unknown-setup';
  assert.throws(() => parseGameData({
    state: unsupportedSetup, history: [unsupportedSetup], moveLog: [], historyMoveLogs: [[]]
  }), /invalid game setup id/i);
});


test('save import normalizes the latest history clocks to the current saved clocks', () => {
  const state = position(); state.clocks = { w: 240, b: 300 };
  const latest = position(); latest.clocks = { w: 260, b: 300 };
  const imported = parseGameData({ state, history: [latest], moveLog: [], historyMoveLogs: [[]] });
  assert.equal(JSON.stringify(imported.history[0].clocks), JSON.stringify(state.clocks));
});

test('legacy save files without history log snapshots remain importable', () => {
  const state = position();
  const legacy = { state, history: [state], moveLog: ['1. White: custom position'] };
  const imported = parseGameData(legacy);
  assert.equal(JSON.stringify(imported.moveLog), JSON.stringify(legacy.moveLog));
  assert.equal(JSON.stringify(imported.historyMoveLogs), JSON.stringify([legacy.moveLog]));
});


test('engine contract creates an isolated immutable request snapshot', () => {
  const s = position();
  Object.assign(s, sandbox.api.createGameIdentity('center'));
  s.board[6][0] = { type: 'r', color: 'w', moved: false };
  const request = sandbox.api.EngineContract.createRequest({
    requestId: 'contract-1', generation: 7, engineId: 'minmax_legacy',
    position: s, limits: { depth: 1 }, config: { profile: 'test' }
  });
  s.board[6][0].type = 'q';
  assert.equal(request.protocolVersion, 1);
  assert.equal(request.position.board[6][0].type, 'r');
  assert.deepEqual(JSON.parse(JSON.stringify(request.position.variant)), { id: 'jester-moat', version: 1 });
  assert.equal(request.position.setupId, 'center');
  assert.equal(Object.isFrozen(request), true);
  assert.equal(Object.isFrozen(request.position.board[6][0]), true);
  assert.equal(Object.isFrozen(request.limits), true);
});

test('engine contract validates request identity, snapshot shape, and limits', () => {
  const contract = sandbox.api.EngineContract;
  assert.throws(() => contract.createRequest({ generation: 1, engineId: 'minmax_legacy', position: position() }),
    error => error.code === contract.errorCodes.INVALID_REQUEST);
  assert.throws(() => contract.createRequest({ requestId: 1, generation: 1, engineId: 'minmax_legacy',
    position: { board: [], turn: 'w' } }), error => error.code === contract.errorCodes.INVALID_POSITION);
  assert.throws(() => contract.createRequest({ requestId: 1, generation: 1, engineId: 'minmax_legacy',
    position: position(), limits: { depth: 0 } }), error => error.code === contract.errorCodes.INVALID_CONFIG);
  assert.throws(() => contract.createRequest({ requestId: 1, generation: 1, engineId: 'minmax_legacy',
    position: position(), limits: { timeMs: -1 } }), error => error.code === contract.errorCodes.INVALID_CONFIG);
});

test('engine contract accepts boundary search limits and rejects invalid depth and time budgets', () => {
  const contract = sandbox.api.EngineContract;
  const base = { requestId: 'limit-boundary', generation: 1, engineId: 'minmax_legacy', position: position() };

  for (const depth of [1, 10]) {
    const request = contract.createRequest({ ...base, limits: { depth } });
    assert.equal(request.limits.depth, depth);
    assert.equal(request.limits.timeMs, null);
  }

  const timed = contract.createRequest({ ...base, requestId: 'timed-boundary', limits: { depth: 2, timeMs: 0.1 } });
  assert.equal(timed.limits.timeMs, 0.1);

  for (const depth of [0, -1, 1.5, 11, NaN, Infinity]) {
    assert.throws(
      () => contract.createRequest({ ...base, requestId: `invalid-depth-${String(depth)}`, limits: { depth } }),
      error => error.code === contract.errorCodes.INVALID_CONFIG,
      `depth ${String(depth)} should be rejected`
    );
  }

  for (const timeMs of [0, -1, NaN, Infinity, -Infinity]) {
    assert.throws(
      () => contract.createRequest({ ...base, requestId: `invalid-time-${String(timeMs)}`, limits: { timeMs } }),
      error => error.code === contract.errorCodes.INVALID_CONFIG,
      `timeMs ${String(timeMs)} should be rejected`
    );
  }
});

test('engine contract preserves variant move flags and rejects malformed coordinates', () => {
  const contract = sandbox.api.EngineContract;
  const swap = { from: { r: 4, c: 4 }, to: { r: 4, c: 5 }, swap: true };
  const request = contract.createRequest({ requestId: 2, generation: 3, engineId: 'minmax_legacy', position: position() });
  const result = contract.completed(request, swap);
  assert.equal(result.status, contract.statuses.COMPLETED);
  assert.deepEqual(JSON.parse(JSON.stringify(result.move)), swap);
  assert.equal(contract.validateMove({ from: { r: -1, c: 0 }, to: { r: 0, c: 0 } }), false);
  assert.equal(contract.validateMove({ from: { r: 0, c: 0 }, to: { r: 8, c: 0 } }), false);
  assert.equal(contract.completed(request, { from: { r: 0, c: 0 }, to: null }).error.code,
    contract.errorCodes.INVALID_MOVE);
});

test('MinMax implements only the structured search entry point without mutating its snapshot', () => {
  assert.equal(typeof sandbox.api.MinMaxLegacy.getMove, 'undefined', 'MinMax must not expose the legacy UI-coupled entry point');
  const s = position();
  s.board[6][0] = { type: 'r', color: 'w', moved: false };
  const before = JSON.stringify(s);
  const request = sandbox.api.EngineContract.createRequest({
    requestId: 'minmax-contract', generation: 1, engineId: 'minmax_legacy',
    position: s, limits: { depth: 1 }
  });
  const result = sandbox.api.MinMaxLegacy.search(request);
  assert.equal(result.status, sandbox.api.EngineContract.statuses.COMPLETED);
  assert.equal(sandbox.api.EngineContract.matchesRequest(result, request), true);
  assert.ok(allLegalState(s).some(m => JSON.stringify(m) === JSON.stringify(result.move)));
  assert.equal(JSON.stringify(s), before);
});

test('engine contract distinguishes no-move, cancellation, failure, and stale results', () => {
  const contract = sandbox.api.EngineContract;
  const request = contract.createRequest({ requestId: 8, generation: 9, engineId: 'minmax_legacy', position: position() });
  const result = contract.completed(request, null);
  assert.equal(result.status, contract.statuses.NO_MOVE);
  assert.equal(contract.cancelled(request).status, contract.statuses.CANCELLED);
  assert.equal(contract.failed(request, contract.errorCodes.SEARCH_FAILED, 'test').status, contract.statuses.FAILED);
  assert.equal(contract.matchesRequest(result, request), true);

  const mismatchedRequestFields = [
    ['protocolVersion', contract.version + 1],
    ['engineId', 'mcts'],
    ['requestId', 99],
    ['generation', 10]
  ];
  for (const [field, value] of mismatchedRequestFields) {
    assert.equal(contract.matchesRequest(result, { ...request, [field]: value }), false,
      `request with mismatched ${field} must be rejected`);
    assert.equal(contract.matchesRequest({ ...result, [field]: value }, request), false,
      `result with mismatched ${field} must be rejected`);
  }
});


test('lifecycle cancellation terminates the worker and invalidates the active request', () => {
  let terminated = 0;
  const worker = { terminate() { terminated++; } };
  const request = { id: 123 };
  sandbox.api.setActiveAIForTest(worker, request);
  const before = sandbox.api.getActiveAIForTest().id;
  sandbox.api.cancelActiveAIRequest('test-reset');
  const after = sandbox.api.getActiveAIForTest();
  assert.equal(terminated, 1);
  assert.equal(after.worker, null);
  assert.equal(after.request, null);
  assert.equal(after.thinking, false);
  assert.equal(after.id, before + 1);
});

test('late worker replies after cancellation cannot affect the current game or replacement search', () => {
  const previousCreateObjectURL = sandbox.URL.createObjectURL;
  const previousRevokeObjectURL = sandbox.URL.revokeObjectURL;
  const previousWorker = sandbox.Worker;
  const previousWindowWorker = sandbox.window.Worker;
  const workers = [];

  class DelayedWorker {
    constructor(url) {
      this.url = url;
      this.terminated = false;
      this.onmessage = null;
      this.onerror = null;
      this.request = null;
      workers.push(this);
    }
    postMessage(request) { this.request = request; }
    terminate() { this.terminated = true; }
  }

  sandbox.api.resetAIWorker();
  sandbox.URL.createObjectURL = () => 'blob:delayed-worker-test';
  sandbox.URL.revokeObjectURL = () => {};
  sandbox.Worker = DelayedWorker;
  sandbox.window.Worker = DelayedWorker;

  try {
    const originalState = position();
    originalState.board[6][0] = { type: 'r', color: 'w', moved: false };
    sandbox.api.setState(originalState);
    sandbox.api.aiMove();

    const cancelledWorker = workers[0];
    assert.ok(cancelledWorker, 'AI should start a worker search');
    assert.ok(cancelledWorker.request.contractRequest, 'worker search should use the structured engine contract');
    const cancelledRequest = cancelledWorker.request.contractRequest;
    const oldRequestId = cancelledWorker.request.id;

    sandbox.api.cancelActiveAIRequest('test-undo');
    assert.equal(cancelledWorker.terminated, false, 'cancellation should allow the worker to acknowledge cooperatively');
    const cancellation = cancelledWorker.request.cancellation;
    assert.ok(cancellation, 'cancellation should be sent using the shared contract envelope');
    cancelledWorker.onmessage({ data: { id: oldRequestId, cancellationAck: EngineContract.createCancellationAcknowledgment(cancellation, 'cancelled') } });
    assert.equal(cancelledWorker.terminated, true, 'the worker should terminate after acknowledging cancellation');

    const currentState = position();
    currentState.board[6][1] = { type: 'r', color: 'w', moved: false };
    sandbox.api.setState(currentState);
    const currentStateSnapshot = JSON.stringify(currentState);
    sandbox.api.aiMove();

    const replacementWorker = workers[1];
    assert.ok(replacementWorker, 'a new search should create a replacement worker');
    assert.notEqual(replacementWorker, cancelledWorker);
    assert.ok(replacementWorker.request.id > oldRequestId);

    const legalMove = allLegalState(originalState)[0];
    cancelledWorker.onmessage({
      data: {
        id: oldRequestId,
        result: sandbox.api.EngineContract.completed(cancelledRequest, legalMove)
      }
    });

    assert.equal(JSON.stringify(sandbox.api.getState()), currentStateSnapshot,
      'a late reply must not apply a move to the new position');
    const active = sandbox.api.getActiveAIForTest();
    assert.equal(active.worker, replacementWorker, 'a stale reply must not replace the active worker');
    assert.equal(active.request.id, replacementWorker.request.id,
      'a stale reply must not clear the replacement search');
    assert.equal(active.thinking, true, 'the replacement search should remain active');
  } finally {
    sandbox.api.resetAIWorker();
    sandbox.URL.createObjectURL = previousCreateObjectURL;
    sandbox.URL.revokeObjectURL = previousRevokeObjectURL;
    sandbox.Worker = previousWorker;
    sandbox.window.Worker = previousWindowWorker;
  }
});

test('engine selection resolves the configured engine independently for each side and phase', () => {
  configureEngine('white', 'midgame', 'mcts');
      configureEngine('black', 'endgame', 'mcts');
  sandbox.api.updateEngineConfigUI();

  const midgame = position();
  midgame.ply = 10;
  midgame.board = Array.from({ length: 8 }, () => Array(10).fill(null));
  for (let i = 0; i < 20; i++) {
    midgame.board[Math.floor(i / 10)][i % 10] = {
      type: 'p', color: i % 2 ? 'b' : 'w', moved: true
    };
  }
  setState(midgame);
  assert.equal(sandbox.api.getEngineForSide('w').id, 'mcts', 'White should use MCTS in its configured midgame phase');
  assert.equal(sandbox.api.getEngineForSide('b').id, 'minmax_legacy', 'Black should retain MinMax outside its configured endgame phase');

  const endgame = position();
  endgame.ply = 10;
  endgame.board = Array.from({ length: 8 }, () => Array(10).fill(null));
  for (let i = 0; i < 16; i++) {
    endgame.board[Math.floor(i / 10)][i % 10] = {
      type: 'p', color: i % 2 ? 'b' : 'w', moved: true
    };
  }
  setState(endgame);
  assert.equal(sandbox.api.getEngineForSide('w').id, 'minmax_legacy', 'White should retain MinMax outside its configured midgame phase');
  assert.equal(sandbox.api.getEngineForSide('b').id, 'mcts', 'Black should use MCTS in its configured endgame phase');
});


test('engine contract result builders preserve complete request identity for every status', () => {
  const contract = EngineContract;
  const request = contract.createRequest({
    requestId: 'status-identity',
    generation: 17,
    engineId: 'minmax_legacy',
    position: position(),
    limits: { depth: 1 }
  });

  const results = [
    contract.completed(request, null),
    contract.cancelled(request),
    contract.failed(request, contract.errorCodes.SEARCH_FAILED, 'test failure')
  ];

  for (const result of results) {
    assert.equal(result.protocolVersion, request.protocolVersion);
    assert.equal(result.engineId, request.engineId);
    assert.equal(result.requestId, request.requestId);
    assert.equal(result.generation, request.generation);
    assert.equal(contract.matchesRequest(result, request), true);
  }
});


test('engine contract rejects each individual response identity mismatch', () => {
  const contract = EngineContract;
  const request = contract.createRequest({
    requestId: 'identity-mismatch-base',
    generation: 23,
    engineId: 'minmax_legacy',
    position: position(),
    limits: { depth: 1 }
  });
  const valid = contract.completed(request, null);
  assert.equal(contract.matchesRequest(valid, request), true);

  const mismatches = [
    { ...valid, protocolVersion: contract.version + 1 },
    { ...valid, engineId: 'mcts' },
    { ...valid, requestId: 'other-request' },
    { ...valid, generation: request.generation + 1 }
  ];

  for (const result of mismatches) {
    assert.equal(contract.matchesRequest(result, request), false,
      `should reject mismatched identity: ${JSON.stringify(result)}`);
  }
});


test('structured main-thread fallback dispatches the selected MinMax and MCTS contracts', () => {
  const previousCreateObjectURL = sandbox.URL.createObjectURL;
  const originalEngines = new Map([
    ['minmax_legacy', sandbox.api.enginePlugins.get('minmax_legacy')],
    ['mcts', sandbox.api.enginePlugins.get('mcts')]
  ]);
  const calls = [];
  const move = { from: { r: 6, c: 0 }, to: { r: 5, c: 0 } };

  sandbox.api.resetAIWorker();
  sandbox.URL.createObjectURL = () => { throw new Error('Blob workers blocked by test'); };

  try {
    for (const engineId of ['minmax_legacy', 'mcts']) {
      sandbox.api.resetAIWorker();
      const engine = {
        ...engineMetadata(engineId),
        id: engineId,
        name: engineId === 'mcts' ? 'MCTS structured fallback probe' : 'MinMax structured fallback probe',
        phases: ['opening', 'midgame', 'endgame'],
        search(request) {
          calls.push({ engineId, request });
          return EngineContract.completed(request, move);
        }
      };
      sandbox.api.enginePlugins.set(engineId, engine);
      mockElement('modeSelect').value = 'ai_vs_ai';
      configureEngine('white', 'opening', engineId);
      configureEngine('black', 'opening', 'minmax_legacy');
      // Mirror the browser select-change handler so the per-phase engine overrides update.
      

      const s = position();
      s.board[6][0] = { type: 'r', color: 'w', moved: false };
      sandbox.api.setState(s);
      // The selected engine is applied to one phase only; match the current position's phase.
      configureEngine('white', sandbox.api.getGamePhase(s), engineId);
      sandbox.api.aiMove();

      assert.equal(scheduledCallbacks.length, 1, 'main-thread fallback should be scheduled');
      scheduledCallbacks.shift()();

      const call = calls[calls.length - 1];
      assert.equal(call.engineId, engineId, 'fallback should call the selected engine');
      assert.equal(call.request.engineId, engineId);
      assert.equal(call.request.requestId, call.request.generation);
      assert.notEqual(call.request.position, s, 'the contract should receive an isolated position snapshot');
      assert.equal(sandbox.api.getState().board[5][0].type, 'r', 'the legal fallback move should be applied');
      assert.equal(sandbox.api.getState().turn, 'b');
      assert.equal(sandbox.api.getActiveAIForTest().thinking, false);
      assert.equal(sandbox.api.getActiveAIForTest().request, null);
    }
    assert.equal(calls.length, 2, 'each engine should be called exactly once');
  } finally {
    for (const [engineId, engine] of originalEngines) sandbox.api.enginePlugins.set(engineId, engine);
    sandbox.api.resetAIWorker();
    sandbox.URL.createObjectURL = previousCreateObjectURL;
    scheduledCallbacks.length = 0;
  }
});


test('synchronous MCTS search respects its time budget between playouts', () => {
  const originalDate = sandbox.Date;
  const originalMath = sandbox.Math;
  let clock = 0;
  let randomCalls = 0;
  sandbox.Date = { now() { clock += 1; return clock; } };
  sandbox.Math = Object.create(Math);
  sandbox.Math.random = () => { randomCalls++; return 0.5; };

  try {
    const s = position();
    s.board[6][0] = { type: 'r', color: 'w', moved: false };
    const before = JSON.stringify(s);
    const move = sandbox.mctsSearch(s, {
      playouts: 100, capDepth: 1, temperature: 0, timeBudgetMs: 1
    });
    assert.ok(move, 'a best-so-far legal move should be returned');
    assert.ok(allLegalState(s).some(m => JSON.stringify(m) === JSON.stringify(move)));
    assert.ok(randomCalls < 100, 'search should stop instead of completing every configured playout');
    assert.equal(JSON.stringify(s), before, 'budgeted search must not mutate the input position');
  } finally {
    sandbox.Date = originalDate;
    sandbox.Math = originalMath;
  }
});


test('synchronous MCTS search checks its time budget during a playout', () => {
  const originalDate = sandbox.Date;
  const originalMath = sandbox.Math;
  let clock = 0;
  let randomCalls = 0;
  sandbox.Date = { now() { clock += 1; return clock; } };
  sandbox.Math = Object.create(Math);
  sandbox.Math.random = () => { randomCalls++; return 0.5; };

  try {
    const s = position();
    s.board[6][0] = { type: 'r', color: 'w', moved: false };
    const move = sandbox.mctsSearch(s, {
      playouts: 100, capDepth: 50, temperature: 0, timeBudgetMs: 4
    });
    assert.ok(move, 'a best-so-far legal move should be returned');
    assert.ok(allLegalState(s).some(m => JSON.stringify(m) === JSON.stringify(move)));
    assert.ok(randomCalls < 10,
      'a playout should stop early after the time budget expires instead of running to capDepth');
  } finally {
    sandbox.Date = originalDate;
    sandbox.Math = originalMath;
  }
});


test('debug logging records phase changes only when the phase changes', () => {
  const logger = sandbox.api.debugLogger;
  logger.enabled = true;
  logger.logs = [];
  logger.lastPhase = null;
  const positionWith = (ply, pieceCount) => {
    const board = Array.from({ length: 8 }, () => Array(10).fill(null));
    for (let i = 0; i < pieceCount; i++) board[Math.floor(i / 10)][i % 10] = { type: 'p', color: 'w' };
    return { ply, board };
  };
  sandbox.api.getGamePhase(positionWith(0, 20));
  sandbox.api.getGamePhase(positionWith(0, 20));
  sandbox.api.getGamePhase(positionWith(10, 20));
  sandbox.api.getGamePhase(positionWith(10, 20));
  const phaseEvents = logger.logs.filter(entry => entry.type === 'phase-change');
  assert.equal(phaseEvents.length, 1);
  assert.match(phaseEvents[0].message, /opening → midgame/);
  logger.enabled = false;
});

test('debug logging records engine selection once and subsequent switches', () => {
  const logger = sandbox.api.debugLogger;
  logger.enabled = true;
  logger.logs = [];
  logger.lastEngineBySide = {};
  logger.engineSelected('White', 'MinMax', 'opening');
  logger.engineSelected('White', 'MinMax', 'opening');
  logger.engineSelected('White', 'MCTS', 'midgame');
  const events = logger.logs.filter(entry => entry.type === 'engine-change');
  assert.equal(events.length, 2);
  assert.match(events[0].message, /White engine selected: MinMax/);
  assert.match(events[1].message, /MinMax → MCTS/);
  logger.enabled = false;
});

test('debug status logging suppresses routine messages but keeps warnings and errors', () => {
  const logger = sandbox.api.debugLogger;
  logger.enabled = true;
  logger.logs = [];
  logger.lastPhase = null;
  sandbox.api.status('White to move.');
  sandbox.api.status('AI worker failed; retrying on the main thread.');
  sandbox.api.status('AI error: engine returned an invalid move.');
  assert.equal(logger.logs.length, 2);
  assert.equal(logger.logs[0].level, 'warn');
  assert.equal(logger.logs[1].level, 'error');
  logger.enabled = false;
});

test('filtered debug export selects events and warnings without deleting the full log', () => {
  const logger = sandbox.api.debugLogger;
  logger.enabled = true;
  logger.logs = [];
  logger.add('routine message', 'info');
  logger.event('phase-change', 'Phase changed: opening → midgame');
  logger.add('worker timed out', 'warn');
  const filtered = logger.getFilteredEntries();
  assert.equal(filtered.length, 2);
  assert.deepEqual(Array.from(filtered, entry => entry.message), [
    'Phase changed: opening → midgame',
    'worker timed out'
  ]);
  assert.equal(logger.logs.length, 3, 'filtering must not mutate or delete the complete log');
  logger.enabled = false;
});

test('?debug=1 still enables debug logging', () => {
  const originalSearch = sandbox.window.location.search;
  const previousMode = sandbox.localStorage.getItem('debugMode');
  const previousLog = sandbox.localStorage.getItem('debugLog');
  sandbox.localStorage.setItem('debugMode', 'false');
  sandbox.localStorage.setItem('debugLog', '[]');
  sandbox.window.location.search = '?debug=1';
  try {
    const logger = new sandbox.api.DebugLogger();
    assert.equal(logger.enabled, true);
  } finally {
    sandbox.window.location.search = originalSearch;
    if (previousMode === null) storedValues.delete('debugMode');
    else sandbox.localStorage.setItem('debugMode', previousMode);
    if (previousLog === null) storedValues.delete('debugLog');
    else sandbox.localStorage.setItem('debugLog', previousLog);
    sandbox.api.debugLogger.enabled = false;
  }
});


test('worker result accepts legal moves with reordered properties and plays the canonical move', () => {
  sandbox.Math = Math;
  sandbox.api.resetAIWorker();
  const workerBlobs = new Map();
  sandbox.URL.createObjectURL = blob => {
    const url = `blob:worker-canonical-move-${workerBlobs.size}`;
    workerBlobs.set(url, blob);
    return url;
  };
  sandbox.URL.revokeObjectURL = () => {};
  sandbox.Worker = class {
    constructor(url) { this.url = url; this.onmessage = null; this.onerror = null; }
    postMessage() {}
    terminate() { this.terminated = true; }
  };

  const worker = ensureAIWorker();
  const s = position();
  setState(s);
  const legal = allLegalState(s)[0];
  assert.ok(legal);
  const reordered = {
    to: { c: legal.to.c, r: legal.to.r },
    from: { c: legal.from.c, r: legal.from.r }
  };
  for (const key of Object.keys(legal)) {
    if (key !== 'from' && key !== 'to') reordered[key] = legal[key];
  }
  const id = 601;
  const contractRequest = EngineContract.createRequest({
    requestId: id, generation: id, engineId: 'minmax_legacy',
    position: s, limits: { depth: 1 }
  });
  const request = { id, engine: sandbox.api.MinMaxLegacy, depth: 1, state: s, contractRequest };
  sandbox.api.setActiveAIForTest(worker, request);

  worker.onmessage({ data: {
    id,
    result: EngineContract.completed(contractRequest, reordered)
  }});

  assert.equal(sandbox.api.getState().turn, 'b',
    'a semantically legal worker move must be played despite property-order differences');
  assert.equal(sandbox.api.getActiveAIForTest().thinking, false);
  sandbox.api.resetAIWorker();
});

test('illegal worker result retries the selected engine on the main thread', () => {
  sandbox.Math = Math;
  sandbox.api.resetAIWorker();
  const workerBlobs = new Map();
  sandbox.URL.createObjectURL = blob => {
    const url = `blob:worker-illegal-move-${workerBlobs.size}`;
    workerBlobs.set(url, blob);
    return url;
  };
  sandbox.URL.revokeObjectURL = () => {};
  sandbox.Worker = class {
    constructor(url) { this.url = url; this.onmessage = null; this.onerror = null; }
    postMessage() {}
    terminate() { this.terminated = true; }
  };

  const worker = ensureAIWorker();
  const s = position();
  setState(s);
  const legal = allLegalState(s)[0];
  const illegal = { from: { r: 7, c: 4 }, to: { r: 5, c: 4 } };
  assert.equal(sandbox.api.findLegalMoveMatch(s, illegal), null);
  const id = 701;
  const engine = {
    ...engineMetadata('minmax_legacy'),
    id: 'minmax_legacy',
    name: 'Regression test engine',
    search(request) { return EngineContract.completed(request, legal); }
  };
  const contractRequest = EngineContract.createRequest({
    requestId: id, generation: id, engineId: engine.id,
    position: s, limits: { depth: 1 }
  });
  const request = { id, engine, depth: 1, state: s, contractRequest };
  sandbox.api.setActiveAIForTest(worker, request);
  const callbackCount = scheduledCallbacks.length;

  worker.onmessage({ data: {
    id,
    result: EngineContract.completed(contractRequest, illegal)
  }});

  assert.equal(worker.terminated, true, 'the worker with the rejected result should be terminated');
  const fallback = scheduledCallbacks.slice(callbackCount).find(callback => callback.delay === 20);
  assert.ok(fallback, 'the main-thread retry should be scheduled');
  fallback();

  assert.equal(sandbox.api.getState().turn, 'b',
    'the fallback engine should make a legal move rather than leave the game waiting');
  assert.equal(sandbox.api.getActiveAIForTest().thinking, false);
  sandbox.api.resetAIWorker();
});


test('MinMax and MCTS satisfy the same protocol-v1 search contract', () => {
  const engines = [
    ['minmax_legacy', sandbox.api.MinMaxLegacy],
    ['mcts', sandbox.mctsEngine(1)]
  ];

  for (const [engineId, engine] of engines) {
    const s = position();
    s.board[6][0] = { type: 'r', color: 'w', moved: false };
    const request = EngineContract.createRequest({
      requestId: 'shared-contract-' + engineId,
      generation: 41,
      engineId,
      position: s,
      limits: { depth: 1 }
    });
    const before = JSON.stringify(request);
    const result = engine.search(request);

    assert.equal(result.status, EngineContract.statuses.COMPLETED, engineId + ': ' + JSON.stringify(result));
    assert.equal(EngineContract.matchesRequest(result, request), true, engineId + ': result identity');
    assert.ok(EngineContract.validateMove(result.move), engineId + ': move shape');
    assert.ok(sandbox.api.findLegalMoveMatch(s, result.move), engineId + ': legal move');
    assert.equal(JSON.stringify(request), before, engineId + ': immutable request');

    const empty = position();
    empty.board = Array.from({ length: 8 }, () => Array(10).fill(null));
    const noMoveRequest = EngineContract.createRequest({
      requestId: 'shared-no-move-' + engineId,
      generation: 42,
      engineId,
      position: empty,
      limits: { depth: 1 }
    });
    const noMove = engine.search(noMoveRequest);
    assert.equal(noMove.status, EngineContract.statuses.NO_MOVE, engineId + ': no-move status');
    assert.equal(noMove.move, null);
    assert.equal(EngineContract.matchesRequest(noMove, noMoveRequest), true);

    const wrongProtocol = engine.search({ ...request, protocolVersion: EngineContract.version + 1 });
    assert.equal(wrongProtocol.status, EngineContract.statuses.FAILED, engineId + ': protocol mismatch');
    assert.equal(wrongProtocol.error.code, EngineContract.errorCodes.INVALID_REQUEST);

    const otherEngineId = engineId === 'mcts' ? 'minmax_legacy' : 'mcts';
    const wrongEngine = engine.search({ ...request, engineId: otherEngineId });
    assert.equal(wrongEngine.status, EngineContract.statuses.FAILED, engineId + ': engine mismatch');
    assert.equal(wrongEngine.error.code, EngineContract.errorCodes.INVALID_REQUEST);
  }
});

test('variant-specific moves survive the shared contract and are resolved by the game core', () => {
  const scenarios = [
    {
      name: 'Jester swap',
      create() {
        const s = position();
        s.board[4][4] = { type: 'j', color: 'w', moved: false };
        s.board[4][5] = { type: 'r', color: 'w', moved: true };
        return {
          state: s,
          move: allLegalState(s).find(m => m.swap && m.from.r === 4 && m.from.c === 4 && m.to.r === 4 && m.to.c === 5),
          verify(next) {
            assert.equal(next.board[4][5].type, 'j');
            assert.equal(next.board[4][4].type, 'r');
          }
        };
      }
    },
    {
      name: 'kingside castling',
      create() {
        const s = position();
        s.board = Array.from({ length: 8 }, () => Array(10).fill(null));
        s.board[7][5] = { type: 'k', color: 'w', moved: false };
        s.board[0][5] = { type: 'k', color: 'b', moved: false };
        s.board[7][9] = { type: 'r', color: 'w', moved: false };
        return {
          state: s,
          move: allLegalState(s).find(m => m.castling === 'kingside'),
          verify(next) {
            assert.equal(next.board[7][8].type, 'k');
            assert.equal(next.board[7][7].type, 'r');
            assert.equal(next.board[7][9], null);
          }
        };
      }
    },
    {
      name: 'double pawn move',
      create() {
        const s = position();
        s.board[6][0] = { type: 'p', color: 'w', moved: false };
        return {
          state: s,
          move: allLegalState(s).find(m => m.doublePawn && m.from.r === 6 && m.from.c === 0 && m.to.r === 4),
          verify(next) {
            assert.deepEqual(JSON.parse(JSON.stringify(next.ep)), { r: 5, c: 0 });
            assert.equal(next.turn, 'b');
          }
        };
      }
    },
    {
      name: 'en passant',
      create() {
        const s = position();
        s.board[3][3] = { type: 'p', color: 'w', moved: true };
        s.board[1][4] = { type: 'p', color: 'b', moved: false };
        s.turn = 'b';
        const doublePawn = allLegalState(s).find(m => m.doublePawn && m.from.r === 1 && m.from.c === 4 && m.to.r === 3);
        assert.ok(doublePawn, 'fixture must allow the preceding double pawn move');
        applyRaw(s, doublePawn);
        return {
          state: s,
          move: allLegalState(s).find(m => m.enPassant && m.from.r === 3 && m.from.c === 3),
          verify(next) {
            assert.equal(next.board[2][4].type, 'p');
            assert.equal(next.board[3][4], null);
            assert.equal(next.captured.w.some(p => p.type === 'p' && p.color === 'b'), true);
          }
        };
      }
    },
    {
      name: 'promotion',
      create() {
        const s = position();
        s.board[1][0] = { type: 'p', color: 'w', moved: true };
        return {
          state: s,
          move: allLegalState(s).find(m => m.from.r === 1 && m.from.c === 0 && m.to.r === 0 && m.to.c === 0),
          promotion: 'j',
          verify(next) {
            assert.equal(next.board[0][0].type, 'j');
            assert.equal(next.board[1][0], null);
          }
        };
      }
    }
  ];

  for (const engineId of ['minmax_legacy', 'mcts']) {
    for (const scenario of scenarios) {
      const fixture = scenario.create();
      assert.ok(fixture.move, engineId + ': ' + scenario.name + ' fixture must have a legal move');
      const request = EngineContract.createRequest({
        requestId: 'variant-' + engineId + '-' + scenario.name,
        generation: 51,
        engineId,
        position: fixture.state,
        limits: { depth: 1 }
      });
      const result = EngineContract.completed(request, fixture.move);
      assert.equal(result.status, EngineContract.statuses.COMPLETED);
      assert.equal(EngineContract.matchesRequest(result, request), true);
      assert.equal(JSON.stringify(result.move), JSON.stringify(fixture.move),
        engineId + ': ' + scenario.name + ' flags must survive serialization');
      const canonical = sandbox.api.findLegalMoveMatch(fixture.state, result.move);
      assert.ok(canonical, engineId + ': ' + scenario.name + ' must resolve to a canonical legal move');

      sandbox.api.resetAIWorker();
      sandbox.api.setState(fixture.state);
      sandbox.api.play(canonical, fixture.promotion || 'q', true);
      fixture.verify(sandbox.api.getState());
    }
  }
});

test('worker timeout fallback retries the selected MinMax or MCTS engine once with a fresh request', () => {
  const previousCreateObjectURL = sandbox.URL.createObjectURL;
  const previousRevokeObjectURL = sandbox.URL.revokeObjectURL;
  const previousWorker = sandbox.Worker;
  const previousWindowWorker = sandbox.window.Worker;
  const originalEngines = new Map([
    ['minmax_legacy', sandbox.api.enginePlugins.get('minmax_legacy')],
    ['mcts', sandbox.api.enginePlugins.get('mcts')]
  ]);
  let workerInstance = null;

  class HangingWorker {
    constructor(url) {
      this.url = url;
      this.terminated = false;
      this.onmessage = null;
      this.onerror = null;
      workerInstance = this;
    }
    postMessage(request) { this.request = request; }
    terminate() { this.terminated = true; }
  }

  sandbox.api.resetAIWorker();
  sandbox.URL.createObjectURL = () => 'blob:cross-engine-timeout-test';
  sandbox.URL.revokeObjectURL = () => {};
  sandbox.Worker = HangingWorker;
  sandbox.window.Worker = HangingWorker;

  try {
    for (const engineId of ['minmax_legacy', 'mcts']) {
      sandbox.api.resetAIWorker();
      scheduledCallbacks.length = 0;
      scheduledTimeouts.length = 0;
      let fallbackCalls = 0;
      let fallbackRequest = null;
      const engine = {
        ...engineMetadata(engineId),
        id: engineId,
        name: engineId + ' timeout fallback probe',
        phases: ['opening', 'midgame', 'endgame'],
        search(request) {
          fallbackCalls++;
          fallbackRequest = request;
          const snapshot = JSON.parse(JSON.stringify(request.position));
          return EngineContract.completed(request, allLegalState(snapshot)[0]);
        }
      };
      sandbox.api.enginePlugins.set(engineId, engine);

      mockElement('modeSelect').value = 'ai';
      configureEngine('white', 'opening', engineId);
      configureEngine('black', 'opening', 'minmax_legacy');
      sandbox.api.updateEngineConfigUI();
      

      const s = position();
      s.board[6][0] = { type: 'r', color: 'w', moved: false };
      configureEngine('white', sandbox.api.getGamePhase(s), engineId);
      
      sandbox.api.setState(s);
      sandbox.api.aiMove();

      const timedOutWorker = workerInstance;
      const originalRequest = timedOutWorker.request;
      assert.equal(originalRequest.contractRequest.engineId, engineId,
        engineId + ': worker must receive the selected engine');
      assert.ok(originalRequest.contractRequest.limits.timeMs > 0, engineId + ': worker request must carry a finite search budget');
      const timeoutCallback = scheduledTimeouts.findLast(callback => callback.delay === 15000);
      assert.ok(timeoutCallback, engineId + ': worker watchdog should be scheduled');

      timeoutCallback();
      assert.equal(timedOutWorker.terminated, true, engineId + ': timed-out worker must be terminated');
      assert.match(mockElement('status').textContent, /retrying on the main thread/i);

      const retryRequest = sandbox.api.getActiveAIForTest().request;
      assert.notEqual(retryRequest.id, originalRequest.id, engineId + ': fallback must get a new request ID');
      assert.equal(retryRequest.contractRequest.engineId, engineId);
      assert.equal(retryRequest.contractRequest.requestId, retryRequest.id);
      assert.equal(retryRequest.contractRequest.generation, retryRequest.id);
      assert.ok(retryRequest.contractRequest.limits.timeMs <= 2000,
        engineId + ': main-thread fallback budget must be capped at 2 seconds');
      assert.notEqual(retryRequest.contractRequest.position, s,
        engineId + ': fallback must receive an isolated snapshot');

      const lateMove = allLegalState(s)[0];
      timedOutWorker.onmessage({
        data: {
          id: originalRequest.id,
          result: EngineContract.completed(originalRequest.contractRequest, lateMove)
        }
      });
      assert.equal(fallbackCalls, 0, engineId + ': late worker result must not bypass fallback');

      const fallbackCallback = scheduledCallbacks.findLast(callback => callback.delay === 20);
      assert.ok(fallbackCallback, engineId + ': main-thread retry should be scheduled');
      fallbackCallback();
      assert.equal(fallbackCalls, 1, engineId + ': selected engine must be retried exactly once');
      assert.equal(fallbackRequest.engineId, engineId);
      assert.equal(sandbox.api.getState().turn, 'b', engineId + ': legal fallback move should be applied');
      assert.equal(sandbox.api.getActiveAIForTest().thinking, false);
      assert.equal(sandbox.api.getActiveAIForTest().request, null);
    }
  } finally {
    for (const [engineId, engine] of originalEngines) sandbox.api.enginePlugins.set(engineId, engine);
    sandbox.api.resetAIWorker();
    sandbox.URL.createObjectURL = previousCreateObjectURL;
    sandbox.URL.revokeObjectURL = previousRevokeObjectURL;
    sandbox.Worker = previousWorker;
    sandbox.window.Worker = previousWindowWorker;
    scheduledCallbacks.length = 0;
    scheduledTimeouts.length = 0;
  }
});


test('AI NO_MOVE distinguishes checkmate and stalemate on worker and main-thread paths for both engines', () => {
  const previousCreateObjectURL = sandbox.URL.createObjectURL;
  const previousRevokeObjectURL = sandbox.URL.revokeObjectURL;
  const previousWorker = sandbox.Worker;
  const previousWindowWorker = sandbox.window.Worker;
  const originalEngines = new Map([
    ['minmax_legacy', sandbox.api.enginePlugins.get('minmax_legacy')],
    ['mcts', sandbox.api.enginePlugins.get('mcts')]
  ]);
  const workers = [];

  class NoMoveWorker {
    constructor(url) {
      this.url = url;
      this.onmessage = null;
      this.onerror = null;
      this.request = null;
      this.terminated = false;
      workers.push(this);
    }
    postMessage(request) { this.request = request; }
    terminate() { this.terminated = true; }
  }

  try {
    for (const engineId of ['minmax_legacy', 'mcts']) {
      sandbox.api.enginePlugins.set(engineId, {
        ...engineMetadata(engineId),
        id: engineId,
        name: engineId + ' NO_MOVE test engine',
        phases: ['opening', 'midgame', 'endgame'],
        search(request) { return EngineContract.completed(request, null); }
      });

      for (const kind of ['checkmate', 'stalemate', 'unexpected-no-move']) {
        const s = terminalPosition(kind);
        const sideToMove = s.turn;
        const hasLegalMoves = allLegalState(s, sideToMove).length > 0;
        assert.equal(hasLegalMoves, kind === 'unexpected-no-move',
          kind + ': fixture must have the expected legal-move state');
        assert.equal(sandbox.api.inCheck(sideToMove, s.board, s.moats), kind === 'checkmate',
          kind + ': fixture must have the expected check state');

        for (const transport of ['worker', 'main-thread']) {
          sandbox.api.resetAIWorker();
          sandbox.api.stopAutoPlayForTest();
          scheduledCallbacks.length = 0;
          scheduledTimeouts.length = 0;
          mockElement('modeSelect').value = 'ai';
          // The unexpected-NO_MOVE fixture has White to move; configure both
          // sides so the selected test engine is used regardless of turn.
          configureEngine('white', 'endgame', engineId);
      configureEngine('black', 'endgame', engineId);
          sandbox.api.updateEngineConfigUI();
          sandbox.api.setState(s);

          if (transport === 'worker') {
            sandbox.URL.createObjectURL = () => 'blob:no-move-terminal-test';
            sandbox.Worker = NoMoveWorker;
            sandbox.window.Worker = NoMoveWorker;
          } else {
            sandbox.URL.createObjectURL = () => { throw new Error('Use main-thread path'); };
          }

          sandbox.api.aiMove();

          if (transport === 'worker') {
            const worker = workers[workers.length - 1];
            const contractRequest = worker.request.contractRequest;
            assert.equal(contractRequest.engineId, engineId);
            worker.onmessage({
              data: {
                id: worker.request.id,
                result: EngineContract.completed(contractRequest, null)
              }
            });
          } else {
            const callback = scheduledCallbacks.findLast(item => item.delay === 20);
            assert.ok(callback, engineId + ': main-thread search should be scheduled');
            callback();
          }

          const expectedGameOver = kind !== 'unexpected-no-move';
          const expectedStatus = kind === 'checkmate' ? 'Checkmate! White wins.'
            : kind === 'stalemate' ? 'Stalemate — Draw.'
            : 'AI error: engine reported no legal moves.';
          assert.equal(sandbox.api.getGameOver(), expectedGameOver,
            engineId + ' ' + transport + ' ' + kind + ': game-over state must match the actual position');
          assert.equal(mockElement('status').textContent, expectedStatus,
            engineId + ' ' + transport + ': no-move response must be classified correctly');
          assert.equal(sandbox.api.getActiveAIForTest().thinking, false);
        }
      }
    }
  } finally {
    for (const [engineId, engine] of originalEngines) sandbox.api.enginePlugins.set(engineId, engine);
    sandbox.api.resetAIWorker();
    sandbox.URL.createObjectURL = previousCreateObjectURL;
    sandbox.URL.revokeObjectURL = previousRevokeObjectURL;
    sandbox.Worker = previousWorker;
    sandbox.window.Worker = previousWindowWorker;
    scheduledCallbacks.length = 0;
    scheduledTimeouts.length = 0;
  }
});

test('main-thread engine failures do not end the game for MinMax or MCTS', () => {
  const previousCreateObjectURL = sandbox.URL.createObjectURL;
  const originalEngines = new Map([
    ['minmax_legacy', sandbox.api.enginePlugins.get('minmax_legacy')],
    ['mcts', sandbox.api.enginePlugins.get('mcts')]
  ]);

  try {
    sandbox.URL.createObjectURL = () => { throw new Error('Use main-thread path'); };
    for (const engineId of ['minmax_legacy', 'mcts']) {
      sandbox.api.resetAIWorker();
      scheduledCallbacks.length = 0;
      mockElement('modeSelect').value = 'ai';
      configureEngine('white', 'endgame', engineId);
      configureEngine('black', 'opening', 'minmax_legacy');
      sandbox.api.enginePlugins.set(engineId, {
        ...engineMetadata(engineId),
        id: engineId,
        name: engineId + ' failing test engine',
        phases: ['opening', 'midgame', 'endgame'],
        search(request) {
          return EngineContract.failed(request, EngineContract.errorCodes.SEARCH_FAILED, 'simulated main-thread failure');
        }
      });
      sandbox.api.setState(position());
      sandbox.api.aiMove();

      const callback = scheduledCallbacks.findLast(item => item.delay === 20);
      assert.ok(callback, engineId + ': main-thread search should be scheduled');
      callback();

      assert.match(mockElement('status').textContent, /AI error: simulated main-thread failure/);
      assert.equal(sandbox.api.getGameOver(), false, engineId + ': engine failure must not end the game');
    }
  } finally {
    for (const [engineId, engine] of originalEngines) sandbox.api.enginePlugins.set(engineId, engine);
    sandbox.api.resetAIWorker();
    sandbox.URL.createObjectURL = previousCreateObjectURL;
    scheduledCallbacks.length = 0;
  }
});
