"use strict";

/* v0.6.0 — seven drawn SVG symbols, one per piece, live in pieces.svg (built by
 * generate-piece-sprite.js) and are injected before this file runs. Fills read
 * the --p-* palette that pieces.css sets from data-color, so both sides share
 * one drawing with a distinct light/dark palette.
 * The element is sized by CSS (.piece), never here: one box, one rule. */
const PIECE_NAME = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn', j: 'jester' };

/* One markup function for board squares, captured boxes, the promotion modal and
 * the editor palette, so every surface uses the currently selected art set. */
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
  if (st.ply < 10 || pieceCount >= 34) return ENGINE_PHASES.OPENING;
  if (pieceCount <= 16) return ENGINE_PHASES.ENDGAME;
  return ENGINE_PHASES.MIDGAME;
}

let state;
let selected = null;
let animateNextMove = false;
let legalTargets = [];
let history = [];
let redoStack = [];
let moveLog = [];
let gameOver = false;
let aiTimer = null;
let autoPlayInterval = null;
let lastMove = null;
let clockFrameId = null;
let lastClockDisplay = { w: null, b: null };
let aiWorker = null;
let aiRequestId = 0;
let gameStarted = false;
let pendingPromotionMove = null;
let playerColor = 'w';
let pendingMoat = null;
let editMode = false;
let activeTool = 'eraser';
let isAIThinking = false;
let lastClockTickTime = null;

function clone(x) { return JSON.parse(JSON.stringify(x)); }
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
  }
}

function updateDisplayPreferences() {
  const displayMode = document.getElementById('uiDisplaySelect').value;
  const clockContainer = document.getElementById('clockContainerEl');
  const evalBarContainer = document.getElementById('evalBarContainer');
  const whiteInfo = document.getElementById('evalWhiteInfo');
  const blackInfo = document.getElementById('evalBlackInfo');

  if (displayMode === 'full') {
    clockContainer.style.display = 'flex';
    evalBarContainer.style.display = 'flex';
    whiteInfo.style.display = 'flex';
    blackInfo.style.display = 'flex';
  } else if (displayMode === 'bar_pts') {
    clockContainer.style.display = 'none';
    evalBarContainer.style.display = 'flex';
    whiteInfo.style.display = 'flex';
    blackInfo.style.display = 'flex';
  } else if (displayMode === 'bar_only') {
    clockContainer.style.display = 'none';
    evalBarContainer.style.display = 'flex';
    whiteInfo.style.display = 'none';
    blackInfo.style.display = 'none';
  } else if (displayMode === 'clocks_only') {
    clockContainer.style.display = 'flex';
    evalBarContainer.style.display = 'none';
  } else if (displayMode === 'hidden') {
    clockContainer.style.display = 'none';
    evalBarContainer.style.display = 'none';
  }
}

function setup(){
  aiRequestId++;
  clearTimeout(aiTimer);
  stopClock();
  stopAutoPlay();
  pendingMoat = null;
  editMode = false;
  isAIThinking = false;
  document.getElementById('editorPanel').classList.remove('active');
  document.getElementById('editorToggleBtn').textContent = '🛠️ Edit Board';

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
  selected = null; legalTargets = []; history = [clone(state)]; redoStack = []; moveLog = []; lastMove = null; gameOver = false; gameStarted = false; pendingPromotionMove = null;
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
  const statusEl = document.getElementById("status");
  statusEl.textContent = s;
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
      else if (ep && ep.r === rr && ep.c === cc) add(rr, cc, {enPassant: true});
    }
  } else if (p.type === 'n') {
    for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) add(r + dr, c + dc);
  } else if (p.type === 'k') {
    for (const [dr, dc] of DIRS) add(r + dr, c + dc);

    if (!p.moved && !inCheck(p.color, b, moats)) {
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

function evaluateBoard(st) {
  const jesterVal = getJesterValue(st);
  const pieceValues = { p: 1.0, n: 3.0, b: 3.5, r: 5.0, q: 9.5, k: 200.0, j: jesterVal };
  let score = 0;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = st.board[r][c];
      if (!p) continue;

      let val = pieceValues[p.type] || 0;
      let centerBonus = 0;
      if (r >= 2 && r <= 5 && c >= 3 && c <= 6) centerBonus = 0.2;
      if (p.type === 'j' && st.ply >= 10 && (r >= 2 && r <= 5)) centerBonus += 0.4;

      const total = val + centerBonus;
      if (p.color === 'w') score += total;
      else score -= total;
    }
  }
  return score;
}

function minimax(st, depth, alpha, beta, isMaximizing) {
  const moves = allLegalState(st, st.turn);
  const check = inCheck(st.turn, st.board, st.moats);

  if (depth === 0 || moves.length === 0) {
    if (moves.length === 0) {
      if (check) return isMaximizing ? -9999 + (3 - depth) : 9999 - (3 - depth);
      return 0;
    }
    return evaluateBoard(st);
  }

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const m of moves) {
      const nextState = clone(st);
      if (m.swap) {
        const p = nextState.board[m.from.r][m.from.c], q = nextState.board[m.to.r][m.to.c];
        nextState.board[m.to.r][m.to.c] = p; nextState.board[m.from.r][m.from.c] = q;
        p.moved = true; q.moved = true; nextState.turn = other(nextState.turn); nextState.ply++;
      } else {
        applyRaw(nextState, m);
      }
      const ev = minimax(nextState, depth - 1, alpha, beta, false);
      maxEval = Math.max(maxEval, ev);
      alpha = Math.max(alpha, ev);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const m of moves) {
      const nextState = clone(st);
      if (m.swap) {
        const p = nextState.board[m.from.r][m.from.c], q = nextState.board[m.to.r][m.to.c];
        nextState.board[m.to.r][m.to.c] = p; nextState.board[m.from.r][m.from.c] = q;
        p.moved = true; q.moved = true; nextState.turn = other(nextState.turn); nextState.ply++;
      } else {
        applyRaw(nextState, m);
      }
      const ev = minimax(nextState, depth - 1, alpha, beta, true);
      minEval = Math.min(minEval, ev);
      beta = Math.min(beta, ev);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

function getBestMove(st, depth) {
  const moves = allLegalState(st, st.turn);
  if (!moves.length) return null;

  let bestMove = null;
  const isMax = st.turn === 'w';
  let bestEval = isMax ? -Infinity : Infinity;

  moves.sort(() => Math.random() - 0.5);

  for (const m of moves) {
    const nextState = clone(st);
    if (m.swap) {
      const p = nextState.board[m.from.r][m.from.c], q = nextState.board[m.to.r][m.to.c];
      nextState.board[m.to.r][m.to.c] = p; nextState.board[m.from.r][m.from.c] = q;
      p.moved = true; q.moved = true; nextState.turn = other(nextState.turn); nextState.ply++;
    } else {
      applyRaw(nextState, m);
    }

    const ev = minimax(nextState, depth - 1, -Infinity, Infinity, !isMax);
    if (isMax) {
      if (ev > bestEval) { bestEval = ev; bestMove = m; }
    } else {
      if (ev < bestEval) { bestEval = ev; bestMove = m; }
    }
  }
  return bestMove;
}


/* Plugin System: MinMaxLegacy Plugin #1
 * Wraps the existing MinMax engine as a plugin.
 * Reads modeSelect from DOM to replicate aiMove's depth buckets.
 * Behavior unchanged from current implementation. */
const MinMaxLegacy = {
  name: 'MinMax (Legacy)',
  phases: [ENGINE_PHASES.OPENING, ENGINE_PHASES.MIDGAME, ENGINE_PHASES.ENDGAME],
  strength: 'default',
  getMove: function(gameState, side) {
    const mode = document.getElementById('modeSelect').value;
    let depth = 2;
    if (mode === 'ai_easy') depth = 1;
    if (mode === 'ai_medium' || mode === 'ai_vs_ai') depth = 2;
    if (mode === 'ai_hard') depth = 3;
    return getBestMove(gameState, depth);
  }
};

/* Plugin System: Engine Registry */
const enginePlugins = new Map();
enginePlugins.set('minmax_legacy', MinMaxLegacy);
enginePlugins.set('mcts', mctsEngine(2));

/* Plugin System: Per-side default engine configuration
 * Both sides default to MinMaxLegacy for all phases (single-engine mode)
 * Format: { engineId: string, phaseOverrides: { [phase]: engineId } | null } */
const defaultEngineForSide = {
  w: { engineId: 'minmax_legacy', phaseOverrides: { opening: 'minmax_legacy', midgame: 'minmax_legacy', endgame: 'minmax_legacy' } },
  b: { engineId: 'minmax_legacy', phaseOverrides: { opening: 'minmax_legacy', midgame: 'minmax_legacy', endgame: 'minmax_legacy' } }
};
const MODE_TAG = { pvp: '2 Players', ai_easy: 'vs AI · Easy', ai_medium: 'vs AI · Medium', ai_hard: 'vs AI · Hard', ai_vs_ai: 'AI vs AI' };
/* Header mode pill, and the controls that have no meaning in AI vs AI
 * (there is no player side to switch). */
function updateModeUI() {
  const mode = document.getElementById('modeSelect').value;
  const isSim = mode === 'ai_vs_ai';
  document.getElementById('modeTag').textContent = MODE_TAG[mode] || '';
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

// Wire up engine/phase per-side configuration UI
document.getElementById('whiteEngineSelect').onchange = updateEngineConfigUI;
document.getElementById('whiteEnginePhaseSelect').onchange = updateEngineConfigUI;
document.getElementById('blackEngineSelect').onchange = updateEngineConfigUI;
document.getElementById('blackEnginePhaseSelect').onchange = updateEngineConfigUI;

function ensureAIWorker() {
  if (aiWorker || !('Worker' in window)) return aiWorker;
  const engineFunctions = [clone, inside, other, pieceAt, getMoatCells, isMoatCell, checkMoatDestructionState, attacked, kingPos, inCheck, pseudoMoves, applyRaw, legalMovesFromState, allLegalState, getJesterValue, evaluateBoard, minimax, getBestMove, mctsLevelFor, mctsApplyMove, mctsPlayout, mctsNode, mctsUctChild, mctsSearch, mctsGetMove];
  const workerSource = `"use strict";
const ROWS = 8, COLS = 10;
const DIRS = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
let state = null;
${engineFunctions.map(fn => fn.toString()).join('\n')}
onmessage = function(event) {
  const data = event.data;
  try {
    state = data.state;
    const moveFn = data.workerFn === 'mctsGetMove' ? mctsGetMove
      : data.workerFn === 'getBestMove' || data.workerFn == null ? getBestMove
      : null;
    if (!moveFn) throw new Error('Unsupported worker function: ' + data.workerFn);
    const move = moveFn(state, data.depth);
    postMessage({ id: data.id, move });
  }
  catch (error) { postMessage({ id: data.id, error: String(error && error.message || error) }); }
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
    const data = event.data;
    if (data.id !== aiRequestId) return;
    isAIThinking = false;
    if (gameOver) return;
    if (data.error) {
      status(`AI error: ${data.error}`);
      return;
    }
    // Support workerFn directive: 'mctsGetMove' or 'getBestMove'
    const move = data.move;
    if (data.move) play(move, 'pending');
    else {
      gameOver = true;
      stopAutoPlay();
      stopClock();
      status('No legal moves available.');
    }
  };
  aiWorker.onerror = (event) => {
    isAIThinking = false;
    status('AI worker error. Please restart the game.');
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

function aiMove(){
  if (gameOver || isAIThinking) return;
  isAIThinking = true;
  status("\u23f3 AI thinking...");

  const { engine, depth } = getEngineConfig(state.turn);
  
  const worker = ensureAIWorker();
  if (worker) {
    const id = ++aiRequestId;
    // Route to mctsGetMove for MCTS, getBestMove for MinMax
    const workerFn = engine.name && engine.name.includes('MCTS') ? 'mctsGetMove' : 'getBestMove';
    worker.postMessage({ id, state: clone(state), depth, workerFn });
    return;
  }
  setTimeout(() => {
    if (gameOver) { isAIThinking = false; return; }
    const bestMove = engine.getMove ? engine.getMove(clone(state), state.turn) : null;
    isAIThinking = false;
    if (bestMove) play(bestMove, 'pending');
  }, 20);
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
  history.push(clone(state));
  redoStack = [];
  selected = null; legalTargets = [];

  if (promo === 'moat') {
    state.phase = `place_moat_${mover}`;
    state.turn = mover;
    pendingMoat = null;
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

  history.push(clone(state));
  redoStack = [];
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

  history.push(clone(state));
  redoStack = [];

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
    toggleBtn.textContent = '🎮 Resume Game';
    document.getElementById('editorClockW').value = formatTime(state.clocks.w);
    document.getElementById('editorClockB').value = formatTime(state.clocks.b);
    status("BOARD EDITOR ACTIVE: Select pieces/tools or adjust clocks below.");
    selected = null; legalTargets = [];
  } else {
    panel.classList.remove('active');
    toggleBtn.textContent = '🛠️ Edit Board';
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

  const parsedW = parseClockString(document.getElementById('editorClockW').value);
  const parsedB = parseClockString(document.getElementById('editorClockB').value);
  if (parsedW !== null) state.clocks.w = parsedW;
  if (parsedB !== null) state.clocks.b = parsedB;

  editMode = false;
  document.getElementById('editorPanel').classList.remove('active');
  document.getElementById('editorToggleBtn').textContent = '🛠️ Edit Board';
  gameStarted = true;
  history = [clone(state)];
  redoStack = [];
  moveLog = ["1. Position & clocks set via Board Editor."];
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
    document.getElementById('autoBtn').textContent = '⏸';
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

function redo(){
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
  reader.onload = function(e){
    try {
      const parsed = JSON.parse(e.target.result);
      if (parsed && parsed.state && parsed.history){
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
