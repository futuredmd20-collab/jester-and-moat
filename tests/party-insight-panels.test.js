'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
const script = fs.readFileSync(path.join(root, 'script.js'), 'utf8');

test('Party Insight tabs are placed around the board and independently address each side', () => {
  assert.match(html, /class="board-layout" id="boardLayout"/);
  assert.match(html, /data-party-insight-side="white"/);
  assert.match(html, /data-party-insight-side="black"/);
  assert.ok(html.indexOf('party-insight-panel-white') < html.indexOf('board-frame-wrap'));
  assert.ok(html.indexOf('party-insight-panel-black') > html.indexOf('board-frame-wrap'));
});

test('Party Insight tabs preserve board layout on desktop and mobile', () => {
  assert.match(css, /\.party-insight-panel-white\s*\{[^}]*grid-row:\s*1/s);
  assert.match(css, /\.board-layout \.party-insight-panel-white\s*\{[^}]*grid-row:\s*2/s);
  assert.match(css, /\.party-insight-panel-black\s*\{[^}]*grid-row:\s*3/s);
  assert.match(css, /\.board-frame-wrap\s*\{\s*grid-row:\s*2/s);
  assert.match(css, /\.board-layout \.board-frame-wrap\s*\{[^}]*grid-row:\s*3/s);
  assert.match(css, /\.board-layout \.party-insight-panel-black\s*\{[^}]*grid-row:\s*4/s);
});

test('Party Insight visibility offers both sides, either side, or neither', () => {
  assert.match(html, /<select id="partyInsightVisibilitySelect">[\s\S]*?<option value="both" selected>Both sides<\/option>[\s\S]*?<option value="white">White only<\/option>[\s\S]*?<option value="black">Black only<\/option>[\s\S]*?<option value="none">Hidden<\/option>/);
  assert.match(script, /const visibility = \['both', 'white', 'black', 'none'\]\.includes\(requestedVisibility\) \? requestedVisibility : 'both'/);
  assert.match(script, /visibility === 'both' \|\| visibility === side/);
  assert.match(script, /panel\.classList\.toggle\('is-hidden', !sideVisible\)/);
  assert.match(script, /panel\.setAttribute\('aria-hidden', String\(!sideVisible\)\)/);
  assert.match(script, /button\.disabled = !sideVisible/);
  assert.match(css, /\.party-insight-panel\.is-hidden\s*\{[^}]*display:\s*none;/);
});

test('Party Insight visibility preference is saved, restored, and applied immediately', () => {
  assert.match(script, /partyInsightVisibility:\s*document\.getElementById\('partyInsightVisibilitySelect'\)\.value/);
  assert.match(script, /setVal\('partyInsightVisibilitySelect', o\.partyInsightVisibility\)/);
  assert.match(script, /partyInsightVisibilitySelect'\)\.addEventListener\('change', \(\) => \{\s*saveOptions\(\);\s*updatePartyInsightPanels\(\);\s*\}\);/);
});

test('Party Insight toggles per side and resolves the active phase-specific engine assignment', () => {
  assert.match(script, /let partyInsightViews = \{ white: 'expression', black: 'expression' \}/);
  assert.match(script, /function togglePartyInsightView\(side\)/);
  assert.match(script, /getEngineAssignment\(side, phase\)/);
  assert.match(script, /ENGINE_STRENGTH_LABELS\[assignment\.strength\]/);
  assert.match(script, /assignment\.personality\?\.name/);
  assert.match(script, /updatePartyInsightPanels\(\);/);
  assert.match(script, /mode !== 'pvp'/);
});


test('Party Insight details dialog shows phase assignments and engine-declared settings', () => {
  assert.match(html, /data-party-insight-details="white"/);
  assert.match(html, /data-party-insight-details="black"/);
  assert.match(html, /<dialog id="partyInsightDetailsDialog"/);
  assert.match(script, /function openPartyInsightDetails\(side\)/);
  assert.match(script, /for \(const phase of Object\.values\(ENGINE_PHASES\)\)/);
  assert.match(script, /getEngineAssignment\(side, phase\)/);
  assert.match(script, /assignment\.engine\.settings \|\| \{\}/);
  assert.match(script, /schema\.label \|\| key/);
  assert.match(script, /schema\.description/);
  assert.match(script, /assignment\.personality\?\.description/);
  assert.match(script, /dialog\.showModal\(\)/);
});

test('Party Insight details control is only available while the side information view is open', () => {
  assert.match(script, /detailsButton\.hidden = view !== 'information'/);
  assert.match(script, /event\.target\.closest\('\[data-party-insight-details\]'\)/);
  assert.match(css, /\.party-insight-details-dialog::backdrop/);
  assert.match(css, /\.party-insight-details-dialog\s*\{/);
});


test('Party Insight shows a temporary handover marker only when the active engine changes', () => {
  assert.match(html, /data-party-insight-handover="white"/);
  assert.match(html, /data-party-insight-handover="black"/);
  assert.match(html, /role="status" aria-live="polite"/);
  assert.match(script, /let partyInsightActiveEngines = \{ white: null, black: null \}/);
  assert.match(script, /function updatePartyInsightHandover\(side, engineId, indicator, sideVisible\)/);
  assert.match(script, /previousEngineId === engineId/);
  assert.match(script, /partyInsightActiveEngines\[side\] = engineId/);
  assert.match(script, /\}, 3000\)/);
  assert.match(script, /if \(partyInsightHandoverPartyId !== partyId \|\| !visible\) resetPartyInsightHandover\(partyId\)/);
  assert.match(script, /resetPartyInsightHandover\(\);\s*updatePartyInsightRecapControl\(\);\s*gameStarted = parsed\.gameStarted/);
  assert.match(script, /recordPartyConfigurationChange\(\);\s*updatePartyInsightPanels\(\);/);
  assert.match(css, /\.party-insight-handover\[hidden\]\s*\{\s*display:\s*none;/);
  assert.match(css, /\.party-insight-handover\s*\{/);
});

test('Party Insight panel updates safely skip incomplete DOM hosts', () => {
  assert.match(script, /const host = document\.getElementById\('boardLayout'\);\s*if \(!host \|\| typeof host\.querySelectorAll !== 'function'\) return;/);
});

test('Move history and factual match recap share one switchable display area', () => {
  assert.match(html, /class="history-view-tabs"[^>]*aria-label="History view"/);
  assert.match(html, /id="historyMovesTab"[^>]*aria-pressed="true"/);
  assert.match(html, /id="historyRecapTab"[^>]*aria-pressed="false"[^>]*disabled/);
  assert.match(html, /<div id="history">No moves yet\.<\/div>\s*<div id="partyInsightRecapContent" hidden><\/div>/);
  assert.doesNotMatch(html, /partyInsightRecapButton|partyInsightRecapDialog/);
  assert.match(script, /function setHistoryView\(view\)/);
  assert.match(script, /function renderPartyInsightRecap\(\)/);
  assert.match(script, /partyRecord\?\.matchEvents \|\| \[\]/);
  assert.match(script, /The recap contains observed game events, not inferred engine reasoning/);
  assert.match(script, /details\.textContent = item\.details/);
  assert.match(script, /let historyOrder = 'newest'/);
  assert.match(script, /const savedHistoryOrder = localStorage\.getItem\('jm_history_order_v1'\)/);
  assert.match(script, /savedHistoryOrder === 'newest' \|\| savedHistoryOrder === 'oldest'/);
  assert.match(script, /const recordedEvents = partyRecord\?\.matchEvents \|\| \[\]/);
  assert.match(script, /const events = historyOrder === 'newest' \? recordedEvents\.slice\(\)\.reverse\(\) : recordedEvents/);
  assert.match(script, /list\.reversed = historyOrder === 'newest'/);
  assert.match(script, /if \(historyView === 'recap'\) renderPartyInsightRecap\(\)/);
  assert.match(script, /addEventListener\('click', \(\) => setHistoryView\('moves'\)\)/);
  assert.match(script, /addEventListener\('click', \(\) => setHistoryView\('recap'\)\)/);
  assert.doesNotMatch(script, /orderControl\.hidden = historyView !== 'moves'/);
  assert.match(css, /#partyInsightRecapContent\[hidden\]/);
  assert.match(css, /\.party-insight-recap-list/);
  assert.match(css, /#history, #partyInsightRecapContent \{ max-height: 220px; overflow: auto; \}/);
});


test('Party Insight reactions expire by elapsed time, not by move count', () => {
  assert.match(script, /PARTY_INSIGHT_REACTION_MAX_AGE_MS = 5000/);
  assert.match(script, /function getPartyInsightReactionEvent\(\)/);
  assert.match(script, /age >= PARTY_INSIGHT_REACTION_MAX_AGE_MS/);
  assert.doesNotMatch(script, /PARTY_INSIGHT_REACTION_MAX_PLIES|pliesElapsed/);
  assert.match(script, /partyInsightReactionTimer = setTimeout\(\(\) =>/);
  assert.match(script, /clearTimeout\(partyInsightReactionTimer\)/);
});

test('Party Insight terminal reactions persist after the game ends', () => {
  assert.match(script, /PARTY_INSIGHT_TERMINAL_EVENTS = new Set\(\['checkmate', 'stalemate', 'draw', 'timeout', 'game-end'\]\)/);
  assert.match(script, /if \(PARTY_INSIGHT_TERMINAL_EVENTS\.has\(event\.type\)\) return event/);
  assert.match(script, /getPartyInsightReactionEvent\(\)/);
});

test('Terminal reactions require the current position to be a completed game', () => {
  assert.match(script, /!PARTY_INSIGHT_TERMINAL_EVENTS\.has\(item\.type\)[\s\S]*?gameOver && partyRecord\?\.outcome\?\.status === 'completed'/);
});

test('Loaded party snapshots survive undo and new captures enter the next snapshot', () => {
  assert.match(script, /historyPartySnapshots = Array\.isArray\(parsed\.historyPartySnapshots\)[\s\S]*?history\.map/);
  assert.match(script, /restorePartyHistorySnapshot\(historyPartySnapshots\[historyPartySnapshots\.length - 1\]\)/);
  assert.match(script, /recordPartyEvent\('capture',[\s\S]*?pushHistorySnapshot\(\);/);
  assert.match(script, /historyPartySnapshots: clone\(historyPartySnapshots\)/);
});

test('Party Insight records castling and en-passant as side-specific reactions', () => {
  assert.match(script, /'castling', 'en-passant'/);
  assert.match(script, /if \(m\.enPassant\) \{[\s\S]*?recordPartyEvent\('en-passant'/);
  assert.match(script, /recordPartyEvent\('capture', captureDetails/);
  assert.match(script, /recordPartyEvent\('castling'/);
  assert.match(script, /partyInsightEventLabel[\s\S]*?'en-passant': 'En passant'[\s\S]*?castling: 'Castling'/);
});

test('Party Insight records ordinary pawn promotions as temporary reactions', () => {
  assert.match(script, /'capture', 'en-passant', 'castling', 'promotion', 'check'/);
  assert.match(script, /recordPartyEvent\('promotion'/);
  assert.match(script, /promo !== 'moat'/);
  assert.match(script, /const movingPieceType = p\.type/);
  assert.match(script, /movingPieceType === 'p'/);
  assert.match(script, /promotion: isActor/);
});

test('Party Insight expressions use separate emoji and text elements', () => {
  assert.match(html, /party-insight-emoji/);
  assert.match(html, /party-insight-reaction-text/);
  assert.match(css, /\.party-insight-expression \{[^}]*position:\s*relative/s);
  assert.match(css, /\.party-insight-emoji \{[^}]*position:\s*absolute[^}]*top:/s);
  assert.match(script, /const expressionEmoji = button\.querySelector\('\.party-insight-emoji'\)/);
  assert.match(script, /const expressionText = button\.querySelector\('\.party-insight-reaction-text'\)/);
  assert.match(script, /expressionEmoji\.textContent = reaction\.emoji/);
  assert.match(script, /expressionText\.textContent = reaction\.text/);
});

test('Party Insight expressions are role-specific and personality-aware', () => {
  assert.match(script, /function getPartyInsightExpression\(side, personalityId = DEFAULT_PERSONALITY_ID\)/);
  assert.match(script, /const isActor = event\.side \? event\.side === sideCode : sideCode === 'w'/);
  assert.match(script, /isMoveHunter = personalityId === 'move_hunter'/);
  assert.match(script, /capture: isActor/);
  assert.match(script, /'en-passant': isActor/);
  assert.match(script, /'That could be trouble\.'/);
  assert.match(script, /'I could do without that loss\.'/);
  assert.match(script, /'Check! Let us see you answer\.'/);
  assert.match(script, /'My game is over\.'/);
  assert.match(script, /getPartyInsightExpression\(side, personalityId\)/);
  assert.match(script, /getEngineAssignment\(side, activePhase\)\.personalityId/);
  assert.match(script, /getPartyInsightReactionEvent\(\)/);
  const expressionFunction = script.match(/function getPartyInsightExpression\([\s\S]*?\n}\n/);
  assert.ok(expressionFunction);
  assert.doesNotMatch(expressionFunction[0], /minimax|evaluateBoard|\.search\(/);
});

test('Party Insight expressions use only recorded events at or before the current ply', () => {
  assert.match(script, /function getPartyInsightReactionEvent\(\)[\s\S]*?item\.ply <= \(state\?\.ply \?\? 0\)/);
  assert.match(script, /events\.slice\(\)\.reverse\(\)\.find/);
  const expressionFunction = script.match(/function getPartyInsightExpression\([\s\S]*?\n}\n/);
  assert.ok(expressionFunction);
  assert.doesNotMatch(expressionFunction[0], /minimax|evaluateBoard|\.search\(/);
});
