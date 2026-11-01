/* Purpose: verify PWA startup sequencing, sprite fallbacks, and service-worker contracts. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const swSource = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const erudaLoaderSource = fs.readFileSync(path.join(root, 'scripts', 'eruda-loader.js'), 'utf8');
const buildSource = fs.readFileSync(path.join(root, 'build.js'), 'utf8');

function extractScript(regex, label) {
  const match = html.match(regex);
  assert.ok(match, `could not find ${label} script in index.html`);
  return match[1];
}

const bootSource = extractScript(
  /<!-- GAME-BOOT:BEGIN[\s\S]*?<script>([\s\S]*?)<\/script>[\s\S]*?<!-- GAME-BOOT:END -->/,
  'game boot'
);
const serviceWorkerSource = extractScript(
  /<script>\s*(if \('serviceWorker' in navigator\)[\s\S]*?)<\/script>/,
  'service-worker registration'
);

async function runBoot({ inline = false, spriteFailure = false, mctsFailure = false } = {}) {
  const fetchCalls = [];
  const appendedScripts = [];
  const errors = [];
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) elements.set(id, { id, innerHTML: '' });
    return elements.get(id);
  }
  const document = {
    getElementById(id) {
      if (id === 'p-rook' || id === 'flat-p-rook') return inline ? { id } : null;
      return element(id);
    },
    createElement(tag) {
      assert.equal(tag, 'script');
      return { src: '', onload: null, onerror: null };
    },
    body: {
      appendChild(script) {
        appendedScripts.push(script.src);
        if (script.src === 'engines/mcts-engine.js' || script.src === 'engines/minmax-engine.js') {
          setImmediate(() => {
            if (mctsFailure) script.onerror && script.onerror();
            else script.onload && script.onload();
          });
        }
      }
    }
  };
  const fetch = async url => {
    fetchCalls.push(url);
    if (spriteFailure && url === 'pieces-flat.svg') return { ok: false, status: 404, text: async () => '' };
    return { ok: true, text: async () => `<svg id="${url}"></svg>` };
  };
  vm.runInNewContext(bootSource, {
    document,
    fetch,
    Promise,
    console: { error: (...args) => errors.push(args) },
    setImmediate
  }, { filename: 'index.html:GAME-BOOT' });
  // Let the sprite-fetch promise chain and each sequential script onload settle.
  for (let i = 0; i < 10 && !appendedScripts.includes('script.js'); i += 1) {
    await new Promise(resolve => setImmediate(resolve));
  }
  return { fetchCalls, appendedScripts, errors, elements };
}

function runErudaLoader(search, { fail = false } = {}) {
  const appendedScripts = [];
  const warnings = [];
  let initCalls = 0;
  const window = {
    location: { search },
    eruda: { init: () => { initCalls += 1; } }
  };
  const document = {
    createElement(tag) {
      assert.equal(tag, 'script');
      return { src: '', onload: null, onerror: null };
    },
    head: {
      appendChild(script) {
        appendedScripts.push(script.src);
        if (fail) script.onerror && script.onerror();
        else script.onload && script.onload();
      }
    }
  };
  vm.runInNewContext(erudaLoaderSource, {
    window,
    document,
    URLSearchParams,
    console: { warn: (...args) => warnings.push(args) }
  }, { filename: 'scripts/eruda-loader.js' });
  return { appendedScripts, warnings, initCalls };
}

test('Eruda loader stays inactive unless eruda=true is explicitly present', () => {
  for (const search of ['', '?debug=1', '?eruda=false', '?eruda=truex']) {
    const result = runErudaLoader(search);
    assert.deepEqual(result.appendedScripts, [], `unexpected Eruda load for ${search}`);
    assert.equal(result.initCalls, 0);
  }
});

test('Eruda loader loads the local bundle and initializes it with eruda=true', () => {
  const result = runErudaLoader('?eruda=true');
  assert.deepEqual(result.appendedScripts, ['scripts/eruda.min.js']);
  assert.equal(result.initCalls, 1);
  assert.deepEqual(result.warnings, []);
});

test('Eruda loader handles local bundle load failure without throwing', () => {
  const result = runErudaLoader('?eruda=true', { fail: true });
  assert.deepEqual(result.appendedScripts, ['scripts/eruda.min.js']);
  assert.equal(result.initCalls, 0);
  assert.match(String(result.warnings[0][0]), /Eruda debug console failed to load/);
});

test('development Eruda stays out of the service-worker precache and single-file build', () => {
  assert.ok(html.includes('<script src="scripts/eruda-loader.js"></script>'));
  assert.ok(buildSource.includes(`combined = combined.replace('<script src="scripts/eruda-loader.js"></script>', '');`));
  assert.ok(!swSource.includes('eruda-loader.js'));
  assert.ok(!swSource.includes('eruda.min.js'));
});

test('multi-file startup loads both sprites and MCTS before script.js', async () => {
  const result = await runBoot();
  assert.deepEqual(result.fetchCalls, ['pieces.svg', 'pieces-flat.svg']);
  assert.deepEqual(result.appendedScripts, ['engines/mcts-engine.js', 'engines/minmax-engine.js', 'script.js']);
  assert.match(result.elements.get('pieceSprite').innerHTML, /pieces\.svg/);
  assert.match(result.elements.get('pieceFlatSprite').innerHTML, /pieces-flat\.svg/);
});

test('single-file startup skips sprite and MCTS fetches when symbols are inline', async () => {
  const result = await runBoot({ inline: true });
  assert.deepEqual(result.fetchCalls, []);
  assert.deepEqual(result.appendedScripts, ['engines/minmax-engine.js', 'script.js']);
});

test('sprite fetch failure logs an error and still starts script.js', async () => {
  const result = await runBoot({ spriteFailure: true });
  assert.deepEqual(result.fetchCalls, ['pieces.svg', 'pieces-flat.svg']);
  assert.deepEqual(result.appendedScripts, ['engines/minmax-engine.js', 'script.js']);
  assert.equal(result.errors.length, 1);
  assert.match(String(result.errors[0][0]), /Piece sprite failed to load/);
});

test('MCTS load failure still starts script.js as a MinMax fallback', async () => {
  const result = await runBoot({ mctsFailure: true });
  assert.deepEqual(result.appendedScripts, ['engines/mcts-engine.js', 'engines/minmax-engine.js', 'script.js']);
  assert.equal(result.errors.length, 1);
  assert.match(String(result.errors[0][0]), /MCTS engine failed to load/);
});

test('service-worker registration waits for the window load event', () => {
  let loadHandler;
  const registrations = [];
  const warnings = [];
  const context = {
    navigator: { serviceWorker: { register: path => { registrations.push(path); return Promise.resolve(); } } },
    window: { addEventListener: (event, handler) => { assert.equal(event, 'load'); loadHandler = handler; } },
    console: { warn: (...args) => warnings.push(args) },
    Promise
  };
  vm.runInNewContext(serviceWorkerSource, context, { filename: 'index.html:service-worker' });
  assert.deepEqual(registrations, []);
  assert.equal(typeof loadHandler, 'function');
  loadHandler();
  assert.deepEqual(registrations, ['sw.js']);
  assert.deepEqual(warnings, []);
});

test('service-worker precache covers the shipped multi-file app, not source art crops', () => {
  const context = { self: { addEventListener() {} } };
  vm.runInNewContext(`${swSource}\nglobalThis.__cache = CACHE; globalThis.__precache = PRECACHE;`, context, { filename: 'sw.js' });
  assert.match(context.__cache, /^jm-cache-/);
  for (const file of [
    './', './index.html', './style.css', './pieces.css', './pieces.svg',
    './pieces-flat.svg', './script.js', './manifest.json',
    './engines/mcts-engine.js', './engines/minmax-engine.js', './icon-192.png', './icon-512.png',
    './icon-maskable-512.png', './apple-touch-icon.png'
  ]) assert.ok(context.__precache.includes(file), `precache should include ${file}`);
  assert.ok(!context.__precache.some(file => /(?:light|flat)-.*\.svg$/.test(file)));
});

test('service-worker install precaches assets before skipping waiting', async () => {
  const handlers = {};
  let added = [];
  let skippedWaiting = false;
  const cache = { addAll: async files => { added = files; } };
  const context = {
    self: {
      addEventListener: (event, handler) => { handlers[event] = handler; },
      skipWaiting: async () => { skippedWaiting = true; }
    },
    caches: { open: async () => cache },
    Promise
  };
  vm.runInNewContext(`${swSource}\nglobalThis.__precache = PRECACHE;`, context, { filename: 'sw.js' });
  let installPromise;
  handlers.install({ waitUntil: promise => { installPromise = promise; } });
  await installPromise;
  assert.deepEqual(added, context.__precache);
  assert.equal(skippedWaiting, true);
});

test('service-worker activation deletes old app caches and claims clients', async () => {
  const handlers = {};
  const deleted = [];
  let claimed = false;
  const context = {
    self: {
      addEventListener: (event, handler) => { handlers[event] = handler; },
      clients: { claim: async () => { claimed = true; } }
    },
    caches: {
      keys: async () => ['jm-cache-old', 'unrelated-cache', 'jm-cache-v0.8.0-compact-ui-15'],
      delete: async key => { deleted.push(key); return true; }
    },
    Promise
  };
  vm.runInNewContext(swSource, context, { filename: 'sw.js' });
  let activationPromise;
  handlers.activate({ waitUntil: promise => { activationPromise = promise; } });
  await activationPromise;
  assert.deepEqual(deleted, ['jm-cache-old']);
  assert.equal(claimed, true);
});
