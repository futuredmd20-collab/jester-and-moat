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
