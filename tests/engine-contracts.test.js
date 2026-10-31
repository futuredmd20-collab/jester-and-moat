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
const storedValues = new Map();
const scheduledCallbacks = [];
let storageThrowsOnRead = false;
let storageThrowsOnWrite = false;
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
  setTimeout(callback) { scheduledCallbacks.push(callback); return scheduledCallbacks.length; },
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
vm.runInContext(source.slice(0, boundary) + `
globalThis.api = { EngineContract, MinMaxLegacy, cancelActiveAIRequest, setActiveAIForTest(worker, request) { aiWorker = worker; pendingAIRequest = request; isAIThinking = true; }, getActiveAIForTest() { return { worker: aiWorker, request: pendingAIRequest, thinking: isAIThinking, id: aiRequestId }; }, allLegalState, getBestMove, applyRaw, initializeEditorCastlingRights, getGamePhase, ensureAIWorker, aiMove, enginePlugins, resetAIWorker() { if (aiWorker && typeof aiWorker.terminate === 'function') aiWorker.terminate(); aiWorker = null; pendingAIRequest = null; isAIThinking = false; gameOver = false; gameOverMessage = ''; }, play, aiPlaceMoatForColor, confirmMoatPlacement, loadEngineConfig, updateEngineConfigUI, getEngineForSide, getEngineConfig, getDefaultEngineForSide() { return defaultEngineForSide; }, setPendingMoat(m) { pendingMoat = m; }, setState(s) { state = s; }, getState() { return state; }, setHistoryForTest(states, logs, isOver = false) { history = clone(states); historyMoveLogs = clone(logs); state = clone(history[history.length - 1]); moveLog = clone(historyMoveLogs[historyMoveLogs.length - 1]); redoStack = []; gameOver = isOver; gameOverMessage = isOver ? document.getElementById('status').textContent : ''; }, getHistory() { return clone(history); }, getHistoryMoveLogs() { return clone(historyMoveLogs); }, getMoveLog() { return moveLog.slice(); }, getRedoStack() { return clone(redoStack); }, getGameOver() { return gameOver; }, pushHistorySnapshot, replaceLatestHistorySnapshot, undoHistoryStep, redoHistoryStep, exportGameData, parseGameData, ENGINE_PHASES };
`, sandbox, { filename: 'script.js' });
vm.runInContext(mcts, sandbox, { filename: 'engines/mcts-engine.js' });
// The app's HTML loads the MCTS module before script.js; register its plugin here
// because this test harness evaluates script.js first to expose the test API.
sandbox.api.enginePlugins.set('mcts', sandbox.mctsEngine(2));

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
const { EngineContract, allLegalState, getBestMove, applyRaw, getGamePhase, ensureAIWorker, play, aiPlaceMoatForColor, confirmMoatPlacement, setPendingMoat, setState, getState, setHistoryForTest, getHistory, getHistoryMoveLogs, getMoveLog, getGameOver, undoHistoryStep, redoHistoryStep, replaceLatestHistorySnapshot, exportGameData, parseGameData, ENGINE_PHASES } = sandbox.api;

test('MinMax returns a legal move without mutating its input', () => {
  const s = position();
  s.board[6][0] = { type: 'r', color: 'w', moved: false };
  const before = JSON.stringify(s);
  const move = getBestMove(s, 1);
  assert.ok(move);
  assert.ok(allLegalState(s).some(m => JSON.stringify(m) === JSON.stringify(move)));
  assert.equal(JSON.stringify(s), before);
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

  assert.equal(result.status, EngineContract.statuses.COMPLETED);
  assert.equal(result.requestId, request.requestId);
  assert.equal(result.generation, request.generation);
  assert.ok(EngineContract.validateMove(result.move));
  assert.ok(allLegalState(s).some(m => JSON.stringify(m) === JSON.stringify(result.move)));
  assert.equal(JSON.stringify(request), before);
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
      for (const resultKind of ['failed', 'malformed']) {
        sandbox.api.resetAIWorker();
        mockElement('whiteEngineSelect').value = engineId;
        mockElement('whiteEnginePhaseSelect').value = 'endgame';
        mockElement('blackEngineSelect').value = 'minmax_legacy';
        mockElement('blackEnginePhaseSelect').value = 'opening';
        sandbox.api.updateEngineConfigUI();
        sandbox.api.setState(position());
        sandbox.api.aiMove();

        const worker = workers[workers.length - 1];
        const contractRequest = worker.request.contractRequest;
        assert.equal(contractRequest.engineId, engineId, 'the worker request should target the selected engine');
        const result = resultKind === 'failed'
          ? EngineContract.failed(contractRequest, EngineContract.errorCodes.SEARCH_FAILED, 'simulated search failure')
          : {
              status: EngineContract.statuses.COMPLETED,
              requestId: contractRequest.requestId,
              generation: contractRequest.generation,
              move: { from: { r: -1, c: 0 }, to: { r: 0, c: 0 } }
            };

        worker.onmessage({ data: { id: worker.request.id, result } });

        assert.match(sandbox.document.getElementById('status').textContent,
          resultKind === 'failed' ? /AI error: simulated search failure/ : /AI error: engine returned an invalid move/);
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
        postMessage(message) { response = message; }
      };
      vm.createContext(workerContext);
      vm.runInContext(source, workerContext, { filename: 'ai-worker.js' });
      workerContext.onmessage({ data });
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
  assert.equal(response.result.status, EngineContract.statuses.COMPLETED);
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


test('White and Black engine settings persist and restore independently', () => {
  const whiteEngine = mockElement('whiteEngineSelect');
  const whitePhase = mockElement('whiteEnginePhaseSelect');
  const blackEngine = mockElement('blackEngineSelect');
  const blackPhase = mockElement('blackEnginePhaseSelect');

  whiteEngine.value = 'mcts';
  whitePhase.value = 'midgame';
  blackEngine.value = 'minmax_legacy';
  blackPhase.value = 'endgame';
  sandbox.api.updateEngineConfigUI();

  assert.deepEqual(JSON.parse(storedValues.get('engineConfig')), {
    whiteEngine: 'mcts', whitePhase: 'midgame',
    blackEngine: 'minmax_legacy', blackPhase: 'endgame'
  });

  whiteEngine.value = 'minmax_legacy';
  whitePhase.value = 'opening';
  blackEngine.value = 'mcts';
  blackPhase.value = 'opening';
  sandbox.api.loadEngineConfig();

  assert.equal(whiteEngine.value, 'mcts');
  assert.equal(whitePhase.value, 'midgame');
  assert.equal(blackEngine.value, 'minmax_legacy');
  assert.equal(blackPhase.value, 'endgame');
});

test('engine configuration applies MCTS only in the selected phase and keeps MinMax elsewhere', () => {
  const config = sandbox.api.getDefaultEngineForSide();
  mockElement('whiteEngineSelect').value = 'mcts';
  mockElement('whiteEnginePhaseSelect').value = 'midgame';
  mockElement('blackEngineSelect').value = 'mcts';
  mockElement('blackEnginePhaseSelect').value = 'endgame';
  sandbox.api.updateEngineConfigUI();

  assert.deepEqual(JSON.parse(JSON.stringify(config.w.phaseOverrides)), {
    opening: 'minmax_legacy', midgame: 'mcts', endgame: 'minmax_legacy'
  });
  assert.deepEqual(JSON.parse(JSON.stringify(config.b.phaseOverrides)), {
    opening: 'minmax_legacy', midgame: 'minmax_legacy', endgame: 'mcts'
  });
});

test('missing or malformed saved engine configuration falls back to safe defaults', () => {
  storedValues.delete('engineConfig');
  sandbox.api.loadEngineConfig();
  assert.equal(mockElement('whiteEngineSelect').value, 'minmax_legacy');
  assert.equal(mockElement('whiteEnginePhaseSelect').value, 'opening');
  assert.equal(mockElement('blackEngineSelect').value, 'minmax_legacy');
  assert.equal(mockElement('blackEnginePhaseSelect').value, 'opening');

  storedValues.set('engineConfig', '{broken json');
  mockElement('whiteEngineSelect').value = 'mcts';
  mockElement('blackEngineSelect').value = 'mcts';
  sandbox.api.loadEngineConfig();
  assert.equal(mockElement('whiteEngineSelect').value, 'minmax_legacy');
  assert.equal(mockElement('whiteEnginePhaseSelect').value, 'opening');
  assert.equal(mockElement('blackEngineSelect').value, 'minmax_legacy');
  assert.equal(mockElement('blackEnginePhaseSelect').value, 'opening');
});

test('invalid saved engine names and phases are replaced with defaults per field', () => {
  storedValues.set('engineConfig', JSON.stringify({
    whiteEngine: 'not-an-engine', whitePhase: 'invalid-phase',
    blackEngine: 'mcts', blackPhase: 'endgame'
  }));
  sandbox.api.loadEngineConfig();
  assert.equal(mockElement('whiteEngineSelect').value, 'minmax_legacy');
  assert.equal(mockElement('whiteEnginePhaseSelect').value, 'opening');
  assert.equal(mockElement('blackEngineSelect').value, 'mcts');
  assert.equal(mockElement('blackEnginePhaseSelect').value, 'endgame');
});

test('storage read and write failures do not throw during engine configuration setup', () => {
  storageThrowsOnRead = true;
  storageThrowsOnWrite = true;
  assert.doesNotThrow(() => sandbox.api.loadEngineConfig());
  storageThrowsOnRead = false;
  storageThrowsOnWrite = false;
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
    name: 'MinMax crash fallback probe',
    phases: ['opening', 'midgame', 'endgame'],
    getMove() {
      calls++;
      return null;
    }
  });

  try {
    mockElement('modeSelect').value = 'ai_vs_ai';
    mockElement('whiteEngineSelect').value = 'minmax_legacy';
    mockElement('whiteEnginePhaseSelect').value = 'opening';
    mockElement('blackEngineSelect').value = 'minmax_legacy';
    mockElement('blackEnginePhaseSelect').value = 'opening';
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


test('main-thread fallback calls the selected engine when Blob workers are blocked', () => {
  const previousCreateObjectURL = sandbox.URL.createObjectURL;
  const originalMinMax = sandbox.api.enginePlugins.get('minmax_legacy');
  let calls = 0;
  let receivedState;
  let receivedSide;

  sandbox.api.resetAIWorker();
  sandbox.URL.createObjectURL = () => { throw new Error('Blob workers blocked by test'); };
  sandbox.api.enginePlugins.set('minmax_legacy', {
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
  for (const field of ['phase','ply','ep','moats','moatDestroyed','hasPlacedMoat','moveCounts','captured','halfmoveClock','positionHistory','clocks']) delete state[field];
  const legacy = { state, history: [state], moveLog: ['legacy log'] };
  const imported = parseGameData(legacy, 180);
  assert.equal(imported.state.phase, 'normal');
  assert.equal(imported.state.ply, 0);
  assert.equal(imported.state.clocks.w, 180);
  assert.equal(JSON.stringify(imported.historyMoveLogs), JSON.stringify([['legacy log']]));
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
  s.board[6][0] = { type: 'r', color: 'w', moved: false };
  const request = sandbox.api.EngineContract.createRequest({
    requestId: 'contract-1', generation: 7, engineId: 'minmax_legacy',
    position: s, limits: { depth: 1 }, config: { profile: 'test' }
  });
  s.board[6][0].type = 'q';
  assert.equal(request.protocolVersion, 1);
  assert.equal(request.position.board[6][0].type, 'r');
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
  assert.equal(contract.completed(request, null).status, contract.statuses.NO_MOVE);
  assert.equal(contract.cancelled(request).status, contract.statuses.CANCELLED);
  assert.equal(contract.failed(request, contract.errorCodes.SEARCH_FAILED, 'test').status, contract.statuses.FAILED);
  assert.equal(contract.matchesRequest(contract.completed(request, null), { ...request, requestId: 99 }), false);
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
    assert.equal(cancelledWorker.terminated, true, 'cancelling the search should terminate its worker');

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
  mockElement('whiteEngineSelect').value = 'mcts';
  mockElement('whiteEnginePhaseSelect').value = 'midgame';
  mockElement('blackEngineSelect').value = 'mcts';
  mockElement('blackEnginePhaseSelect').value = 'endgame';
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
