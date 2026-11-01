"use strict";

/* v0.6.0 — seven drawn SVG symbols, one per piece, live in pieces.svg (built by
 * generate-piece-sprite.js) and are injected before this file runs. Fills read
 * the --p-* palette that pieces.css sets from data-color, so both sides share
 * one drawing with a distinct light/dark palette.
 * The element is sized by CSS (.piece), never here: one box, one rule. */
const PIECE_NAME = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn', j: 'jester' };

/* One markup function for board squares, captured boxes, the promotion modal and
 * the editor palette, so every surface uses the currently selected art set. */

/* Debug Mode */
const DEBUG_MODE_KEY = 'debugMode';
const DEBUG_LOG_KEY = 'debugLog';
const DEBUG_LOG_MAX = 1000;

class DebugLogger {
  constructor() {
    this.enabled = false;
    this.autoScroll = true;
    this.logs = [];
    this.loadState();
    this.checkUrl();
  }

  checkUrl() {
    const params = new URLSearchParams(window.location.search);
    if (params.has('debug') && params.get('debug') === '1') {
      this.enable();
    }
  }

  loadState() {
    try {
      const saved = localStorage.getItem(DEBUG_MODE_KEY);
      if (saved === 'true') this.enabled = true;
      const logs = localStorage.getItem(DEBUG_LOG_KEY);
      if (logs) this.logs = JSON.parse(logs);
    } catch (e) {
      // localStorage not available
    }
  }

  saveState() {
    try {
      localStorage.setItem(DEBUG_MODE_KEY, String(this.enabled));
      localStorage.setItem(DEBUG_LOG_KEY, JSON.stringify(this.logs));
    } catch (e) {
      // localStorage not available
    }
  }

  enable() {
    this.enabled = true;
    this.add('Debug mode enabled', 'info');
    this.showPanel();
    this.saveState();
  }

  disable() {
    this.enabled = false;
    this.add('Debug mode disabled', 'info');
    this.hidePanel();
    this.saveState();
  }

  toggle() {
    if (this.enabled) this.disable();
    else this.enable();
  }

  showPanel() {
    const panel = document.getElementById('debugPanel');
    if (panel) panel.hidden = false;
  }

  hidePanel() {
    const panel = document.getElementById('debugPanel');
    if (panel) panel.hidden = true;
  }

  add(message, level = 'info') {
    if (!this.enabled) return;

    const timestamp = new Date().toISOString();
    const entry = { timestamp, level, message };
    this.logs.push(entry);
    
    if (this.logs.length > DEBUG_LOG_MAX) {
      this.logs.shift();
    }

    this.saveState();
    this.render();
    console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](message);
  }

  render() {
    const logEl = document.getElementById('debugLog');
    if (!logEl) return;

    const html = this.logs.map(entry => {
      const levelClass = `debug-${entry.level}`;
      return `<div class="debug-entry ${levelClass}"><span class="debug-time">[${entry.timestamp.slice(11, 23)}]</span> <span class="debug-msg">${this.escapeHtml(entry.message)}</span></div>`;
    }).join('');

    const wasScrolled = logEl.scrollHeight - logEl.clientHeight <= logEl.scrollTop + 1;
    logEl.innerHTML = html;
    if (this.autoScroll || wasScrolled) {
      logEl.scrollTop = logEl.scrollHeight;
    }
  }

  clear() {
    this.logs = [];
    this.saveState();
    this.render();
    this.add('Log cleared', 'info');
  }

  download() {
    const blob = new Blob([this.logs.map(e => `[${e.timestamp}] [${e.level}] ${e.message}`).join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jester-moat-debug-${new Date().toISOString().slice(0, 19)}.log`;
    a.click();
    URL.revokeObjectURL(url);
  }

  toggleAutoScroll() {
    this.autoScroll = !this.autoScroll;
    this.add(`Auto-scroll ${this.autoScroll ? 'enabled' : 'disabled'}`, 'info');
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

const debugLogger = new DebugLogger();
let activePieceSet = 'classic';
function pieceMarkup(type, color, extraClass = "") {
  const name = PIECE_NAME[type] || 'pawn';
  const side = color === 'b' ? 'black' : 'white';
  const symbolPrefix = activePieceSet === 'flat' ? 'flat-p-' : 'p-';
  const sizingClass = activePieceSet === 'flat' ? 'piece-set-flat' : 'piece-set-classic';
  return `<svg class="piece piece-${name} ${sizingClass} ${extraClass}" preserveAspectRatio="none" data-type="${name}" data-color="${color}" ` +
    `role="img" aria-label="${side} ${name}">` +
    `<use href="#${symbolPrefix}${name}"></use></svg>`;
}

/* The board editor's piece palette draws the same shared SVG artwork. */
function renderPalettePieces() {
  document.querySelectorAll('.palette-btn[data-tool]').forEach(btn => {
    const m = /^([wb])_([kqrbnpj])$/.exec(btn.dataset.tool || '');
    if (m) btn.innerHTML = pieceMarkup(m[2], m[1]);
  });
}

const ROWS = 8, COLS = 10;
const DIRS = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];

/* Plugin System: Phase Constants */
const ENGINE_PHASES = {
  OPENING: 'opening',
  MIDGAME: 'midgame',
  ENDGAME: 'endgame'
};

/* Plugin System: Phase Detection */
function getGamePhase(st) {
  let pieceCount = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (st.board[r][c]) pieceCount++;
    }
  }
  const phase = st.ply < 10 || pieceCount >= 34 ? ENGINE_PHASES.OPENING :
               pieceCount <= 16 ? ENGINE_PHASES.ENDGAME :
               ENGINE_PHASES.MIDGAME;
  debugLogger.add(`Phase: ${phase} (ply: ${st.ply}, pieces: ${pieceCount})`, 'info');
  return phase;
}

let state;
let selected = null;
let animateNextMove = false;
let legalTargets = [];
let history = [];
let historyMoveLogs = [];
let redoStack = [];
let moveLog = [];
let gameOver = false;
let gameOverMessage = '';
let aiTimer = null;
let autoPlayInterval = null;
let lastMove = null;
let clockFrameId = null;
let lastClockDisplay = { w: null, b: null };
let aiWorker = null;
let aiRequestId = 0;
let pendingAIRequest = null;
let aiWorkerTimeout = null;
const AI_WORKER_TIMEOUT_MS = 15000;

// Invalidate in-flight work whenever the authoritative game position/lifecycle changes.
// The legacy transport has no cancellation acknowledgment; terminating its worker is the hard-stop mechanism.
function cancelActiveAIRequest(reason = 'state-changed') {
  aiRequestId++;
  const worker = aiWorker;
  aiWorker = null;
  if (aiWorkerTimeout !== null && typeof clearTimeout === 'function') clearTimeout(aiWorkerTimeout);
  aiWorkerTimeout = null;
  if (worker && typeof worker.terminate === 'function') worker.terminate();
  pendingAIRequest = null;
  isAIThinking = false;
  if (typeof clearTimeout === 'function') clearTimeout(aiTimer);
  if (debugLogger && typeof debugLogger.add === 'function') debugLogger.add(`AI request cancelled: ${reason}`, 'info');
}
let gameStarted = false;
let pendingPromotionMove = null;
let playerColor = 'w';
let pendingMoat = null;
let editMode = false;
let activeTool = 'eraser';
let isAIThinking = false;
let lastClockTickTime = null;

function clone(x) { return JSON.parse(JSON.stringify(x)); }

function pushHistorySnapshot() {
  history.push(clone(state));
  historyMoveLogs.push(moveLog.slice());
  redoStack = [];
}
function replaceLatestHistorySnapshot() {
  if (!history.length) { pushHistorySnapshot(); return; }
  history[history.length - 1] = clone(state);
  historyMoveLogs[historyMoveLogs.length - 1] = moveLog.slice();
}
function undoHistoryStep() {
  if (history.length <= 1) return false;
  const currentState = history.pop();
  const currentMoveLog = historyMoveLogs.pop() || moveLog.slice();
  redoStack.push({ state: clone(currentState), moveLog: currentMoveLog.slice(), gameOver,
    gameOverMessage, statusText: document.getElementById('status').textContent });
  state = clone(history[history.length - 1]);
  moveLog = (historyMoveLogs[historyMoveLogs.length - 1] || []).slice();
  gameOver = false;
  gameOverMessage = '';
  return true;
}
function redoHistoryStep() {
  if (!redoStack.length) return false;
  const nextEntry = redoStack.pop();
  state = clone(nextEntry.state);
  moveLog = (nextEntry.moveLog || []).slice();
  history.push(clone(state));
  historyMoveLogs.push(moveLog.slice());
  gameOver = Boolean(nextEntry.gameOver);
  gameOverMessage = gameOver ? (nextEntry.gameOverMessage || nextEntry.statusText || '') : '';
  if (gameOver) {
    const statusEl = document.getElementById('status');
    if (statusEl) statusEl.textContent = gameOverMessage || 'Game over.';
  }
  return true;
}
function validSavedCoordinate(value, maxRow = ROWS - 1, maxCol = COLS - 1) {
  return value === null || (value && Number.isInteger(value.r) && Number.isInteger(value.c) &&
    value.r >= 0 && value.r <= maxRow && value.c >= 0 && value.c <= maxCol);
}
function normalizeSavedState(candidate, initialTime = 0) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate) || !Array.isArray(candidate.board) ||
      candidate.board.length !== ROWS || candidate.board.some(row => !Array.isArray(row) || row.length !== COLS)) {
    throw new Error('Invalid board dimensions in save file.');
  }
  if (!['w', 'b'].includes(candidate.turn)) throw new Error('Invalid side to move in save file.');
  for (const row of candidate.board) for (const piece of row) {
    if (piece !== null && (!piece || typeof piece !== 'object' || Array.isArray(piece) ||
        !['k', 'q', 'r', 'b', 'n', 'p', 'j'].includes(piece.type) || !['w', 'b'].includes(piece.color) ||
        (piece.moved !== undefined && typeof piece.moved !== 'boolean'))) {
      throw new Error('Invalid piece in save file.');
    }
  }
  const normalized = clone(candidate);
  if (normalized.phase === undefined) normalized.phase = 'normal';
  if (!['normal', 'place_moat_w', 'place_moat_b'].includes(normalized.phase)) throw new Error('Invalid game phase in save file.');
  if (normalized.ply === undefined) normalized.ply = 0;
  else if (!Number.isInteger(normalized.ply) || normalized.ply < 0) throw new Error('Invalid ply in save file.');
  if (normalized.ep === undefined) normalized.ep = null;
  if (!validSavedCoordinate(normalized.ep)) throw new Error('Invalid en passant target in save file.');
  if (normalized.moats === undefined) normalized.moats = { w: null, b: null };
  if (!normalized.moats || typeof normalized.moats !== 'object' || Array.isArray(normalized.moats)) throw new Error('Invalid moat coordinates in save file.');
  for (const side of ['w', 'b']) {
    if (normalized.moats[side] === undefined) normalized.moats[side] = null;
    if (!validSavedCoordinate(normalized.moats[side], ROWS - 1, COLS - 3)) throw new Error('Invalid moat coordinates in save file.');
  }
  const normalizeSideMap = (field, defaults, validate, errorMessage) => {
    if (normalized[field] === undefined) normalized[field] = clone(defaults);
    if (!normalized[field] || typeof normalized[field] !== 'object' || Array.isArray(normalized[field])) throw new Error(errorMessage);
    for (const side of ['w', 'b']) {
      if (normalized[field][side] === undefined) normalized[field][side] = clone(defaults[side]);
      if (!validate(normalized[field][side])) throw new Error(errorMessage);
    }
  };
  normalizeSideMap('moatDestroyed', { w: false, b: false }, value => typeof value === 'boolean', 'Invalid moat status in save file.');
  normalizeSideMap('hasPlacedMoat', { w: Boolean(normalized.moats.w), b: Boolean(normalized.moats.b) },
    value => typeof value === 'boolean', 'Invalid moat placement status in save file.');
  normalizeSideMap('moveCounts', { w: 0, b: 0 }, value => Number.isInteger(value) && value >= 0, 'Invalid move counts in save file.');
  normalizeSideMap('captured', { w: [], b: [] }, value => Array.isArray(value) && value.every(piece =>
    piece && typeof piece === 'object' && !Array.isArray(piece) &&
    ['k', 'q', 'r', 'b', 'n', 'p', 'j'].includes(piece.type) && ['w', 'b'].includes(piece.color) &&
    (piece.moved === undefined || typeof piece.moved === 'boolean')), 'Invalid captured pieces in save file.');
  if (normalized.halfmoveClock === undefined) normalized.halfmoveClock = 0;
  else if (!Number.isFinite(normalized.halfmoveClock) || normalized.halfmoveClock < 0) throw new Error('Invalid halfmove clock in save file.');
  if (normalized.positionHistory === undefined) normalized.positionHistory = {};
  if (!normalized.positionHistory || typeof normalized.positionHistory !== 'object' || Array.isArray(normalized.positionHistory)) throw new Error('Invalid position history in save file.');
  if (normalized.clocks === undefined) normalized.clocks = { w: initialTime, b: initialTime };
  if (!normalized.clocks || typeof normalized.clocks !== 'object' || Array.isArray(normalized.clocks)) throw new Error('Invalid clocks in save file.');
  for (const side of ['w', 'b']) {
    if (normalized.clocks[side] === undefined) normalized.clocks[side] = initialTime;
    if (!Number.isFinite(normalized.clocks[side]) || normalized.clocks[side] < 0) throw new Error('Invalid clocks in save file.');
  }
  return normalized;
}
function canonicalSavedValue(value) {
  if (Array.isArray(value)) return value.map(canonicalSavedValue);
  if (value && typeof value === 'object') {
    const sorted = {};
    for (const key of Object.keys(value).sort()) sorted[key] = canonicalSavedValue(value[key]);
    return sorted;
  }
  return value;
}
function savedValuesEqual(a, b) {
  return JSON.stringify(canonicalSavedValue(a)) === JSON.stringify(canonicalSavedValue(b));
}
function exportGameData() {
  return { state: clone(state), moveLog: moveLog.slice(), history: clone(history),
    historyMoveLogs: clone(historyMoveLogs), gameStarted, playerColor, gameOver, gameOverMessage };
}
function parseGameData(input, initialTime = 0) {
  const parsed = typeof input === 'string' ? JSON.parse(input) : input;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !Array.isArray(parsed.history) || parsed.history.length === 0) throw new Error('Invalid save state format.');
  const normalizedState = normalizeSavedState(parsed.state, initialTime);
  const normalizedHistory = parsed.history.map(item => normalizeSavedState(item, initialTime));
  const logs = parsed.moveLog === undefined ? [] : parsed.moveLog;
  if (!Array.isArray(logs) || logs.some(line => typeof line !== 'string')) throw new Error('Invalid move log in save file.');
  let logHistory;
  if (parsed.historyMoveLogs !== undefined) {
    logHistory = parsed.historyMoveLogs;
    if (!Array.isArray(logHistory) || logHistory.length !== normalizedHistory.length ||
        logHistory.some(snapshot => !Array.isArray(snapshot) || snapshot.some(line => typeof line !== 'string'))) throw new Error('Invalid history log snapshots in save file.');
    logHistory = logHistory.map(snapshot => snapshot.slice());
    if (!savedValuesEqual(logs, logHistory[logHistory.length - 1])) throw new Error('Current move log does not match the latest history log snapshot.');
  } else {
    logHistory = normalizedHistory.map((_, index) => index === normalizedHistory.length - 1 ? logs.slice() : logs.slice(0, Math.min(index, logs.length)));
  }
  const currentComparable = clone(normalizedState);
  const latestHistoryComparable = clone(normalizedHistory[normalizedHistory.length - 1]);
  // Clocks tick between moves, so the current saved clocks may legitimately be newer than the history snapshot.
  delete currentComparable.clocks;
  delete latestHistoryComparable.clocks;
  if (!savedValuesEqual(currentComparable, latestHistoryComparable)) throw new Error('Current state does not match the latest history snapshot.');
  // Keep the current clock values when redo restores the latest position after loading.
  normalizedHistory[normalizedHistory.length - 1].clocks = clone(normalizedState.clocks);
  const savedPlayerColor = parsed.playerColor === undefined ? 'w' : parsed.playerColor;
  if (!['w', 'b'].includes(savedPlayerColor)) throw new Error('Invalid player side in save file.');
  if (parsed.gameStarted !== undefined && typeof parsed.gameStarted !== 'boolean') throw new Error('Invalid game-started flag in save file.');
  if (parsed.gameOver !== undefined && typeof parsed.gameOver !== 'boolean') throw new Error('Invalid game-over flag in save file.');
  if (parsed.gameOverMessage !== undefined && typeof parsed.gameOverMessage !== 'string') throw new Error('Invalid game-over message in save file.');
  return { state: normalizedState, moveLog: logs.slice(), history: normalizedHistory, historyMoveLogs: logHistory,
    gameStarted: parsed.gameStarted === undefined ? true : parsed.gameStarted, playerColor: savedPlayerColor,
    gameOver: parsed.gameOver === true, gameOverMessage: parsed.gameOverMessage || '' };
}

function inside(r, c) { return r >= 0 && r < ROWS && c >= 0 && c < COLS; }
function other(color) { return color === "w" ? "b" : "w"; }
function makePiece(type, color) { return { type, color, moved: false }; }

function parseClockString(str) {
  if (!str || !str.trim()) return null;
  const parts = str.trim().split(':');
  if (parts.length === 1) {
    const sec = parseInt(parts[0], 10);
    return isNaN(sec) ? null : Math.max(0, sec);
  } else if (parts.length === 2) {
    const min = parseInt(parts[0], 10);
    const sec = parseInt(parts[1], 10);
    if (isNaN(min) || isNaN(sec)) return null;
    return Math.max(0, min * 60 + sec);
  }
  return null;
}

function getPositionKey(st) {
  let boardStr = '';
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = st.board[r][c];
      boardStr += p ? `${p.color}${p.type}${p.moved?1:0}` : '.';
    }
  }
  return `${boardStr}|${st.turn}|${JSON.stringify(st.moats)}|${st.ep ? st.ep.r+','+st.ep.c : '-'}`;
}

function isInsufficientMaterial(st) {
  let pieces = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = st.board[r][c];
      if (p) pieces.push(p);
    }
  }
  if (pieces.length === 2) return true;
  if (pieces.length === 3) {
    const nonKings = pieces.filter(p => p.type !== 'k');
    if (nonKings.length === 1 && (nonKings[0].type === 'n' || nonKings[0].type === 'b')) {
      return true;
    }
  }
  return false;
}

function formatTime(seconds) {
  if (seconds <= 0) return "00:00";
  seconds = Math.floor(seconds);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function isGameActiveForClock() {
  if (gameOver || !gameStarted || editMode) return false;
  const mode = document.getElementById('modeSelect').value;
  // Scheduling fix: ai_vs_ai is a paused simulation until ▶ starts it, so its
  // clock stays frozen. A VS-AI game is a real game in progress, so its clock
  // runs whether or not auto-play is on (play() has scheduled the AI's reply
  // without ▶ since v0.4.6, so the game does advance).
  if (mode === 'ai_vs_ai') return autoPlayInterval !== null;
  return true;
}

function stopClock() {
  if (clockFrameId !== null) cancelAnimationFrame(clockFrameId);
  clockFrameId = null;
  lastClockTickTime = null;
}

function startClock() {
  stopClock();
  lastClockTickTime = performance.now();
  const tick = (now) => {
    if (!isGameActiveForClock()) {
      lastClockTickTime = now;
      clockFrameId = requestAnimationFrame(tick);
      return;
    }
    const initialTime = parseInt(document.getElementById('timeSelect').value, 10);
    if (initialTime === 0 && state.clocks.w === 0 && state.clocks.b === 0) {
      clockFrameId = requestAnimationFrame(tick);
      return;
    }

    const elapsed = Math.max(0, (now - (lastClockTickTime ?? now)) / 1000);
    lastClockTickTime = now;
    const currentTurn = state.turn;
    if (state.clocks[currentTurn] > 0 && elapsed > 0) {
      state.clocks[currentTurn] = Math.max(0, state.clocks[currentTurn] - elapsed);
      const shown = formatTime(state.clocks[currentTurn]);
      if (lastClockDisplay[currentTurn] !== shown) updateClockUI();
      if (state.clocks[currentTurn] <= 0) {
        gameOver = true;
        stopAutoPlay();
        stopClock();
        status(`Time Out! ${currentTurn === 'w' ? 'Black' : 'White'} wins on time.`);
        updateClockUI();
        return;
      }
    }
    clockFrameId = requestAnimationFrame(tick);
  };
  clockFrameId = requestAnimationFrame(tick);
}

function updateClockUI() {
  const shownW = formatTime(state.clocks.w), shownB = formatTime(state.clocks.b);
  document.getElementById('clockW').textContent = shownW;
  document.getElementById('clockB').textContent = shownB;
  lastClockDisplay = { w: shownW, b: shownB };

  const boxW = document.getElementById('clockBoxW');
  const boxB = document.getElementById('clockBoxB');

  const activeClock = isGameActiveForClock();
  boxW.classList.toggle('active', state.turn === 'w' && activeClock);
  boxB.classList.toggle('active', state.turn === 'b' && activeClock);
}

function stopAutoPlay(){
  if (autoPlayInterval){
    clearInterval(autoPlayInterval);
    autoPlayInterval = null;
    document.getElementById('autoBtn').textContent = '▶';
    document.getElementById('autoBtn').setAttribute('aria-label', 'Start auto-play');
  }
}

function updateDisplayPreferences() {
  const displayMode = document.getElementById('uiDisplaySelect').value;
  const clockContainer = document.getElementById('clockContainerEl');
  const evalBarContainer = document.getElementById('evalBarContainer');
  const evalTrack = document.getElementById('boardEvalTrack');
  const whiteInfo = document.getElementById('evalWhiteInfo');
  const blackInfo = document.getElementById('evalBlackInfo');

  if (displayMode === 'full') {
    clockContainer.style.display = 'flex';
    evalBarContainer.style.display = 'flex';
    evalTrack.style.display = 'flex';
    whiteInfo.style.display = 'flex';
    blackInfo.style.display = 'flex';
  } else if (displayMode === 'bar_pts') {
    clockContainer.style.display = 'none';
    evalBarContainer.style.display = 'flex';
    evalTrack.style.display = 'flex';
    whiteInfo.style.display = 'flex';
    blackInfo.style.display = 'flex';
  } else if (displayMode === 'bar_only') {
    clockContainer.style.display = 'none';
    evalBarContainer.style.display = 'flex';
    evalTrack.style.display = 'flex';
    whiteInfo.style.display = 'none';
    blackInfo.style.display = 'none';
  } else if (displayMode === 'clocks_only') {
    clockContainer.style.display = 'flex';
    evalBarContainer.style.display = 'none';
    evalTrack.style.display = 'none';
  } else if (displayMode === 'hidden') {
    clockContainer.style.display = 'none';
    evalBarContainer.style.display = 'none';
    evalTrack.style.display = 'none';
  }
}

function setEditorToggleLabel(label){
  const button = document.getElementById('editorToggleBtn');
  const textNode = Array.from(button.childNodes).find(node => node.nodeType === Node.TEXT_NODE);
  if (textNode) {
    textNode.textContent = ` ${label}`;
  } else {
    button.appendChild(document.createTextNode(` ${label}`));
  }
}

function setup(){
  cancelActiveAIRequest('new-game-or-setup');
  clearTimeout(aiTimer);
  stopClock();
  stopAutoPlay();
  pendingMoat = null;
  editMode = false;
  isAIThinking = false;
  document.getElementById('editorPanel').classList.remove('active');
  setEditorToggleLabel('Edit Board');

  const mode = document.getElementById('modeSelect').value;
  const sideSetting = document.getElementById('playerSideSelect').value;
  if (sideSetting === 'random') {
    playerColor = Math.random() < 0.5 ? 'w' : 'b';
  } else {
    playerColor = sideSetting === 'black' ? 'b' : 'w';
  }

  const boardEl = document.getElementById('board');
  if (playerColor === 'b' && mode !== 'ai_vs_ai') {
    boardEl.classList.add('flipped');
  } else {
    boardEl.classList.remove('flipped');
  }
  updateModeUI();

  const initialTime = parseInt(document.getElementById('timeSelect').value, 10);
  const pos = document.getElementById("jesterPosSelect").value;
  let back = ['r','j','n','b','q','k','b','n','j','r'];
  if (pos === "center") back = ['r','n','b','j','q','k','j','b','n','r'];
  
  const b = Array.from({length: ROWS}, () => Array(COLS).fill(null));
  for (let c = 0; c < COLS; c++) {
    b[0][c] = makePiece(back[c], 'b');
    b[1][c] = makePiece('p', 'b');
    b[ROWS-2][c] = makePiece('p', 'w');
    b[ROWS-1][c] = makePiece(back[c], 'w');
  }

  state = {
    board: b,
    turn: 'w',
    ply: 0,
    ep: null,
    moats: { w: null, b: null },
    moatDestroyed: { w: false, b: false },
    hasPlacedMoat: { w: false, b: false },
    moveCounts: { w: 0, b: 0 },
    phase: 'normal',
    captured: { w: [], b: [] },
    halfmoveClock: 0,
    positionHistory: {},
    clocks: { w: initialTime, b: initialTime }
  };

  state.positionHistory[getPositionKey(state)] = 1;
  selected = null; legalTargets = []; moveLog = []; history = [clone(state)]; historyMoveLogs = [moveLog.slice()]; redoStack = []; lastMove = null; gameOver = false; gameOverMessage = ''; gameStarted = false; pendingPromotionMove = null;
  hideGameOverOverlay();
  
  lastClockDisplay = { w: null, b: null };
  updateDisplayPreferences();
  updateClockUI();
  startClock();
  render();
  status(`White starts. Click ▶ (Auto-play) or Make Move to begin.`);

  // Scheduling fix: when the AI has White it must open the game by itself
  // instead of waiting for ▶. Same ungated form the side-switch handler
  // already uses.
  if (mode !== 'ai_vs_ai' && isAIMode() && state.turn !== playerColor && !gameOver) {
    aiTimer = setTimeout(aiMove, getSpeed());
  }
}

function status(s) {
  let fullMsg = s;
  if (debugLogger.enabled && state) {
    const phase = getGamePhase(state);
    fullMsg = `[Phase: ${phase}] ${s}`;
  }
  const statusEl = document.getElementById("status");
  statusEl.textContent = fullMsg;
  if (gameOver) gameOverMessage = fullMsg;
  debugLogger.add(fullMsg, 'info');
}

function pieceAt(r, c, b = state.board) { return inside(r, c) ? b[r][c] : null; }

function getMoatCells(moat) {
  if (!moat) return [];
  return [{r: moat.r, c: moat.c}, {r: moat.r, c: moat.c + 1}, {r: moat.r, c: moat.c + 2}];
}

function isMoatCell(r, c, moats = state.moats) {
  for (const color of ['w', 'b']) {
    const cells = getMoatCells(moats[color]);
    if (cells.some(cell => cell.r === r && cell.c === c)) return color;
  }
  return null;
}

function checkMoatDestructionState(s) {
  const destroyed = [];
  for (const mColor of ['w', 'b']) {
    const m = s.moats ? s.moats[mColor] : null;
    if (!m) continue;
    const oppColor = other(mColor);
    const cells = getMoatCells(m);
    let oppCount = 0;
    for (const cell of cells) {
      const p = s.board[cell.r][cell.c];
      if (p && p.color === oppColor) oppCount++;
    }
    if (oppCount >= 2) {
      s.moats[mColor] = null;
      if (!s.moatDestroyed) s.moatDestroyed = { w: false, b: false };
      s.moatDestroyed[mColor] = true;
      destroyed.push(mColor);
    }
  }
  return destroyed;
}

function attacked(r, c, by, b = state.board, moats = state.moats) {
  const pawnFromR = r + (by === "w" ? 1 : -1);
  for (const dc of [-1, 1]) { const p = pieceAt(pawnFromR, c + dc, b); if (p && p.color === by && p.type === 'p') return true; }
  for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
    const p = pieceAt(r + dr, c + dc, b); if (p && p.color === by && p.type === 'n') return true;
  }
  for (const [dr, dc] of DIRS) { const p = pieceAt(r + dr, c + dc, b); if (p && p.color === by && p.type === 'k') return true; }

  const startMoat = isMoatCell(r, c, moats);
  for (const [dr, dc] of DIRS) {
    for (let step = 1; step < Math.max(ROWS, COLS); step++) {
      const rr = r + dr * step, cc = c + dc * step; if (!inside(rr, cc)) break;

      // A piece standing ON a moat cell attacks normally off the moat
      // (consistent with pseudoMoves), so inspect the piece BEFORE letting
      // the moat block the ray.
      const p = pieceAt(rr, cc, b);
      if (p && p.color === by) {
        if (p.type === 'q' || (p.type === 'r' && (dr === 0 || dc === 0)) || (p.type === 'b' && dr !== 0 && dc !== 0) || (p.type === 'j' && step <= 3)) return true;
      }
      if (p) break;

      const targetMoat = isMoatCell(rr, cc, moats);
      if (targetMoat !== null) {
        if (startMoat === null) break;
        else if (targetMoat !== startMoat) break;
      }
    }
  }
  return false;
}

function kingPos(color, b = state.board) {
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { const p = b[r][c]; if (p && p.color === color && p.type === 'k') return {r, c}; }
  return null;
}

function inCheck(color, b = state.board, moats = state.moats) {
  const k = kingPos(color, b); return !k || attacked(k.r, k.c, other(color), b, moats);
}

function pseudoMoves(r, c, b = state.board, ep = state.ep, moats = state.moats) {
  const p = pieceAt(r, c, b); if (!p) return [];
  const out = [], add = (rr, cc, extra = {}) => { if (!inside(rr, cc)) return; const t = b[rr][cc]; if (t && t.color === p.color) return; if (t && t.type === 'k') return; out.push({from:{r,c}, to:{r:rr,c:cc}, ...extra}); };

  if (p.type === 'p') {
    const d = p.color === 'w' ? -1 : 1, start = p.color === 'w' ? ROWS - 2 : 1;
    if (inside(r + d, c) && !b[r + d][c]) {
      add(r + d, c);
      if (r === start && !b[r + 2 * d][c]) add(r + 2 * d, c, {doublePawn: true});
    }
    for (const dc of [-1, 1]) {
      const rr = r + d, cc = c + dc; if (!inside(rr, cc)) continue;
      const t = b[rr][cc];
      if (t && t.color !== p.color && t.type !== 'k') add(rr, cc);
      else if (!t && ep && ep.r === rr && ep.c === cc && b[r][cc] && b[r][cc].type === 'p' && b[r][cc].color !== p.color) add(rr, cc, {enPassant: true});
    }
  } else if (p.type === 'n') {
    for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) add(r + dr, c + dc);
  } else if (p.type === 'k') {
    for (const [dr, dc] of DIRS) add(r + dr, c + dc);

    if (c === 5 && !p.moved && !inCheck(p.color, b, moats)) {
      const rightRook = b[r][9];
      if (rightRook && rightRook.type === 'r' && !rightRook.moved) {
        if (!b[r][6] && !b[r][7] && !b[r][8]) {
          if (!attacked(r, 6, other(p.color), b, moats) && !attacked(r, 7, other(p.color), b, moats) && !attacked(r, 8, other(p.color), b, moats)) {
            out.push({from:{r,c}, to:{r,c:8}, castling:'kingside'});
          }
        }
      }
      const leftRook = b[r][0];
      if (leftRook && leftRook.type === 'r' && !leftRook.moved) {
        if (!b[r][1] && !b[r][2] && !b[r][3] && !b[r][4]) {
          if (!attacked(r, 4, other(p.color), b, moats) && !attacked(r, 3, other(p.color), b, moats) && !attacked(r, 2, other(p.color), b, moats) && !attacked(r, 1, other(p.color), b, moats)) {
            out.push({from:{r,c}, to:{r,c:1}, castling:'queenside'});
          }
        }
      }
    }
  } else {
    const dirs = p.type === 'r' ? DIRS.slice(0,4) : p.type === 'b' ? DIRS.slice(4) : DIRS;
    const max = p.type === 'j' ? 3 : Math.max(ROWS, COLS);
    const startMoat = isMoatCell(r, c, moats);
    for (const [dr, dc] of dirs) {
      for (let s = 1; s <= max; s++) {
        const rr = r + dr * s, cc = c + dc * s; if (!inside(rr, cc)) break;
        const t = b[rr][cc];
        if (t && t.color === p.color) break;
        if (t && t.type === 'k') break;
        
        const targetMoat = isMoatCell(rr, cc, moats);
        add(rr, cc);
        
        if (t) break;

        if (targetMoat !== null) {
          if (startMoat === null) break;
          else if (targetMoat !== startMoat) break;
        }
      }
    }
  }
  return out;
}

function applyRaw(s, m, promoChoice = 'q') {
  if (!s.captured) s.captured = {w:[], b:[]};
  const b = s.board, p = b[m.from.r][m.from.c], target = b[m.to.r][m.to.c];
  
  let isCaptureOrPawn = (p.type === 'p' || target !== null || m.enPassant);

  if (m.enPassant) {
    const epPawn = b[m.from.r][m.to.c];
    if (epPawn) s.captured[p.color].push(epPawn);
    b[m.from.r][m.to.c] = null;
  }
  if (target) {
    s.captured[p.color].push(target);
  }

  if (p.type === 'p' && (m.to.r === 0 || m.to.r === ROWS - 1)) {
    if (promoChoice === 'moat') {
      // Pawn is replaced by a re-deployed moat (placed in a later phase);
      // clear BOTH squares — especially the to-square if this was a capture.
      b[m.from.r][m.from.c] = null;
      b[m.to.r][m.to.c] = null;
    } else {
      // Guard against invalid promo choices (the AI / auto-play path passes
      // the sentinel 'pending'); fall back to queen.
      p.type = ['q', 'j', 'r', 'b', 'n'].includes(promoChoice) ? promoChoice : 'q';
      b[m.to.r][m.to.c] = p; b[m.from.r][m.from.c] = null; p.moved = true;
    }
  } else {
    b[m.to.r][m.to.c] = p; b[m.from.r][m.from.c] = null; p.moved = true;
  }

  if (m.castling === 'kingside') {
    const rook = b[m.from.r][9];
    b[m.from.r][9] = null;
    b[m.from.r][7] = rook;
    if (rook) rook.moved = true;
  } else if (m.castling === 'queenside') {
    const rook = b[m.from.r][0];
    b[m.from.r][0] = null;
    b[m.from.r][2] = rook;
    if (rook) rook.moved = true;
  }

  s.ep = m.doublePawn ? {r: (m.from.r + m.to.r) / 2, c: m.from.c} : null;
  s.turn = other(s.turn); s.ply++;

  if (isCaptureOrPawn) {
    s.halfmoveClock = 0;
  } else {
    s.halfmoveClock = (s.halfmoveClock || 0) + 1;
  }

  // Moat destruction is part of the move itself: this keeps legality checks
  // and the AI search in sync with real play (applyRaw is used everywhere).
  const moatsDestroyed = checkMoatDestructionState(s);
  return { captured: target || null, moatsDestroyed };
}

function legalMovesFromState(st, r, c) {
  const p = st.board[r][c]; if (!p || p.color !== st.turn) return [];
  const result = [];
  for (const m of pseudoMoves(r, c, st.board, st.ep, st.moats)) {
    const s = clone(st); applyRaw(s, m);
    if (!inCheck(p.color, s.board, s.moats)) result.push(m);
  }
  if (p.type === 'j') {
    for (const [dr, dc] of DIRS) {
      const rr = r + dr, cc = c + dc; if (!inside(rr, cc)) continue;
      const q = st.board[rr][cc]; if (!q || q.color !== p.color || !q.moved) continue;
      const s = clone(st);
      const a = s.board[r][c], z = s.board[rr][cc];
      s.board[r][c] = z; s.board[rr][cc] = a; a.moved = true; z.moved = true; s.turn = other(s.turn); s.ply++;
      s.halfmoveClock = (s.halfmoveClock || 0) + 1;
      if (!inCheck(p.color, s.board, s.moats)) result.push({from:{r,c}, to:{r:rr,c:cc}, swap:true});
    }
  }
  return result;
}

function legalMovesFrom(r, c) { return legalMovesFromState(state, r, c); }

function allLegalState(st, color = st.turn) {
  const old = st.turn; st.turn = color; const out = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { const p = st.board[r][c]; if (p && p.color === color) out.push(...legalMovesFromState(st, r, c)); }
  st.turn = old; return out;
}

function allLegal(color = state.turn) { return allLegalState(state, color); }

function getJesterValue(st) {
  let pieceCount = 0;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { if (st.board[r][c]) pieceCount++; }
  if (st.ply < 10) return 4.0;
  if (pieceCount > 18) return 5.5;
  return 3.5;
}



/* Shared internal engine contract, protocol v1.
 * Transport adapters translate to/from this shape; the game core validates and applies moves. */
// Shared utility retained for engine adapters outside the contract factory.
function engineCopy(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }

function createEngineContract() {
const ENGINE_PROTOCOL_VERSION = 1;
const ENGINE_CAPABILITIES = Object.freeze({
  EVALUATION: 'evaluation', PRINCIPAL_VARIATION: 'principalVariation',
  SEARCH_STATS: 'searchStats', PROGRESS: 'progress'
});
const ENGINE_RESULT_STATUS = Object.freeze({
  COMPLETED: 'completed', NO_MOVE: 'no-move', CANCELLED: 'cancelled', FAILED: 'failed'
});
const ENGINE_ERROR_CODES = Object.freeze({
  INVALID_REQUEST: 'INVALID_REQUEST', INVALID_POSITION: 'INVALID_POSITION',
  INVALID_CONFIG: 'INVALID_CONFIG', INVALID_MOVE: 'INVALID_MOVE',
  SEARCH_FAILED: 'SEARCH_FAILED', CANCELLED: 'CANCELLED'
});
function engineDeepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const key of Object.keys(value)) engineDeepFreeze(value[key]);
  return value;
}
function engineCopy(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function engineError(code, message, details = null) {
  return { code, message: String(message || code), details: details == null ? null : engineCopy(details) };
}
const EngineContract = Object.freeze({
  version: ENGINE_PROTOCOL_VERSION, capabilities: ENGINE_CAPABILITIES,
  statuses: ENGINE_RESULT_STATUS, errorCodes: ENGINE_ERROR_CODES,
  createRequest({ requestId, generation, engineId, position, limits = {}, config = {} } = {}) {
    if ((typeof requestId !== 'string' && !Number.isSafeInteger(requestId)) || String(requestId).length === 0)
      throw Object.assign(new Error('A unique requestId is required.'), { code: ENGINE_ERROR_CODES.INVALID_REQUEST });
    if ((typeof generation !== 'string' && !Number.isSafeInteger(generation)) || String(generation).length === 0)
      throw Object.assign(new Error('A generation identifier is required.'), { code: ENGINE_ERROR_CODES.INVALID_REQUEST });
    if (!engineId || typeof engineId !== 'string')
      throw Object.assign(new Error('A stable engineId is required.'), { code: ENGINE_ERROR_CODES.INVALID_REQUEST });
    if (!position || !Array.isArray(position.board) || position.board.length !== 8 ||
        position.board.some(row => !Array.isArray(row) || row.length !== 10) || !['w', 'b'].includes(position.turn))
      throw Object.assign(new Error('Position snapshot has an invalid board or side to move.'), { code: ENGINE_ERROR_CODES.INVALID_POSITION });
    const depth = limits.depth == null ? 2 : limits.depth;
    if (!Number.isInteger(depth) || depth < 1 || depth > 10)
      throw Object.assign(new Error('Search depth must be an integer from 1 to 10.'), { code: ENGINE_ERROR_CODES.INVALID_CONFIG });
    const timeMs = limits.timeMs == null ? null : limits.timeMs;
    if (timeMs !== null && (!Number.isFinite(timeMs) || timeMs <= 0))
      throw Object.assign(new Error('timeMs must be a positive finite number when provided.'), { code: ENGINE_ERROR_CODES.INVALID_CONFIG });
    return engineDeepFreeze({ protocolVersion: ENGINE_PROTOCOL_VERSION, requestId, generation, engineId,
      position: engineCopy(position), limits: { depth, timeMs }, config: engineCopy(config) });
  },
  validateMove(move) {
    if (!move || typeof move !== 'object' || !move.from || !move.to) return false;
    const square = s => Number.isInteger(s.r) && Number.isInteger(s.c) && s.r >= 0 && s.r < 8 && s.c >= 0 && s.c < 10;
    // Keep variant flags (swap, castling, en passant, promotion, moat actions) intact.
    return square(move.from) && square(move.to);
  },
  completed(request, move, metadata = {}) {
    if (!request || request.protocolVersion !== ENGINE_PROTOCOL_VERSION)
      return this.failed(request, ENGINE_ERROR_CODES.INVALID_REQUEST, 'Unsupported or missing engine request.');
    if (move == null) return { protocolVersion: request.protocolVersion, engineId: request.engineId,
      status: ENGINE_RESULT_STATUS.NO_MOVE, requestId: request.requestId,
      generation: request.generation, move: null, metadata: engineCopy(metadata) };
    if (!this.validateMove(move)) return this.failed(request, ENGINE_ERROR_CODES.INVALID_MOVE, 'Engine returned a malformed move.');
    return { protocolVersion: request.protocolVersion, engineId: request.engineId,
      status: ENGINE_RESULT_STATUS.COMPLETED, requestId: request.requestId,
      generation: request.generation, move: engineCopy(move), metadata: engineCopy(metadata) };
  },
  cancelled(request, message = 'Search cancelled.') {
    return { protocolVersion: request && request.protocolVersion, engineId: request && request.engineId,
      status: ENGINE_RESULT_STATUS.CANCELLED, requestId: request && request.requestId,
      generation: request && request.generation, error: engineError(ENGINE_ERROR_CODES.CANCELLED, message) };
  },
  failed(request, code, message, details = null) {
    return { protocolVersion: request && request.protocolVersion, engineId: request && request.engineId,
      status: ENGINE_RESULT_STATUS.FAILED, requestId: request && request.requestId,
      generation: request && request.generation, error: engineError(code || ENGINE_ERROR_CODES.SEARCH_FAILED, message, details) };
  },
  createCancellationRequest(request, reason = 'state-changed') {
    if (!request || request.protocolVersion !== ENGINE_PROTOCOL_VERSION ||
        (typeof request.requestId !== 'string' && !Number.isSafeInteger(request.requestId)) ||
        (typeof request.generation !== 'string' && !Number.isSafeInteger(request.generation)) ||
        typeof request.engineId !== 'string' || !request.engineId)
      throw Object.assign(new Error('A valid active request is required to request cancellation.'), { code: ENGINE_ERROR_CODES.INVALID_REQUEST });
    return Object.freeze({ type: 'cancel', protocolVersion: ENGINE_PROTOCOL_VERSION,
      engineId: request.engineId, requestId: request.requestId, generation: request.generation,
      reason: String(reason || 'state-changed') });
  },
  createCancellationAcknowledgment(request, outcome = 'cancelled', details = null) {
    if (!request || request.type !== 'cancel' || request.protocolVersion !== ENGINE_PROTOCOL_VERSION)
      throw Object.assign(new Error('A valid cancellation request is required.'), { code: ENGINE_ERROR_CODES.INVALID_REQUEST });
    if (!['cancelled', 'already-finished', 'not-found'].includes(outcome))
      throw Object.assign(new Error('Unsupported cancellation acknowledgment outcome.'), { code: ENGINE_ERROR_CODES.INVALID_REQUEST });
    return { type: 'cancel-ack', protocolVersion: ENGINE_PROTOCOL_VERSION, engineId: request.engineId,
      requestId: request.requestId, generation: request.generation, outcome,
      details: details == null ? null : engineCopy(details) };
  },
  matchesCancellationAcknowledgment(ack, request) {
    return !!ack && !!request && request.type === 'cancel' && ack.type === 'cancel-ack' &&
      ack.protocolVersion === ENGINE_PROTOCOL_VERSION && ack.protocolVersion === request.protocolVersion &&
      ack.engineId === request.engineId && ack.requestId === request.requestId &&
      ack.generation === request.generation &&
      ['cancelled', 'already-finished', 'not-found'].includes(ack.outcome);
  },
  matchesRequest(result, request) {
    return !!result && !!request && result.protocolVersion === ENGINE_PROTOCOL_VERSION &&
      result.protocolVersion === request.protocolVersion && result.engineId === request.engineId &&
      result.requestId === request.requestId && result.generation === request.generation &&
      request.protocolVersion === ENGINE_PROTOCOL_VERSION;
  }
});
  return EngineContract;
}

const EngineContract = createEngineContract();
const ENGINE_PROTOCOL_VERSION = EngineContract.version;
const ENGINE_CAPABILITIES = EngineContract.capabilities;
const ENGINE_RESULT_STATUS = EngineContract.statuses;
const ENGINE_ERROR_CODES = EngineContract.errorCodes;

/* Internal MinMax engine, protocol-v1 entry point.
 * Search receives an immutable contract request and returns a structured result.
 * Search limits are supplied by the caller; engine logic does not read the UI. */
const MinMaxSearchCore = MinMaxSearchCoreFactory({ clone, other, applyRaw, allLegalState, inCheck, getJesterValue });
// Compatibility adapters for shared evaluation helpers used by MCTS and diagnostics.
function evaluateBoard(st) { return MinMaxSearchCore.evaluateBoard(st); }
function minimax(st, depth, alpha, beta, isMaximizing) { return MinMaxSearchCore.minimax(st, depth, alpha, beta, isMaximizing); }
function getBestMove(st, depth) { return MinMaxSearchCore.getBestMove(st, depth); }

const MinMaxLegacy = {
  id: 'minmax_legacy',
  name: 'MinMax',
  phases: [ENGINE_PHASES.OPENING, ENGINE_PHASES.MIDGAME, ENGINE_PHASES.ENDGAME],
  capabilities: [],
  strength: 'default',
  search: function(request) {
    if (!request || request.protocolVersion !== ENGINE_PROTOCOL_VERSION || request.engineId !== this.id)
      return EngineContract.failed(request, ENGINE_ERROR_CODES.INVALID_REQUEST, 'Invalid MinMax search request.');
    try {
      return EngineContract.completed(request, MinMaxSearchCore.getBestMove(engineCopy(request.position), request.limits.depth));
    } catch (error) {
      return EngineContract.failed(request, ENGINE_ERROR_CODES.SEARCH_FAILED, error && error.message || error);
    }
  },
};

/* Plugin System: Engine Registry */
const enginePlugins = new Map();
enginePlugins.set('minmax_legacy', MinMaxLegacy);
if (typeof mctsEngine === 'function') {
  enginePlugins.set('mcts', mctsEngine(2));
} else {
  // Keep the board and legacy engine usable if the optional MCTS module fails to load.
  console.warn('MCTS engine failed to load; falling back to MinMax.');
}

/* Plugin System: Per-side default engine configuration
 * Both sides default to MinMaxLegacy for all phases (single-engine mode)
 * Format: { engineId: string, phaseOverrides: { [phase]: engineId } | null } */
const defaultEngineForSide = {
  w: { engineId: 'minmax_legacy', phaseOverrides: { opening: 'minmax_legacy', midgame: 'minmax_legacy', endgame: 'minmax_legacy' } },
  b: { engineId: 'minmax_legacy', phaseOverrides: { opening: 'minmax_legacy', midgame: 'minmax_legacy', endgame: 'minmax_legacy' } }
};
const MODE_TAG = { pvp: '2 Players', ai_easy: 'vs AI · Easy', ai_medium: 'vs AI · Medium', ai_hard: 'vs AI · Hard', ai_vs_ai: 'AI vs AI' };
/* Game-mode indicator and controls that have no meaning in AI vs AI. */
function updateModeUI() {
  const mode = document.getElementById('modeSelect').value;
  const isSim = mode === 'ai_vs_ai';
  const modeRow = document.getElementById('gameModeRow');
  const modeIndicator = document.getElementById('gameModePill');
  const showModeIndicator = document.getElementById('showModeIndicatorToggle');
  if (modeIndicator) modeIndicator.textContent = MODE_TAG[mode] || '';
  if (modeRow) modeRow.hidden = !(showModeIndicator && showModeIndicator.checked);
  const switchBtn = document.getElementById('sideSwitchBtn');
  switchBtn.disabled = isSim;
  switchBtn.title = isSim ? 'Not available in AI vs AI' : 'Switch player side and board view';
  document.getElementById('playerSideSelect').disabled = isSim;
}function updateEngineConfigUI() {
  // Read White engine/phase selects
  const whiteEngine = document.getElementById('whiteEngineSelect').value;
  const whitePhase = document.getElementById('whiteEnginePhaseSelect').value;
  const blackEngine = document.getElementById('blackEngineSelect').value;
  const blackPhase = document.getElementById('blackEnginePhaseSelect').value;

  // Helper: build phaseOverrides where only the selected phase gets the chosen engine
  function buildPhaseOverrides(engine, phase) {
    const base = { opening: 'minmax_legacy', midgame: 'minmax_legacy', endgame: 'minmax_legacy' };
    if (engine === 'mcts') {
      base[phase] = 'mcts';
    }
    return base;
  }

  defaultEngineForSide.w.phaseOverrides = buildPhaseOverrides(whiteEngine, whitePhase);
  defaultEngineForSide.b.phaseOverrides = buildPhaseOverrides(blackEngine, blackPhase);
  defaultEngineForSide.w.engineId = whiteEngine;
  defaultEngineForSide.b.engineId = blackEngine;

  // Persist to localStorage for reload persistence
  try {
    localStorage.setItem('engineConfig', JSON.stringify({
      whiteEngine, whitePhase,
      blackEngine, blackPhase
    }));
  } catch (e) {
    // localStorage not available (e.g. private browsing); ignore
  }
}

function isAIMode() {
  const m = document.getElementById('modeSelect').value;
  return m.startsWith('ai_');
}

// Restore saved engine settings before the user starts or changes a game.
function loadEngineConfig() {
  const defaults = {
    whiteEngine: 'minmax_legacy',
    whitePhase: ENGINE_PHASES.OPENING,
    blackEngine: 'minmax_legacy',
    blackPhase: ENGINE_PHASES.OPENING
  };
  const validEngines = new Set(['minmax_legacy', 'mcts']);
  const validPhases = new Set(Object.values(ENGINE_PHASES));
  let saved = null;
  try {
    const raw = localStorage.getItem('engineConfig');
    if (raw) saved = JSON.parse(raw);
  } catch (e) {
    // Missing or inaccessible storage and malformed JSON use safe defaults.
  }
  const config = { ...defaults };
  if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
    if (validEngines.has(saved.whiteEngine)) config.whiteEngine = saved.whiteEngine;
    if (validPhases.has(saved.whitePhase)) config.whitePhase = saved.whitePhase;
    if (validEngines.has(saved.blackEngine)) config.blackEngine = saved.blackEngine;
    if (validPhases.has(saved.blackPhase)) config.blackPhase = saved.blackPhase;
  }
  document.getElementById('whiteEngineSelect').value = config.whiteEngine;
  document.getElementById('whiteEnginePhaseSelect').value = config.whitePhase;
  document.getElementById('blackEngineSelect').value = config.blackEngine;
  document.getElementById('blackEnginePhaseSelect').value = config.blackPhase;
  updateEngineConfigUI();
  return config;
}

// Wire up engine/phase per-side configuration UI.
document.getElementById('whiteEngineSelect').onchange = updateEngineConfigUI;
document.getElementById('whiteEnginePhaseSelect').onchange = updateEngineConfigUI;
document.getElementById('blackEngineSelect').onchange = updateEngineConfigUI;
document.getElementById('blackEnginePhaseSelect').onchange = updateEngineConfigUI;
loadEngineConfig();

function ensureAIWorker() {
  if (aiWorker || !('Worker' in window)) return aiWorker;
  const engineFunctions = [clone, inside, other, pieceAt, getMoatCells, isMoatCell, checkMoatDestructionState, attacked, kingPos, inCheck, pseudoMoves, applyRaw, legalMovesFromState, allLegalState, getJesterValue, evaluateBoard, minimax, getBestMove, MinMaxSearchCoreFactory];
  // MCTS helpers live in engines/mcts-engine.js. Serialize them only when that module loaded.
  if (typeof mctsGetMove === 'function' && typeof mctsSearch === 'function') {
    engineFunctions.push(mctsLevelFor, mctsApplyMove, mctsPlayout, mctsNode, mctsUctChild, mctsSearch, mctsGetMove, mctsEngine);
  }
  const workerSource = `"use strict";
const ROWS = 8, COLS = 10;
const DIRS = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
function engineCopy(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
${createEngineContract.toString()}
const EngineContract = createEngineContract();
const ENGINE_PROTOCOL_VERSION = EngineContract.version;
const ENGINE_RESULT_STATUS = EngineContract.statuses;
const ENGINE_ERROR_CODES = EngineContract.errorCodes;
const MinMaxSearchCore = MinMaxSearchCoreFactory({ clone, other, applyRaw, allLegalState, inCheck, getJesterValue });
const MinMaxLegacy = { id: 'minmax_legacy', search: ${MinMaxLegacy.search.toString()} };
// MCTS constants must be defined inside the serialized worker scope too.
const MCTS_LEVELS = {
  1: { playouts: 200, capDepth: 10, temperature: 0.35, rating: '~800' },
  2: { playouts: 700, capDepth: 14, temperature: 0.15, rating: '~1200' },
  3: { playouts: 2000, capDepth: 18, temperature: 0.00, rating: '~1600' }
};
const MCTS_EXPLORATION = 0.7;
let state = null;
${engineFunctions.map(fn => fn.toString()).join('\n')}
onmessage = function(event) {
  const data = event.data;
  try {
    if (data.contractRequest) {
      const request = data.contractRequest;
      // Contract snapshots are deeply frozen; search helpers mutate their working state.
      // Clone the snapshot at the worker boundary so the engine cannot mutate the request.
      state = clone(request.position);
      if (!['minmax_legacy', 'mcts'].includes(request.engineId))
        throw new Error('Unsupported structured engine selector.');
      const result = request.engineId === 'mcts'
        ? mctsEngine(request.limits && request.limits.depth).search(request)
        : MinMaxLegacy.search(request);
      postMessage({ id: data.id, result });
      return;
    }
    // Compatibility path for engines not yet migrated to structured transport.
    state = data.state;
    const moveFn = data.workerFn === 'mctsGetMove' ? mctsGetMove
      : data.workerFn === 'getBestMove' || data.workerFn == null ? getBestMove
      : null;
    if (!moveFn) throw new Error('Unsupported worker function: ' + data.workerFn);
    const move = moveFn(state, data.depth);
    postMessage({ id: data.id, move });
  }
  catch (error) {
    if (data.contractRequest) {
      const request = data.contractRequest;
      postMessage({ id: data.id, result: {
        protocolVersion: request.protocolVersion,
        requestId: request.requestId,
        generation: request.generation,
        engineId: request.engineId,
        status: 'failed',
        move: null,
        error: { code: 'SEARCH_FAILED', message: String(error && error.message || error), details: null }
      }});
    } else postMessage({ id: data.id, error: String(error && error.message || error) });
  }
};`;
  let blob, url;
  try {
    blob = new Blob([workerSource], { type: 'text/javascript' });
    url = URL.createObjectURL(blob);
    aiWorker = new Worker(url);
    URL.revokeObjectURL(url);
  } catch (err) {
    // Environment forbids blob workers (e.g. strict CSP in embedded
    // previews). Fall back to main-thread search instead of throwing.
    aiWorker = null;
    return null;
  }
  aiWorker.onmessage = (event) => {
    debugLogger.add('Worker message received', 'info');
    const data = event.data;
    if (data.id !== aiRequestId) return;
    if (aiWorkerTimeout !== null && typeof clearTimeout === 'function') clearTimeout(aiWorkerTimeout);
    aiWorkerTimeout = null;
    isAIThinking = false;
    const completedRequest = pendingAIRequest && pendingAIRequest.id === data.id ? pendingAIRequest : null;
    if (completedRequest) pendingAIRequest = null;
    if (gameOver) return;
    if (data.error) {
      status(`AI error: ${data.error}`);
      return;
    }
    // Structured MinMax replies retain request identity across the worker boundary.
    let move = data.move;
    if (completedRequest && completedRequest.contractRequest) {
      const result = data.result;
      if (!EngineContract.matchesRequest(result, completedRequest.contractRequest)) {
        status('AI error: stale or mismatched engine result.');
        return;
      }
      if (result.status === ENGINE_RESULT_STATUS.FAILED) {
        status(`AI error: ${result.error && result.error.message || 'Engine search failed.'}`);
        return;
      }
      if (result.status === ENGINE_RESULT_STATUS.CANCELLED) {
        status('AI search cancelled.');
        return;
      }
      if (![ENGINE_RESULT_STATUS.COMPLETED, ENGINE_RESULT_STATUS.NO_MOVE].includes(result.status)) {
        status('AI error: engine returned an unsupported result status.');
        return;
      }
      if (result.status === ENGINE_RESULT_STATUS.COMPLETED &&
          !EngineContract.validateMove(result.move)) {
        status('AI error: engine returned an invalid move.');
        return;
      }
      move = result.status === ENGINE_RESULT_STATUS.COMPLETED ? result.move : null;
    }
    // The game core, not the engine, decides whether a returned move is legal.
    if (move && !allLegalState(state).some(legal => JSON.stringify(legal) === JSON.stringify(move))) {
      status('AI error: engine returned an illegal move.');
      return;
    }
    if (move) play(move, 'pending');
    else {
      gameOver = true;
      stopAutoPlay();
      stopClock();
      status('No legal moves available.');
    }
};
  const workerInstance = aiWorker;
  workerInstance.onerror = () => {
    handleAIWorkerFailure(workerInstance, pendingAIRequest);
  };
  return aiWorker;
}

/* Plugin System: Get engine for a side based on current phase */
function getEngineForSide(side) {
  const config = defaultEngineForSide[side];
  const phase = getGamePhase(state);
  
  if (config.phaseOverrides) {
    const phaseEngineId = config.phaseOverrides[phase];
    if (phaseEngineId && enginePlugins.has(phaseEngineId)) {
      return enginePlugins.get(phaseEngineId);
    }
  }
  
  if (enginePlugins.has(config.engineId)) {
    return enginePlugins.get(config.engineId);
  }
  
  return enginePlugins.get('minmax_legacy');
}

/* Plugin System: Get engine config for a side based on current phase
 * Returns { engine, depth } where depth is derived from modeSelect.
 * Used by aiMove() to set the correct search depth for each engine type.
 */
function getEngineConfig(side) {
  const engine = getEngineForSide(side);
  const mode = document.getElementById('modeSelect').value;
  const isMinMax = engine === MinMaxLegacy;
  const isMCTS = engine.name && engine.name.includes('MCTS');
  
  if (isMCTS) {
    // MCTS uses level 1-3 corresponding to depth 1-3 from modeSelect
    if (mode === 'ai_easy') return { engine, depth: 1 };
    if (mode === 'ai_medium' || mode === 'ai_vs_ai') return { engine, depth: 2 };
    if (mode === 'ai_hard') return { engine, depth: 3 };
    return { engine, depth: 2 };
  }
  
  if (isMinMax) {
    let depth = 2;
    if (mode === 'ai_easy') depth = 1;
    if (mode === 'ai_medium' || mode === 'ai_vs_ai') depth = 2;
    if (mode === 'ai_hard') depth = 3;
    return { engine, depth };
  }
  
  return { engine, depth: 2 };
}

function runAIOnMainThread(request) {
  setTimeout(() => {
    if (gameOver || request.id !== aiRequestId || !isAIThinking) {
      if (request.id === aiRequestId) isAIThinking = false;
      if (pendingAIRequest === request) pendingAIRequest = null;
      return;
    }

    let bestMove = null;
    try {
      if (typeof request.engine.search === 'function' && request.contractRequest) {
        const result = request.engine.search(request.contractRequest);
        if (!EngineContract.matchesRequest(result, request.contractRequest))
          throw new Error('Engine returned a stale or mismatched result.');
        if (result.status === ENGINE_RESULT_STATUS.FAILED)
          throw new Error(result.error && result.error.message || 'Engine search failed.');
        if (result.status === ENGINE_RESULT_STATUS.CANCELLED) {
          isAIThinking = false;
          if (pendingAIRequest === request) pendingAIRequest = null;
          status('AI search cancelled.');
          return;
        }
        if (result.status === ENGINE_RESULT_STATUS.COMPLETED) {
          bestMove = result.move;
        } else if (result.status === ENGINE_RESULT_STATUS.NO_MOVE) {
          bestMove = null;
        } else {
          throw new Error('Engine returned an unsupported result status.');
        }
      } else {
        bestMove = request.engine.getMove
          ? request.engine.getMove(clone(request.state), request.state.turn)
          : null;
      }
    } catch (error) {
      isAIThinking = false;
      if (pendingAIRequest === request) pendingAIRequest = null;
      status(`AI error: ${String(error && error.message || error)}`);
      return;
    }

    if (request.id !== aiRequestId) return;
    isAIThinking = false;
    if (pendingAIRequest === request) pendingAIRequest = null;
    if (bestMove && !allLegalState(state).some(legal => JSON.stringify(legal) === JSON.stringify(bestMove))) {
      status('AI error: engine returned an illegal move.');
      return;
    }
    if (bestMove) play(bestMove, 'pending');
    else {
      gameOver = true;
      stopAutoPlay();
      stopClock();
      status('No legal moves available.');
    }
  }, 20);
}

function handleAIWorkerFailure(worker, request) {
  // Ignore stale errors from a worker that has already been replaced.
  if (aiWorker !== worker) return;
  if (aiWorkerTimeout !== null && typeof clearTimeout === 'function') clearTimeout(aiWorkerTimeout);
  aiWorkerTimeout = null;
  aiWorker = null;
  if (worker && typeof worker.terminate === 'function') worker.terminate();

  if (!request || pendingAIRequest !== request || request.id !== aiRequestId || !isAIThinking) {
    isAIThinking = false;
    pendingAIRequest = null;
    status('AI worker error. Please try the move again.');
    return;
  }

  // Invalidate any late response from the failed worker and retry this request once.
  pendingAIRequest = null;
  request.id = ++aiRequestId;
  // A fallback is a new search attempt: issue fresh identity and snapshot data.
  if (request.contractRequest) {
    request.state = clone(state);
    request.contractRequest = EngineContract.createRequest({
      requestId: request.id,
      generation: request.id,
      engineId: request.engine.id,
      position: request.state,
      limits: {
        depth: request.depth,
        timeMs: request.contractRequest.limits.timeMs
      },
      config: request.contractRequest.config
    });
  }
  pendingAIRequest = request;
  status('AI worker failed; retrying on the main thread.');
  runAIOnMainThread(request);
}

function aiMove(){
  if (gameOver || isAIThinking) return;
  isAIThinking = true;
  status("\u23f3 AI thinking...");

  const { engine, depth } = getEngineConfig(state.turn);
  const phase = getGamePhase(state);
  const side = state.turn === 'w' ? 'White' : 'Black';
  const engineName = engine.name || 'Unknown engine';
  const id = ++aiRequestId;
  const contractRequest = typeof engine.search === 'function'
    ? EngineContract.createRequest({ requestId: id, generation: id, engineId: engine.id, position: clone(state), limits: { depth } })
    : null;
  const request = { id, engine, depth, state: clone(state), contractRequest };
  pendingAIRequest = request;
  debugLogger.add(`AI selection: ${side} | phase: ${phase} | engine: ${engineName} | depth: ${depth}`, 'info');

  const worker = ensureAIWorker();
  if (worker) {
    const workerFn = engine.name && engine.name.includes('MCTS') ? 'mctsGetMove' : 'getBestMove';
    debugLogger.add(`AI dispatch: ${side} | engine: ${engineName} | path: worker (${request.contractRequest ? 'structured protocol v1' : workerFn})`, 'info');
    try {
      aiWorkerTimeout = setTimeout(() => {
        // Only the still-active request may trigger recovery; stale watchdogs are inert.
        if (aiWorker === worker && pendingAIRequest === request && request.id === aiRequestId) {
          debugLogger.add(`AI worker timed out after ${AI_WORKER_TIMEOUT_MS} ms; retrying on the main thread.`, 'warn');
          handleAIWorkerFailure(worker, request);
        }
      }, AI_WORKER_TIMEOUT_MS);
      worker.postMessage(request.contractRequest
        ? { id: request.id, contractRequest: request.contractRequest }
        : { id: request.id, state: clone(request.state), depth, workerFn });
    } catch (error) {
      handleAIWorkerFailure(worker, request);
    }
    return;
  }
  debugLogger.add(`AI dispatch: ${side} | engine: ${engineName} | path: main thread (worker unavailable)`, 'info');
  runAIOnMainThread(request);
}

function play(m, promoChoice = 'q', silent = false){
  if (gameOver) return;
  gameStarted = true;

  const mode = document.getElementById('modeSelect').value;
  const p = state.board[m.from.r][m.from.c], mover = p.color;
  
  if (p.type === 'p' && (m.to.r === 0 || m.to.r === ROWS - 1) && (mode === 'pvp' || (isAIMode() && mode !== 'ai_vs_ai' && mover === playerColor)) && !autoPlayInterval && promoChoice === 'pending') {
    pendingPromotionMove = m;
    showPromotionModal(mover);
    return;
  }

  // Normalize the promotion choice: 'pending' (AI / auto-play sentinel) or
  // any other unknown value falls back to 'q'. 'moat' passes through.
  const promo = (promoChoice === 'moat' || ['q', 'j', 'r', 'b', 'n'].includes(promoChoice)) ? promoChoice : 'q';

  let notation = "";
  let applyResult = null;

  if (m.swap){
    const q = state.board[m.to.r][m.to.c];
    state.board[m.to.r][m.to.c] = p;
    state.board[m.from.r][m.from.c] = q;
    p.moved = true; q.moved = true;
    state.turn = other(state.turn); state.ply++; state.ep = null;
    state.halfmoveClock = (state.halfmoveClock || 0) + 1;

    const fromSq = `${String.fromCharCode(65+m.from.c)}${ROWS-m.from.r}`;
    const toSq = `${String.fromCharCode(65+m.to.c)}${ROWS-m.to.r}`;
    notation = `J ${fromSq}⇄${toSq} (${q.type.toUpperCase()})`;
  } else {
    const isPromo = p.type === 'p' && (m.to.r === 0 || m.to.r === ROWS - 1);
    applyResult = applyRaw(state, m, promo);
    const pieceLetter = p.type === 'p' ? '' : p.type.toUpperCase() + ' ';
    notation = (m.castling === 'kingside' ? "0-0" : m.castling === 'queenside' ? "0-0-0" : `${pieceLetter}${String.fromCharCode(65+m.from.c)}${ROWS-m.from.r}–${String.fromCharCode(65+m.to.c)}${ROWS-m.to.r}`);
    if (isPromo) {
      if (promo === 'moat') notation += '=MOAT';
      else notation += `=${promo.toUpperCase()}`;
    }
  }

  const destroyedColors = m.swap ? checkMoatDestructionState(state) : (applyResult ? applyResult.moatsDestroyed : []);
  for (const mc of destroyedColors) {
    const msg = `MOAT DESTROYED: ${mc==='w'?'White':'Black'}'s moat has been destroyed!`;
    status(msg);
    moveLog.push(`💥 ${msg}`);
  }
  state.moveCounts[mover]++;

  const key = getPositionKey(state);
  if (!state.positionHistory) state.positionHistory = {};
  state.positionHistory[key] = (state.positionHistory[key] || 0) + 1;

  const timeStr = `(${formatTime(state.clocks[mover])})`;
  const moveNumber = moveLog.length + 1;
  moveLog.push(`${moveNumber}. ${mover==='w'?'White':'Black'}: ${notation} ${timeStr}`);

  lastMove = {from: m.from, to: m.to};
  if (!silent) animateNextMove = true;
  pushHistorySnapshot();
  selected = null; legalTargets = [];

  if (promo === 'moat') {
    state.phase = `place_moat_${mover}`;
    state.turn = mover;
    pendingMoat = null;
    replaceLatestHistorySnapshot();
    if (!silent) {
      status(`MOAT RE-DEPLOYMENT: ${mover==='w'?'White':'Black'}'s new 1x3 moat!`);
      updateClockUI();
      render();
    }
    if (mode === 'ai_vs_ai' ? autoPlayInterval : (isAIMode() && mover !== playerColor)) {
      setTimeout(()=>aiPlaceMoatForColor(mover), getSpeed());
    }
    return;
  }

  if (state.moveCounts.w >= 4 && state.moveCounts.b >= 4 && (!state.hasPlacedMoat.w || !state.hasPlacedMoat.b)){
    if (!state.hasPlacedMoat.w){
      state.phase = 'place_moat_w';
      state.turn = 'w';
      pendingMoat = null;
      if (!silent) status("MOAT: White must place their 1x3 moat!");
      if (mode === 'ai_vs_ai' ? autoPlayInterval : (isAIMode() && playerColor === 'b')) {
        setTimeout(()=>aiPlaceMoatForColor('w'), getSpeed());
      }
    } else if (!state.hasPlacedMoat.b){
      state.phase = 'place_moat_b';
      state.turn = 'b';
      pendingMoat = null;
      if (!silent) status("MOAT: Black must place their 1x3 moat!");
      if (mode === 'ai_vs_ai' ? autoPlayInterval : (isAIMode() && playerColor === 'w')) {
        setTimeout(()=>aiPlaceMoatForColor('b'), getSpeed());
      }
    }
    replaceLatestHistorySnapshot();
    if (!silent) {
      updateClockUI();
      render();
    }
    return;
  }

  const nextMoves = allLegal(state.turn), check = inCheck(state.turn, state.board, state.moats);

  if (nextMoves.length === 0){
    gameOver = true;
    stopAutoPlay();
    stopClock();
    if (!silent) status(check ? `Checkmate! ${mover==='w'?'White':'Black'} wins.` : "Stalemate — Draw.");
  } else if (state.positionHistory[key] >= 3){
    gameOver = true;
    stopAutoPlay();
    stopClock();
    if (!silent) status("Draw by threefold repetition.");
  } else if (state.halfmoveClock >= 100){
    gameOver = true;
    stopAutoPlay();
    stopClock();
    if (!silent) status("Draw by 50-move rule.");
  } else if (isInsufficientMaterial(state)){
    gameOver = true;
    stopAutoPlay();
    stopClock();
    if (!silent) status("Draw by insufficient material.");
  } else {
    if (!silent) status(check ? `${state.turn==='w'?'White':'Black'} is in check.` : `Turn: ${state.turn==='w'?'White':'Black'}${m.swap?' — Jester swap executed.':''}`);
  }

  if (!silent) {
    updateClockUI();
    render();
    if (gameOver) showGameOverOverlay();
    // v0.4.6 fix: schedule the AI's reply even when auto-play is OFF.
    // Previously this only ran inside autoPlayInterval, so in normal
    // VS-AI games Black never moved after White — the user had to press
    // Step. ai_vs_ai stays gated on auto-play (the ▶ button starts it).
    if (!gameOver) {
      if (mode === 'ai_vs_ai') {
        if (autoPlayInterval) aiTimer = setTimeout(aiMove, getSpeed());
      } else if (isAIMode() && state.turn !== playerColor) {
        aiTimer = setTimeout(aiMove, getSpeed());
      }
    }
  }
}

function showPromotionModal(color){
  const modal = document.getElementById('promotionModal');
  const container = document.getElementById('promotionChoices');
  container.innerHTML = '';

  const pieces = ['q', 'j', 'r', 'b', 'n'];
  pieces.forEach(type => {
    const btn = document.createElement('button');
    btn.className = 'promotion-btn';
    btn.innerHTML = pieceMarkup(type, color);
    btn.title = type.toUpperCase();
    btn.addEventListener('click', ()=>{
      modal.classList.remove('active');
      const m = pendingPromotionMove;
      pendingPromotionMove = null;
      play(m, type);
    });
    container.appendChild(btn);
  });

  if (state.moatDestroyed && state.moatDestroyed[color]) {
    const moatBtn = document.createElement('button');
    moatBtn.className = 'promotion-btn moat-btn';
    moatBtn.textContent = '🌊 Deploy Moat';
    moatBtn.title = 'Replace pawn with a new 1x3 Moat';
    moatBtn.addEventListener('click', ()=>{
      modal.classList.remove('active');
      const m = pendingPromotionMove;
      pendingPromotionMove = null;
      play(m, 'moat');
    });
    container.appendChild(moatBtn);
  }

  modal.classList.add('active');
}

function confirmMoatPlacement(){
  if (!pendingMoat) return;
  const mode = document.getElementById('modeSelect').value;
  const color = state.phase.split('_')[2];
  const {r, c} = pendingMoat;
  
  state.moats[color] = {r, c};
  state.hasPlacedMoat[color] = true;
  if (state.moatDestroyed) state.moatDestroyed[color] = false;

  const col1 = String.fromCharCode(65 + c);
  const col3 = String.fromCharCode(65 + c + 2);
  const rowName = ROWS - r;
  const moveNumber = moveLog.length + 1;
  moveLog.push(`${moveNumber}. ${color==='w'?'White':'Black'}: Moat ${col1}${rowName}-${col3}${rowName} (${formatTime(state.clocks[color])})`);

  pushHistorySnapshot();
  pendingMoat = null;

  if (color==='w' && !state.hasPlacedMoat['b']){
    state.phase = 'place_moat_b';
    state.turn = 'b';
    status("MOAT: Black must place their 1x3 moat!");
    updateClockUI();
    render();
    if (mode === 'ai_vs_ai' ? autoPlayInterval : (isAIMode() && playerColor === 'w')){
      setTimeout(()=>aiPlaceMoatForColor('b'), getSpeed());
    }
  } else {
    state.phase = 'normal';
    state.turn = other(color);
    updateClockUI();
    render();
    status(`Turn: ${state.turn==='w'?'White':'Black'}`);
    if ((mode === 'ai_vs_ai' ? autoPlayInterval : (isAIMode() && state.turn !== playerColor)) && !gameOver) {
      aiTimer = setTimeout(aiMove, getSpeed());
    }
  }
  replaceLatestHistorySnapshot();
}

function aiPlaceMoatForColor(color, silent = false){
  gameStarted = true;
  const mode = document.getElementById('modeSelect').value;

  const validRows = color === 'w' ? [4, 5] : [2, 3];
  const r = validRows[Math.floor(Math.random() * validRows.length)];
  const c = Math.floor(Math.random() * 6) + 1;
  state.moats[color] = {r, c};
  state.hasPlacedMoat[color] = true;
  if (state.moatDestroyed) state.moatDestroyed[color] = false;

  const col1 = String.fromCharCode(65 + c);
  const col3 = String.fromCharCode(65 + c + 2);
  const rowName = ROWS - r;
  const moveNumber = moveLog.length + 1;
  moveLog.push(`${moveNumber}. ${color==='w'?'White':'Black'}: Moat ${col1}${rowName}-${col3}${rowName} (${formatTime(state.clocks[color])})`);

  pushHistorySnapshot();

  if (color === 'w' && !state.hasPlacedMoat['b']){
    state.phase = 'place_moat_b';
    state.turn = 'b';
    if (!silent) {
      status("MOAT: Black must place their 1x3 moat!");
      updateClockUI();
      render();
    }
    if (mode === 'ai_vs_ai' ? autoPlayInterval : (isAIMode() && playerColor === 'w')){
      setTimeout(()=>aiPlaceMoatForColor('b'), getSpeed());
    }
  } else {
    state.phase = 'normal';
    state.turn = other(color);
    if (!silent) {
      updateClockUI();
      render();
      status(`Turn: ${state.turn==='w'?'White':'Black'} (Moats deployed)`);
      if ((mode === 'ai_vs_ai' ? autoPlayInterval : (isAIMode() && state.turn !== playerColor)) && !gameOver) {
        aiTimer = setTimeout(aiMove, getSpeed());
      }
    }
  }
  replaceLatestHistorySnapshot();
}

function toggleEditor(){
  stopAutoPlay();
  clearTimeout(aiTimer);
  isAIThinking = false;
  editMode = !editMode;
  const panel = document.getElementById('editorPanel');
  const toggleBtn = document.getElementById('editorToggleBtn');
  
  if (editMode){
    panel.classList.add('active');
    setEditorToggleLabel('Resume Game');
    document.getElementById('editorClockW').value = formatTime(state.clocks.w);
    document.getElementById('editorClockB').value = formatTime(state.clocks.b);
    status("BOARD EDITOR ACTIVE: Select pieces/tools or adjust clocks below.");
    selected = null; legalTargets = [];
  } else {
    panel.classList.remove('active');
    setEditorToggleLabel('Edit Board');
    status(`Game Resumed. Turn: ${state.turn==='w'?'White':'Black'}`);
  }
  render();
}

function handleEditorClick(r, c){
  if (activeTool === 'eraser'){
    state.board[r][c] = null;
  } else if (activeTool === 'w_moat'){
    const targetRow = (r === 4 || r === 5) ? r : 4;
    const startC = Math.max(1, Math.min(c - 1, COLS - 4));
    state.moats.w = { r: targetRow, c: startC };
    state.hasPlacedMoat.w = true;
  } else if (activeTool === 'b_moat'){
    const targetRow = (r === 2 || r === 3) ? r : 3;
    const startC = Math.max(1, Math.min(c - 1, COLS - 4));
    state.moats.b = { r: targetRow, c: startC };
    state.hasPlacedMoat.b = true;
  } else {
    const [color, type] = activeTool.split('_');
    state.board[r][c] = makePiece(type, color);
  }
  render();
}

/* Treat a loaded editor position as a new game for castling rights. */
function initializeEditorCastlingRights(board){
  for (let r = 0; r < ROWS; r++){
    for (let c = 0; c < COLS; c++){
      const p = board[r][c];
      if (!p) continue;
      const homeRow = p.color === 'w' ? ROWS - 1 : 0;
      if (r !== homeRow) continue;
      if (p.type === 'k' && c === 5) p.moved = false;
      if (p.type === 'r' && (c === 0 || c === COLS - 1)) p.moved = false;
    }
  }
}

function validateAndPlayPosition(){
  let wKings = 0, bKings = 0;
  for (let r = 0; r < ROWS; r++){
    for (let c = 0; c < COLS; c++){
      const p = state.board[r][c];
      if (p && p.type === 'k'){
        if (p.color === 'w') wKings++;
        if (p.color === 'b') bKings++;
      }
    }
  }

  if (wKings !== 1 || bKings !== 1){
    alert(`Invalid Position!\nBoth White and Black must have exactly ONE King.\nFound: White Kings = ${wKings}, Black Kings = ${bKings}`);
    return;
  }

  const turn = document.getElementById('editorTurnSelect').value;
  state.turn = turn;

  if (inCheck(other(turn), state.board, state.moats)){
    alert(`Invalid Position!\nThe side NOT to move (${other(turn)==='w'?'White':'Black'}) is currently in check, which is illegal.`);
    return;
  }

  initializeEditorCastlingRights(state.board);

  const parsedW = parseClockString(document.getElementById('editorClockW').value);
  const parsedB = parseClockString(document.getElementById('editorClockB').value);
  if (parsedW !== null) state.clocks.w = parsedW;
  if (parsedB !== null) state.clocks.b = parsedB;

  editMode = false;
  document.getElementById('editorPanel').classList.remove('active');
  setEditorToggleLabel('Edit Board');
  gameStarted = true;
  moveLog = ["1. Position & clocks set via Board Editor."];
  history = [clone(state)];
  historyMoveLogs = [moveLog.slice()];
  redoStack = [];
  selected = null; legalTargets = [];
  status(`Custom position loaded! Game started. Turn: ${state.turn==='w'?'White':'Black'}`);
  updateClockUI();
  render();

  const mode = document.getElementById('modeSelect').value;
  if (mode === 'ai_vs_ai' ? autoPlayInterval : (isAIMode() && state.turn !== playerColor)){
    aiTimer = setTimeout(aiMove, getSpeed());
  }
}

function clearBoard(){
  state.board = Array.from({length: ROWS}, () => Array(COLS).fill(null));
  state.moats = {w: null, b: null};
  render();
}

function resetDefaultBoard(){
  const pos = document.getElementById("jesterPosSelect").value;
  let back = ['r','j','n','b','q','k','b','n','j','r'];
  if (pos === "center") back = ['r','n','b','j','q','k','j','b','n','r'];
  
  const b = Array.from({length: ROWS}, () => Array(COLS).fill(null));
  for (let c = 0; c < COLS; c++){
    b[0][c] = makePiece(back[c], 'b');
    b[1][c] = makePiece('p', 'b');
    b[ROWS-2][c] = makePiece('p', 'w');
    b[ROWS-1][c] = makePiece(back[c], 'w');
  }
  state.board = b;
  state.moats = {w: null, b: null};

  const initialTime = parseInt(document.getElementById('timeSelect').value, 10);
  state.clocks = { w: initialTime, b: initialTime };
  document.getElementById('editorClockW').value = formatTime(initialTime);
  document.getElementById('editorClockB').value = formatTime(initialTime);

  render();
}

function getSpeed(){ return parseInt(document.getElementById('speedSelect').value, 10) || 500; }

function stepNextMove(){
  stopAutoPlay();
  if (gameOver || isAIThinking) return;
  if (state.phase.startsWith('place_moat')){
    const color = state.phase.split('_')[2];
    aiPlaceMoatForColor(color);
  } else {
    aiMove();
  }
}

function generateRandomMidgame(){
  setup();
  gameStarted = true;
  const targetPly = Math.floor(Math.random() * 9) + 12;

  for (let i = 0; i < targetPly && !gameOver; i++) {
    if (state.phase.startsWith('place_moat')) {
      const color = state.phase.split('_')[2];
      aiPlaceMoatForColor(color, true);
    } else {
      const moves = allLegal(state.turn);
      if (moves.length === 0) { gameOver = true; break; }
      const randomMove = moves[Math.floor(Math.random() * moves.length)];
      play(randomMove, 'q', true);
    }
  }

  if (gameOver || allLegal(state.turn).length === 0) {
    setup();
    generateRandomMidgame();
    return;
  }

  redoStack = [];
  updateClockUI();
  startClock();
  render();
  status(`Random midgame generated (${moveLog.length} moves). Turn: ${state.turn === 'w' ? 'White' : 'Black'}`);
}

function toggleAutoPlay(){
  if (autoPlayInterval){
    stopAutoPlay();
    status("Game Paused.");
    updateClockUI();
  } else {
    document.getElementById('autoBtn').textContent = 'Ⅱ';
    document.getElementById('autoBtn').setAttribute('aria-label', 'Pause auto-play');
    gameStarted = true;
    status("Game Running / Auto-play active...");
    autoPlayInterval = setInterval(() => {
      if (gameOver){ stopAutoPlay(); return; }
      if (state.phase.startsWith('place_moat')){
        const color = state.phase.split('_')[2];
        aiPlaceMoatForColor(color);
      } else if (!isAIThinking) {
        aiMove();
      }
    }, getSpeed());
    updateClockUI();
  }
}

function updateDashboard(){
  if (!state.captured) state.captured = {w:[], b:[]};
  if (!state.captured.w) state.captured.w = [];
  if (!state.captured.b) state.captured.b = [];

  const jesterVal = getJesterValue(state);
  const pieceValues = { p: 1.0, n: 3.0, b: 3.5, r: 5.0, q: 9.5, k: 0, j: jesterVal };

  document.getElementById('moveCounter').textContent = moveLog.length;

  let whiteBoardVal = 0, blackBoardVal = 0;
  for (let r = 0; r < ROWS; r++){
    for (let c = 0; c < COLS; c++){
      const p = state.board[r][c];
      if (p){
        const v = pieceValues[p.type] || 0;
        if (p.color === 'w') whiteBoardVal += v;
        else blackBoardVal += v;
      }
    }
  }

  const wStr = `${whiteBoardVal % 1 === 0 ? whiteBoardVal : whiteBoardVal.toFixed(1)} pts`;
  const bStr = `${blackBoardVal % 1 === 0 ? blackBoardVal : blackBoardVal.toFixed(1)} pts`;

  document.getElementById('whiteBoardPoints').textContent = wStr;
  document.getElementById('blackBoardPoints').textContent = bStr;

  const totalVal = whiteBoardVal + blackBoardVal;
  let whitePercent = 50;
  if (totalVal > 0) {
    whitePercent = Math.max(5, Math.min(95, (whiteBoardVal / totalVal) * 100));
  }
  document.getElementById('evalFillWhite').style.height = `${whitePercent}%`;
  document.getElementById('evalFillBlack').style.height = `${100 - whitePercent}%`;

  const whiteCapEl = document.getElementById('capturedByWhite');
  const blackCapEl = document.getElementById('capturedByBlack');
  whiteCapEl.innerHTML = ''; blackCapEl.innerHTML = '';

  state.captured.w.forEach(p => {
    const span = document.createElement('span');
    span.className = 'captured-piece';
    span.innerHTML = pieceMarkup(p.type, p.color);
    whiteCapEl.appendChild(span);
  });

  state.captured.b.forEach(p => {
    const span = document.createElement('span');
    span.className = 'captured-piece';
    span.innerHTML = pieceMarkup(p.type, p.color);
    blackCapEl.appendChild(span);
  });
}

function render(){
  const el = document.getElementById('board'); el.innerHTML = '';
  const coordsChk = document.getElementById('coordsToggle');
  el.classList.toggle('hide-coords', !(coordsChk ? coordsChk.checked : true));
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++){
    const sq = document.createElement('div'); sq.className = 'square ' + ((r + c) % 2 === 0 ? 'light' : 'dark'); sq.setAttribute('role', 'gridcell');
    sq.dataset.r = r; sq.dataset.c = c;
    
    const moatOwner = isMoatCell(r, c);
    if (moatOwner === 'w') sq.classList.add('moat-w');
    else if (moatOwner === 'b') sq.classList.add('moat-b');

    if (pendingMoat && pendingMoat.r === r && (c >= pendingMoat.c && c <= pendingMoat.c + 2)) {
      const phaseColor = state.phase.split('_')[2];
      sq.classList.add(phaseColor === 'w' ? 'moat-preview-w' : 'moat-preview-b');
    }

    if (lastMove && ((lastMove.from.r === r && lastMove.from.c === c) || (lastMove.to.r === r && lastMove.to.c === c))){
      sq.classList.add('last-move');
    }

    if (selected && selected.r === r && selected.c === c) sq.classList.add('selected');
    const move = legalTargets.find(m => m.to.r === r && m.to.c === c); if (move){ sq.classList.add('valid'); if (state.board[r][c]) sq.classList.add('capture'); if (move.swap) sq.classList.add('swap-target'); }
    
    const p = state.board[r][c];
    if (p){
      sq.innerHTML = pieceMarkup(p.type, p.color);
    }
    
    if (c === 0){ const x = document.createElement('span'); x.className = 'coord row'; x.textContent = ROWS - r; sq.appendChild(x); }
    if (r === ROWS - 1){ const x = document.createElement('span'); x.className = 'coord col'; x.textContent = String.fromCharCode(65 + c); sq.appendChild(x); }
    
    sq.addEventListener('click', () => clickSquare(r, c));
    el.appendChild(sq);
  }

  // Check indicator: red glow on the king in check
  if (!editMode && inCheck(state.turn, state.board, state.moats)) {
    const kp = kingPos(state.turn);
    const ksq = el.children[kp.r * COLS + kp.c];
    if (ksq) ksq.classList.add('in-check');
  }

  // Slide animation for the piece that just moved (FLIP; ~150ms)
  if (animateNextMove && lastMove) {
    animateNextMove = false;
    const fromSq = el.children[lastMove.from.r * COLS + lastMove.from.c];
    const toSq = el.children[lastMove.to.r * COLS + lastMove.to.c];
    const glyph = toSq ? (toSq.querySelector('.piece') || toSq.querySelector('.piece-glyph') || toSq.querySelector('.jester-icon')) : null;
    if (fromSq && toSq && glyph && glyph.innerHTML !== '') {
      let dx = fromSq.getBoundingClientRect().left - toSq.getBoundingClientRect().left;
      let dy = fromSq.getBoundingClientRect().top - toSq.getBoundingClientRect().top;
      if (el.classList.contains('flipped')) { dx = -dx; dy = -dy; }
      if (dx || dy) {
        glyph.style.transition = 'none';
        glyph.style.transform = `translate(${dx}px, ${dy}px)`;
        requestAnimationFrame(() => requestAnimationFrame(() => {
          glyph.style.transition = 'transform 150ms ease-out';
          glyph.style.transform = '';
          setTimeout(() => { glyph.style.transition = ''; }, 200);
        }));
      }
    }
  }

  renderMoveList();
  document.getElementById('undoBtn').disabled = history.length <= 1 || editMode;
  document.getElementById('redoBtn').disabled = redoStack.length === 0 || editMode;

  const confirmBtn = document.getElementById('confirmMoatBtn');
  if (confirmBtn) {
    confirmBtn.style.display = (pendingMoat && !editMode) ? 'inline-flex' : 'none';
  }

  updateDashboard();
}

function clickSquare(r, c){
  if (gameOver) return;
  const mode = document.getElementById('modeSelect').value;

  if (editMode){
    handleEditorClick(r, c);
    return;
  }

  if (state.phase.startsWith('place_moat')){
    const color = state.phase.split('_')[2];
    if (state.turn === color && (mode === 'pvp' || color === playerColor)){
      const validRows = color === 'w' ? [4, 5] : [2, 3];
      const targetRow = validRows.includes(r) ? r : validRows[0];
      const startC = Math.max(1, Math.min(c - 1, COLS - 4));
      pendingMoat = { r: targetRow, c: startC };
      render();
      status(`Moat preview: ${String.fromCharCode(65+startC)}${ROWS-targetRow}–${String.fromCharCode(65+startC+2)}${ROWS-targetRow}. Click 'Confirm Moat' to finalize.`);
    }
    return;
  }

  if (mode === 'ai_vs_ai' || (isAIMode() && state.turn !== playerColor)) return;
  
  if (selected){ const m = legalTargets.find(m => m.to.r === r && m.to.c === c); if (m){ play(m, 'pending'); return; } }
  const p = state.board[r][c]; if (p && p.color === state.turn){ selected = {r, c}; legalTargets = legalMovesFrom(r, c); render(); } else { selected = null; legalTargets = []; render(); }
}

function undo(){
  cancelActiveAIRequest('undo');
  stopAutoPlay();
  clearTimeout(aiTimer);
  isAIThinking = false;
  if (history.length <= 1 || editMode) return;

  if (!undoHistoryStep()) return;

  gameStarted = (history.length > 1);
  selected = null; legalTargets = []; lastMove = null; pendingMoat = null;
  hideGameOverOverlay();
  status(`Turn: ${state.turn === 'w' ? 'White' : 'Black'}`);
  lastClockTickTime = performance.now();
  updateClockUI();
  render();
}

function redo(){
  cancelActiveAIRequest('redo');
  stopAutoPlay();
  clearTimeout(aiTimer);
  if (redoStack.length === 0 || editMode) return;

  if (!redoHistoryStep()) return;
  
  gameStarted = true;
  selected = null; legalTargets = []; pendingMoat = null;
  if (!gameOver) {
    hideGameOverOverlay();
    status(`Turn: ${state.turn === 'w' ? 'White' : 'Black'}`);
  }
  lastClockTickTime = performance.now();
  updateClockUI();
  render();
  if (gameOver) showGameOverOverlay();
}

document.getElementById('exportFileBtn').addEventListener('click', () => {
  const data = JSON.stringify(exportGameData(), null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `jester_chess_10x8_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('importFileBtn').addEventListener('click', () => {
  stopAutoPlay();
  document.getElementById('fileInput').click();
});

function applyLoadedGame(parsed) {
  // Loading a saved position replaces the authoritative state; any in-flight
  // engine request belongs to the old position and must not race the import.
  cancelActiveAIRequest('load-saved-game');
  state = parsed.state;
  gameStarted = parsed.gameStarted;
  playerColor = parsed.playerColor;
  document.getElementById('playerSideSelect').value = playerColor;
  const boardEl = document.getElementById('board');
  if (playerColor === 'b') boardEl.classList.add('flipped');
  else boardEl.classList.remove('flipped');
  moveLog = parsed.moveLog;
  history = parsed.history;
  historyMoveLogs = parsed.historyMoveLogs;
  redoStack = [];
  gameOver = parsed.gameOver;
  gameOverMessage = parsed.gameOverMessage;
  selected = null; legalTargets = []; lastMove = null; pendingMoat = null;
}

document.getElementById('fileInput').addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e){
    try {
      const initialTime = parseInt(document.getElementById('timeSelect').value, 10) || 0;
      const parsed = parseGameData(e.target.result, initialTime);
      applyLoadedGame(parsed);
      lastClockTickTime = performance.now();
      updateClockUI();
      render();
      if (gameOver) {
        status(gameOverMessage || 'Game over.');
        showGameOverOverlay();
      } else {
        hideGameOverOverlay();
        status("Game state loaded from file successfully!");
      }
    } catch(err) {
      alert("Could not parse JSON file.");
    }
  };
  reader.readAsText(file);
  event.target.value = '';
});

document.getElementById('optionsToggleBtn').addEventListener('click', () => {
  const drawer = document.getElementById('optionsDrawer');
  drawer.classList.toggle('open');
  document.getElementById('infoDrawer').classList.remove('open');
});

document.getElementById('infoToggleBtn').addEventListener('click', () => {
  const drawer = document.getElementById('infoDrawer');
  drawer.classList.toggle('open');
  document.getElementById('optionsDrawer').classList.remove('open');
});

document.querySelectorAll('.palette-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.palette-btn').forEach(b => b.classList.remove('selected'));
    const target = e.currentTarget;
    target.classList.add('selected');
    activeTool = target.dataset.tool;
  });
});

document.getElementById('editorToggleBtn').addEventListener('click', toggleEditor);
document.getElementById('playPositionBtn').addEventListener('click', validateAndPlayPosition);
document.getElementById('clearBoardBtn').addEventListener('click', () => {
  const hasPieces = state.board.some(row => row.some(p => p));
  if (hasPieces && !confirm('Clear the board?')) return;
  clearBoard();
});
document.getElementById('resetDefaultBoardBtn').addEventListener('click', resetDefaultBoard);

document.getElementById('undoBtn').addEventListener('click', undo);
document.getElementById('redoBtn').addEventListener('click', redo);
document.getElementById('confirmMoatBtn').addEventListener('click', confirmMoatPlacement);
document.getElementById('stepBtn').addEventListener('click', stepNextMove);
document.getElementById('autoBtn').addEventListener('click', toggleAutoPlay);
document.getElementById('randomBtn').addEventListener('click', generateRandomMidgame);
document.getElementById('sideSwitchBtn').addEventListener('click', () => {
  if (document.getElementById('modeSelect').value === 'ai_vs_ai') return;
  cancelActiveAIRequest('side-switch');
  playerColor = playerColor === 'w' ? 'b' : 'w';
  const sideSelect = document.getElementById('playerSideSelect');
  if (sideSelect) sideSelect.value = playerColor;
  const boardEl = document.getElementById('board');
  const mode = document.getElementById('modeSelect').value;
  if (mode !== 'ai_vs_ai') boardEl.classList.toggle('flipped', playerColor === 'b');
  selected = null; legalTargets = [];
  render();
  status(`Player side switched to ${playerColor === 'w' ? 'White' : 'Black'}.`);
  if (isAIMode() && state && state.turn !== playerColor && !gameOver) {
    aiTimer = setTimeout(aiMove, getSpeed());
  }
});

document.getElementById('resetBtn').addEventListener('click', () => {
  if (gameStarted && !gameOver && moveLog.length > 0 && !confirm('Start a new game? The current game will be lost.')) return;
  cancelActiveAIRequest('reset-button');
  setup();
});
document.getElementById('modeSelect').addEventListener('change', () => { saveOptions(); setup(); });document.getElementById('playerSideSelect').addEventListener('change', () => { saveOptions(); setup(); });
document.getElementById('timeSelect').addEventListener('change', () => { saveOptions(); setup(); });
document.getElementById('jesterPosSelect').addEventListener('change', () => { saveOptions(); setup(); });
document.getElementById('uiDisplaySelect').addEventListener('change', () => { saveOptions(); updateDisplayPreferences(); });

document.getElementById('speedSelect').addEventListener('change', () => {
  saveOptions();
  if (autoPlayInterval){ toggleAutoPlay(); toggleAutoPlay(); }
});

window.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z'){
    e.preventDefault();
    if (e.shiftKey) redo(); else undo();
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y'){
    e.preventDefault(); redo();
  }
});

/* === v0.4.6: Move list (two-column notation) === */
function renderMoveList(){
  const el = document.getElementById('history');
  if (!moveLog.length){ el.textContent = 'No moves yet.'; return; }
  el.textContent = '';
  const rowRe = /^(\d+)\.\s(White|Black):\s(.*)$/;
  const rows = [];
  let pending = null;
  const flushPending = () => { if (pending){ rows.push(pending); pending = null; } };
  for (const line of moveLog){
    const m = line.match(rowRe);
    if (!m){ flushPending(); rows.push({ note: line }); continue; }
    let text = m[3].replace(/\s*\((\d+:)?\d{2}:\d{2}\)\s*$/, '').trim();
    // Fix historical double piece letter on promotions ("Q E7–F8=Q" → "E7–F8=Q")
    text = text.replace(/^([KQRBJN])\s+([A-J]\d+.*)=(MOAT|[A-Z])$/, '$2=$3');
    if (m[2] === 'White'){
      flushPending();
      pending = { n: m[1] + '.', w: text, b: '' };
    } else {
      if (pending) { pending.b = text; rows.push(pending); pending = null; }
      else rows.push({ n: m[1] + '.', w: '', b: text });
    }
  }
  flushPending();
  const displayRows = historyOrder === 'newest' ? rows.reverse() : rows;
  for (const r of displayRows){
    const div = document.createElement('div');
    if (r.note){ div.className = 'mv-row'; div.innerHTML = `<span class="mv-note">${r.note}</span>`; }
    else {
      div.className = 'mv-row';
      const n = document.createElement('span'); n.className = 'mv-n'; n.textContent = r.n;
      const w = document.createElement('span'); w.className = 'mv-w'; w.textContent = r.w;
      const b = document.createElement('span'); b.className = 'mv-b'; b.textContent = r.b;
      div.append(n, w, b);
    }
    el.appendChild(div);
  }
  el.scrollTop = historyOrder === 'newest' ? 0 : el.scrollHeight;
}

let historyOrder = 'oldest';
const historyOrderSelect = document.getElementById('historyOrderSelect');
try {
  const savedHistoryOrder = localStorage.getItem('jm_history_order_v1');
  if (savedHistoryOrder === 'newest' || savedHistoryOrder === 'oldest') historyOrder = savedHistoryOrder;
} catch (err) { /* storage unavailable; use the default order */ }
if (historyOrderSelect) {
  historyOrderSelect.value = historyOrder;
  historyOrderSelect.addEventListener('change', () => {
    historyOrder = historyOrderSelect.value === 'newest' ? 'newest' : 'oldest';
    try { localStorage.setItem('jm_history_order_v1', historyOrder); } catch (err) { /* ignore unavailable storage */ }
    renderMoveList();
  });
}

/* === v0.4.6: Game-over overlay === */
function showGameOverOverlay(){
  const ov = document.getElementById('gameOverOverlay');
  document.getElementById('overlayText').textContent = document.getElementById('status').textContent;
  ov.hidden = false;
}
function hideGameOverOverlay(){
  const ov = document.getElementById('gameOverOverlay');
  if (ov) ov.hidden = true;
}
document.getElementById('overlayNewBtn').addEventListener('click', () => { hideGameOverOverlay(); setup(); });
document.getElementById('overlayCloseBtn').addEventListener('click', hideGameOverOverlay);

/* === v0.4.6: Options persistence (localStorage) === */
function saveOptions(){
  try {
    localStorage.setItem('jm_opts_v1', JSON.stringify({
      mode: document.getElementById('modeSelect').value,
      side: document.getElementById('playerSideSelect').value,
      time: document.getElementById('timeSelect').value,
      jpos: document.getElementById('jesterPosSelect').value,
      speed: document.getElementById('speedSelect').value,
      disp: document.getElementById('uiDisplaySelect').value,
      coords: (document.getElementById('coordsToggle').checked ? '1' : '0'),
      showModeIndicator: (document.getElementById('showModeIndicatorToggle').checked ? '1' : '0'),
      theme: document.getElementById('themeSelect').value,
      boardStyle: document.getElementById('boardStyleSelect').value,
      pieceSet: activePieceSet,
      pieceSetVersion: 4
    }));
  } catch(err) { /* storage unavailable (private mode etc.) — ignore */ }
}
function loadOptions(){
  try {
    const o = JSON.parse(localStorage.getItem('jm_opts_v1') || 'null');
    if (!o) return;
    const setVal = (id, v) => { const el = document.getElementById(id); if (el && v !== undefined && el.querySelector(`option[value="${v}"]`)) el.value = v; };
    setVal('modeSelect', o.mode); setVal('playerSideSelect', o.side); setVal('timeSelect', o.time);
    setVal('jesterPosSelect', o.jpos); setVal('speedSelect', o.speed); setVal('uiDisplaySelect', o.disp);
    setVal('themeSelect', o.theme);
    setVal('boardStyleSelect', o.boardStyle);
    setVal('pieceSetSelect', o.pieceSetVersion === 4 && o.pieceSet === 'flat' ? 'flat' : 'classic');
    activePieceSet = document.getElementById('pieceSetSelect').value;
    if (o.coords !== undefined) document.getElementById('coordsToggle').checked = (o.coords === '1');
    document.getElementById('showModeIndicatorToggle').checked = o.showModeIndicator === undefined ? true : o.showModeIndicator === '1';
  } catch(err) { /* ignore */ }
}

document.getElementById('coordsToggle').addEventListener('change', () => { saveOptions(); render(); });
document.getElementById('showModeIndicatorToggle').addEventListener('change', () => { saveOptions(); updateModeUI(); });

/* === v0.4.6: Theme switcher (Auto / Light / Dark) === */
let themeMq = null;
function applyTheme(){
  const pref = document.getElementById('themeSelect').value;
  if (themeMq) { themeMq.removeEventListener('change', themeMqListener); themeMq = null; }
  if (pref === 'light') {
    document.documentElement.classList.remove('theme-dark');
  } else if (pref === 'dark') {
    document.documentElement.classList.add('theme-dark');
  } else { // auto: follow OS, live
    if (window.matchMedia) {
      themeMq = window.matchMedia('(prefers-color-scheme: dark)');
      if (themeMq.matches) document.documentElement.classList.add('theme-dark');
      else document.documentElement.classList.remove('theme-dark');
      themeMq.addEventListener('change', themeMqListener);
    }
  }
}
function themeMqListener(e){
  document.documentElement.classList.toggle('theme-dark', e.matches);
}
document.getElementById('themeSelect').addEventListener('change', () => { applyTheme(); saveOptions(); });
const boardStyleSelect = document.getElementById('boardStyleSelect');
function applyBoardStyle() {
  document.documentElement.dataset.boardStyle = boardStyleSelect.value;
}
boardStyleSelect.addEventListener('change', () => { applyBoardStyle(); saveOptions(); });
document.getElementById('pieceSetSelect').addEventListener('change', () => {
  activePieceSet = document.getElementById('pieceSetSelect').value === 'flat' ? 'flat' : 'classic';
  renderPalettePieces();
  render();
  saveOptions();
});

loadOptions();

/* Debug Panel Event Listeners */
const debugClearBtn = document.getElementById('debugClearBtn');
const debugDownloadBtn = document.getElementById('debugDownloadBtn');
const debugToggleBtn = document.getElementById('debugToggleBtn');

if (debugClearBtn) debugClearBtn.addEventListener('click', () => debugLogger.clear());
if (debugDownloadBtn) debugDownloadBtn.addEventListener('click', () => debugLogger.download());
if (debugToggleBtn) debugToggleBtn.addEventListener('click', () => { debugLogger.toggleAutoScroll(); debugToggleBtn.textContent = `Auto-scroll: ${debugLogger.autoScroll ? 'On' : 'Off'}`; });
if (debugToggleBtn) debugToggleBtn.textContent = `Auto-scroll: ${debugLogger.autoScroll ? 'On' : 'Off'}`;

// Debug mode toggle is part of the Debug & Diagnostics section in the markup.
const debugModeToggle = document.getElementById('debugModeToggle');
if (debugModeToggle) {
  debugModeToggle.addEventListener('change', (e) => e.target.checked ? debugLogger.enable() : debugLogger.disable());
  debugModeToggle.checked = debugLogger.enabled;
}

/* Collapsible Sections in Options Drawer */
function initCollapsibleSections() {
  document.querySelectorAll('.collapsible-section').forEach(section => {
    const header = section.querySelector('.section-header');
    const toggle = section.querySelector('.section-toggle');
    if (!header || !toggle || section.dataset.collapseReady === 'true') return;
    section.dataset.collapseReady = 'true';

    const setCollapsed = (collapsed) => {
      section.classList.toggle('collapsed', collapsed);
      header.setAttribute('aria-expanded', String(!collapsed));
      toggle.textContent = collapsed ? '▸' : '▾';
    };

    if (window.innerWidth <= 768) setCollapsed(true);
    else setCollapsed(false);

    header.addEventListener('click', (event) => {
      if (event.target.closest('button, input, select, a')) return;
      setCollapsed(!section.classList.contains('collapsed'));
    });
    toggle.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      setCollapsed(!section.classList.contains('collapsed'));
    });
    header.addEventListener('keydown', (event) => {
      if (event.target !== header || (event.key !== 'Enter' && event.key !== ' ')) return;
      event.preventDefault();
      setCollapsed(!section.classList.contains('collapsed'));
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCollapsibleSections, { once: true });
} else {
  initCollapsibleSections();
}

window.addEventListener('resize', () => {
  if (window.innerWidth > 768) {
    document.querySelectorAll('.collapsible-section').forEach(section => {
      section.classList.remove('collapsed');
      const header = section.querySelector('.section-header');
      const toggle = section.querySelector('.section-toggle');
      if (header) header.setAttribute('aria-expanded', 'true');
      if (toggle) toggle.textContent = '▾';
    });
  }
});

applyTheme();
applyBoardStyle();
renderPalettePieces();
setup();
