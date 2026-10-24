/* ============================================================ */
/*                                                          *;
 *  Jester & Moat — 10x8 chess variant / pass & play + AI  *;
 *                                                          *;
 *  Board shouts are 0-based internally:                       *;
 *    r: 0 = Black back rank   (rows 0..3  = Black side)      *;
 *    r: 7 = White back rank   (rows 4..7  = White side)      *;
 *    c: 0 = A, ..., 9 = J.                                   *;
 *    Board display is 1-based for players:                    *;
 *    rank 8 = r=0 (Black back), rank 1 = r=7 (White back).  *;
 *    file A = c=0 ... file J = c=9.                          *;
 *                                                          *;
 *  In the board editor the same coordinate model is used.    *;
 * ============================================================ */

'use strict';

/* ================================================================
 *  CONSTANTS + STATE (the only top-level mutable-ish state)
 * ================================================================ */

const ROWS = 8, COLS = 10;
const PIECE_SYMBOLS = ['♚','♛','♜','♝','♞','♟','🃏'];
const PIECE_NAMES   = ['k','q','r','b','n','p','j'];

let state = null;
let history = [];
let redoStack = [];
let moveLog = [];
let gameStarted = false;
let gameOver = false;
let playerColor = 'w';
let selected = null;
let legalTargets = [];
let lastMove = null;
let pendingMoat = null;
let editMode = false;
let activeTool = 'eraser';
let activePieceSet = 'classic';
let isAIThinking = false;
let aiRequestId = 0;
let aiTimer = null;
let autoPlayInterval = null;
let lastClockTickTime = 0;
let animateNextMove = false;

function makePiece(type, color) {
  return { type, color, moved: false };
}

/* ================================================================
 *  RENDER HELPERS
 * ================================================================ */

function pieceMarkup(type, color) {
  let idx = PIECE_NAMES.indexOf(type);
  if (idx === -1) idx = 5; // fallback to pawn symbol
  const sym = PIECE_SYMBOLS[idx];

  // Knight & Jester get character-based styling (so we can switch
  // between classic/flat via a single attribute, not a separate
  // sprite path per piece).
  if (type === 'n') {
    return `<span class="piece knight" style="color:${color==='w'?'#fff':'#111'};text-shadow:${color==='w'?'0 0 2px rgba(0,0,0,0.9)':'none'};">${sym}</span>`;
  }
  if (type === 'j') {
    return `<span class="piece jester" style="color:${color==='w'?'#fff8e1':'#1a1a1a'};${color==='w'?'text-shadow:0 0 4px rgba(0,0,0,0.95);':''}">${sym}</span>`;
  }

  // King, Queen, Rook, Bishop, Pawn → sprite-based
  return `<span class="piece"><svg class="piece-icon"><use href="#p-${type}${color==='w'?'-white':''-black'}"></use></svg></span>`;
}

function renderPalettePieces() {
  const whitePalette = document.getElementById('whitePalette');
  const blackPalette = document.getElementById('blackPalette');
  if (!whitePalette || !blackPalette) return;

  const fragW = document.createDocumentFragment();
  const fragB = document.createDocumentFragment();
  let wKingAdded = false, bKingAdded = false;
  for (let idx = 0; idx < PIECE_NAMES.length; idx++) {
    const type = PIECE_NAMES[idx];
    const sym = PIECE_SYMBOLS[idx];

    const wp = document.createElement('button');
    wp.className = 'palette-btn white-piece';
    wp.dataset.tool = `w_${type}`;
    wp.innerHTML = sym;
    fragW.appendChild(wp);

    const bp = document.createElement('button');
    bp.className = 'palette-btn black-piece';
    bp.dataset.tool = `b_${type}`;
    bp.innerHTML = sym;
    fragB.appendChild(bp);
  }

  // Ensure king button exists (already added by loop above)
  whitePalette.innerHTML = '';
  blackPalette.innerHTML = '';
  whitePalette.appendChild(fragW);
  blackPalette.appendChild(fragB);
}

/* ================================================================
 *  BOARD INIT
 * ================================================================ */

function setup() {
  state = {
    board: Array.from({ length: ROWS }, () => Array(COLS).fill(null)),
    moats: { w: null, b: null },
    turn: 'w',
    clocks: { w: 0, b: 0 },
    captured: { w: [], b: [] },
    halfmoveClock: 0,
    ply: 0,
    hasPlacedMoat: { w: false, b: false },
    phase: 'opening'
  };

  // Default starting position
  const pos = document.getElementById('jesterPosSelect').value;
  let backRank = ['r','j','n','b','q','k','b','n','j','r'];
  if (pos === 'center') {
    backRank = ['r','n','b','j','q','k','j','b','n','r'];
  }

  for (let c = 0; c < COLS; c++) {
    state.board[0][c]  = makePiece(backRank[c], 'b');
    state.board[1][c]  = makePiece('p', 'b');
    state.board[6][c]  = makePiece('p', 'w');
    state.board[7][c]  = makePiece(backRank[c], 'w');
  }

  state.clocks = { w: 900, b: 900 };
  gameStarted = false;
  gameOver = false;
  selected = null;
  legalTargets = [];
  lastMove = null;
  pendingMoat = null;
  history = [];
  redoStack = [];
  moveLog = [];
  animateNextMove = false;

  updateModeTag();
  render();
  status(`White to move.`);
}

function updateModeTag() {
  const tag = document.getElementById('modeTag');
  if (!tag) return;
  const modeEl = document.getElementById('modeSelect');
  if (!modeEl) return;
  const mode = modeEl.value;
  let label = '';
  if (mode === 'pvp') label = '2 Players';
  else if (mode === 'ai_easy') label = 'vs AI · Easy';
  else if (mode === 'ai_medium') label = 'vs AI · Medium';
  else if (mode === 'ai_hard') label = 'vs AI · Hard';
  else if (mode === 'ai_vs_ai') label = 'AI vs AI';
  tag.textContent = label;
}

/* ================================================================
 *  STATUS / CLOCKS
 * ================================================================ */

function status(msg) {
  const el = document.getElementById('status');
  if (el) el.textContent = msg;
}

function updateClockUI() {
  const wEl = document.getElementById('clockW');
  const bEl = document.getElementById('clockB');
  const wBox = document.getElementById('clockBoxW');
  const bBox = document.getElementById('clockBoxB');

  if (wEl)  wEl.textContent  = formatTime(state ? state.clocks.w : 0);
  if (bEl)  bEl.textContent  = formatTime(state ? state.clocks.b : 0);

  if (wBox) {
    const flipped = (state && state.turn === 'b');
    wBox.classList.toggle('active-clock', !flipped);
    wBox.classList.toggle('dimmed-clock',  flipped);
  }
  if (bBox) {
    const flipped = (state && state.turn === 'b');
    bBox.classList.toggle('active-clock',  flipped);
    bBox.classList.toggle('dimmed-clock', !flipped);
  }
}

function formatTime(sec) {
  sec = Math.max(0, Math.floor(sec));
  const m = String(Math.floor(sec / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function startClock() {
  if (!state || !state.clocks) return;
  lastClockTickTime = performance.now();
  // Tick every ~100ms, but only decrement the clock of the side
  // whose turn it is (normal chess-style: clock runs for the side
  // to move). We tick based on real elapsed time, not on discrete
  // 1s steps, so pausing/resuming is exact.
  if (autoPlayInterval) return; // autoplay already loops at getSpeed()
  if (aiTimer) return;          // AI move pending, don't double-tick
  requestAnimationFrame(tickClock);
}

function tickClock(ts) {
  if (!state || !state.clocks) return;
  if (gameOver) { updateClockUI(); return; }

  const now = performance.now();
  const dt = (now - lastClockTickTime) / 1000;
  lastClockTickTime = now;

  // Only decrement the clock of the side to move
  const color = state.turn;
  const c = state.clocks[color];
  if (c > 0) {
    state.clocks[color] = Math.max(0, c - dt);
  }

  updateClockUI();

  // If a side's clock hits 0, the game ends immediately
  if (state.clocks.w <= 0 || state.clocks.b <= 0) {
    gameOver = true;
    const winner = state.clocks.w <= 0 ? 'Black' : 'White';
    status(`Game over — ${winner} wins by time.`);
    showGameOverOverlay();
    render();
    return;
  }

  requestAnimationFrame(tickClock);
}

/* ================================================================
 *  EVAL BAR DASHBOARD (updated on every render)
 * ================================================================ */

function updateDashboard() {
  if (!state.captured) state.captured = {w:[], b:[]};
  if (!state.captured.w) state.captured.w = [];
  if (!state.captured.b) state.captured.b = [];

  const jesterVal = getJesterValue(state);
  const pieceValues = { p: 1.0, n: 3.0, b: 3.5, r: 5.0, q: 9.5, k: 0, j: jesterVal };

  document.getElementById('moveCounter').textContent = moveLog.length;

  let whiteBoardVal = 0, blackBoardVal = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = state.board[r][c];
      if (p) {
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
  document.getElementById('evalFillWhite').style.width = `${whitePercent}%`;
  document.getElementById('evalFillBlack').style.width = `${100 - whitePercent}%`;

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

/* ================================================================
 *  RENDER
 * ================================================================ */

function render() {
  const el = document.getElementById('board'); el.innerHTML = '';
  const coordsChk = document.getElementById('coordsToggle');
  el.classList.toggle('hide-coords', !(coordsChk ? coordsChk.checked : true));
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const sq = document.createElement('div'); sq.className = 'square ' + ((r + c) % 2 === 0 ? 'light' : 'dark'); sq.setAttribute('role', 'gridcell');
    sq.dataset.r = r; sq.dataset.c = c;
    
    const moatOwner = isMoatCell(r, c);
    if (moatOwner === 'w') sq.classList.add('moat-w');
    else if (moatOwner === 'b') sq.classList.add('moat-b');

    if (pendingMoat && pendingMoat.r === r && (c >= pendingMoat.c && c <= pendingMoat.c + 2)) {
      const phaseColor = state.phase.split('_')[2];
      sq.classList.add(phaseColor === 'w' ? 'moat-preview-w' : 'moat-preview-b');
    }

    if (lastMove && ((lastMove.from.r === r && lastMove.from.c === c) || (lastMove.to.r === r && lastMove.to.c === c))) {
      sq.classList.add('last-move');
    }

    if (selected && selected.r === r && selected.c === c) sq.classList.add('selected');
    const move = legalTargets.find(m => m.to.r === r && m.to.c === c); if (move){ sq.classList.add('valid'); if (state.board[r][c]) sq.classList.add('capture'); if (move.swap) sq.classList.add('swap-target'); }
    
    const p = state.board[r][c];
    if (p) {
      sq.innerHTML = pieceMarkup(p.type, p.color);
    }
    
    if (c === COLS - 1){ const x = document.createElement('span'); x.className = 'coord row'; x.textContent = ROWS - r; sq.appendChild(x); }
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

/* ================================================================
 *  CLICK + SELECTION LOGIC
 * ================================================================ */

function clickSquare(r, c) {
  if (gameOver) return;
  const mode = document.getElementById('modeSelect').value;

  if (editMode) {
    handleEditorClick(r, c);
    return;
  }

  if (state.phase.startsWith('place_moat')) {
    const color = state.phase.split('_')[2];
    if (state.turn === color && (mode === 'pvp' || color === playerColor)) {
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

/* ================================================================
 *  UNDO / REDO
 * ================================================================ */

function undo() {
  aiRequestId++;
  stopAutoPlay();
  clearTimeout(aiTimer);
  isAIThinking = false;
  if (history.length <= 1 || editMode) return;

  const currentLog = moveLog.pop();
  const currentState = history.pop();
  redoStack.push({ state: currentState, log: currentLog });
  state = clone(history[history.length - 1]);

  gameStarted = (history.length > 1);
  selected = null; legalTargets = []; lastMove = null; gameOver = false; pendingMoat = null;
  hideGameOverOverlay();
  status(`Turn: ${state.turn === 'w' ? 'White' : 'Black'}`);
  lastClockTickTime = performance.now();
  updateClockUI();
  render();
}

function redo() {
  aiRequestId++;
  stopAutoPlay();
  clearTimeout(aiTimer);
  if (redoStack.length === 0 || editMode) return;

  const nextEntry = redoStack.pop();
  history.push(nextEntry.state);
  if (nextEntry.log) moveLog.push(nextEntry.log);
  
  state = clone(nextEntry.state);
  gameStarted = true;
  selected = null; legalTargets = []; gameOver = false; pendingMoat = null;
  hideGameOverOverlay();
  status(`Turn: ${state.turn === 'w' ? 'White' : 'Black'}`);
  lastClockTickTime = performance.now();
  updateClockUI();
  render();
}

/* ================================================================
 *  SAVE / LOAD
 * ================================================================ */

document.getElementById('exportFileBtn').addEventListener('click', () => {
  const data = JSON.stringify({state, moveLog, history, gameStarted, playerColor}, null, 2);
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

document.getElementById('fileInput').addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const parsed = JSON.parse(e.target.result);
      if (parsed && parsed.state && parsed.history) {
        state = parsed.state;
        gameStarted = parsed.gameStarted !== undefined ? parsed.gameStarted : true;
        if (parsed.playerColor) {
          playerColor = parsed.playerColor;
          document.getElementById('playerSideSelect').value = playerColor;
          const boardEl = document.getElementById('board');
          if (playerColor === 'b') boardEl.classList.add('flipped');
          else boardEl.classList.remove('flipped');
        }
        if (!state.captured) state.captured = {w:[], b:[]};
        if (!state.halfmoveClock) state.halfmoveClock = 0;
        if (!state.clocks) {
          const initT = parseInt(document.getElementById('timeSelect').value, 10);
          state.clocks = { w: initT, b: initT };
        }
        if (!state.positionHistory) {
          state.positionHistory = {};
          state.positionHistory[getPositionKey(state)] = 1;
        }
        moveLog = parsed.moveLog || [];
        history = parsed.history || [clone(state)];
        redoStack = []; selected = null; legalTargets = []; lastMove = null; gameOver = false; pendingMoat = null;
        lastClockTickTime = performance.now();
        updateClockUI();
        render();
        status("Game state loaded from file successfully!");
      } else {
        alert("Invalid save state format.");
      }
    } catch(err) {
      alert("Could not parse JSON file.");
    }
  };
  reader.readAsText(file);
  event.target.value = '';
});

/* ================================================================
 *  UI EVENT WIRING (drawers, palettes, buttons)
 * ================================================================ */

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
  aiRequestId++;
  clearTimeout(aiTimer);
  isAIThinking = false;
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
  for (const r of rows){
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
  el.scrollTop = el.scrollHeight;
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
  } catch(err) { /* ignore */ }
}

document.getElementById('coordsToggle').addEventListener('change', () => { saveOptions(); render(); });

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
applyTheme();
applyBoardStyle();
renderPalettePieces();
setup();
