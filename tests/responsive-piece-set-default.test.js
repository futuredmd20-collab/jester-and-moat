/* Purpose: verify responsive piece-set defaults on first launch and saved-choice precedence. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const scriptSource = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');
const loadOptionsMatch = scriptSource.match(/function loadOptions\(\)\s*\{[\s\S]*?\n\}\n\ndocument\.getElementById\('coordsToggle'\)/);
assert.ok(loadOptionsMatch, 'could not find loadOptions() in script.js');
const loadOptionsSource = loadOptionsMatch[0].replace(/\n\ndocument\.getElementById\('coordsToggle'\)$/, '');

function runLoadOptions({ savedOptions = null, mobile = false, storageThrows = false } = {}) {
  const validPieceSets = new Set(['mobile', 'desktop', 'minimal']);
  const elements = new Map();
  const ids = [
    'modeSelect', 'playerSideSelect', 'timeSelect', 'jesterPosSelect', 'speedSelect',
    'uiDisplaySelect', 'themeSelect', 'boardStyleSelect', 'pieceSetSelect',
    'coordsToggle', 'showModeIndicatorToggle'
  ];
  for (const id of ids) {
    elements.set(id, {
      value: id === 'pieceSetSelect' ? 'mobile' : '',
      checked: false,
      querySelector(selector) {
        if (id !== 'pieceSetSelect') return {};
        const match = selector.match(/^option\[value="([^"]+)"\]$/);
        return match && validPieceSets.has(match[1]) ? {} : null;
      }
    });
  }

  const window = {
    innerWidth: mobile ? 390 : 1440,
    matchMedia: query => ({ matches: mobile && query === '(max-width: 768px)' })
  };
  if (mobile) window.ontouchstart = null;
  const localStorage = {
    getItem() {
      if (storageThrows) throw new Error('storage unavailable');
      return savedOptions === null ? null : JSON.stringify(savedOptions);
    }
  };
  const context = {
    document: { getElementById: id => elements.get(id) || null },
    window,
    localStorage
  };
  vm.runInNewContext(`let activePieceSet = 'classic';\n${loadOptionsSource}\nloadOptions();\nglobalThis.result = { activePieceSet, selectedPieceSet: document.getElementById('pieceSetSelect').value };`, context, { filename: 'script.js:loadOptions' });
  return JSON.parse(JSON.stringify(context.result));
}

test('first launch on mobile selects Mobile in both the control and renderer state', () => {
  assert.deepEqual(runLoadOptions({ mobile: true }), {
    activePieceSet: 'mobile',
    selectedPieceSet: 'mobile'
  });
});

test('first launch on desktop selects Desktop in both the control and renderer state', () => {
  assert.deepEqual(runLoadOptions(), {
    activePieceSet: 'desktop',
    selectedPieceSet: 'desktop'
  });
});

test('saved Minimal preference overrides the responsive default', () => {
  assert.deepEqual(runLoadOptions({ mobile: true, savedOptions: { pieceSet: 'minimal' } }), {
    activePieceSet: 'minimal',
    selectedPieceSet: 'minimal'
  });
});

test('unavailable localStorage does not prevent the responsive default', () => {
  assert.deepEqual(runLoadOptions({ mobile: true, storageThrows: true }), {
    activePieceSet: 'mobile',
    selectedPieceSet: 'mobile'
  });
});
