/* Purpose: verify independent piece-colour and board palette options, persistence, and theme coverage. */
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'style.css'),'utf8');
const script=fs.readFileSync(path.join(root,'script.js'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const piecePalettes=['classic','ruby','forest','monochrome'];
const boardStyles=['soft-stone','warm-wood','cool-slate','graphite'];

test('options expose four independent piece palettes and four board palettes',()=>{
 assert.match(html,/<select id="piecePaletteSelect">[\s\S]*?value="classic"[\s\S]*?value="ruby"[\s\S]*?value="forest"[\s\S]*?value="monochrome"/);
 assert.match(html,/<select id="boardStyleSelect">[\s\S]*?value="soft-stone"[\s\S]*?value="warm-wood"[\s\S]*?value="cool-slate"[\s\S]*?value="graphite"/);
 assert.match(html,/<select id="pieceSetSelect">[\s\S]*?value="mobile"[\s\S]*?value="desktop"[\s\S]*?value="minimal"/);
});
test('each piece palette defines light and dark piece, moat, and accent tokens',()=>{
 for(const palette of piecePalettes){
  assert.ok(css.includes(`html[data-piece-palette="${palette}"]:not(.theme-dark)`));
  assert.ok(css.includes(`html.theme-dark[data-piece-palette="${palette}"]`));
 }
 for(const token of ['--piece-w-body:','--piece-b-body:','--piece-w-outline:','--piece-b-outline:','--piece-accent-gold:','--piece-b-accent:','--moat-w:','--moat-b:','--moat-w-edge:','--moat-b-edge:'])assert.ok(css.includes(token));
});
test('move and selection accents follow each piece palette in both themes',()=>{
 for(const palette of piecePalettes){
  assert.match(css,new RegExp(`html\\[data-piece-palette="${palette}"\\]:not\\(\\.theme-dark\\)\\s*\\{[^}]*--move-dot:`));
  assert.match(css,new RegExp(`html\\.theme-dark\\[data-piece-palette="${palette}"\\]\\s*\\{[^}]*--move-dot:`));
 }
 assert.match(css,/--check-ink:\s*#a8403d/);
});
test('fourth Graphite board palette has separate light and dark definitions',()=>{
 assert.match(css,/html\[data-board-style="graphite"\]\s*\{/);
 assert.match(css,/html\.theme-dark\[data-board-style="graphite"\]\s*\{/);
 assert.match(css,/--square-light:\s*#d9dcdd/);
 assert.match(css,/--square-dark:\s*#444d53/);
});
test('piece palette and board style are applied independently to the root element',()=>{
 assert.match(script,/function applyBoardStyle\(\)\s*\{\s*document\.documentElement\.dataset\.boardStyle = boardStyleSelect\.value;/);
 assert.match(script,/function applyPiecePalette\(\)\s*\{\s*document\.documentElement\.dataset\.piecePalette = piecePaletteSelect\.value;/);
 assert.match(script,/piecePaletteSelect\.addEventListener\('change', \(\) => \{ applyPiecePalette\(\); saveOptions\(\); \}\)/);
});
function runLoadOptions(savedOptions=null){
 const options={modeSelect:['pvp'],playerSideSelect:['white'],timeSelect:['0'],jesterPosSelect:['edges'],speedSelect:['500'],uiDisplaySelect:['full'],themeSelect:['auto','light','dark'],boardStyleSelect:boardStyles,piecePaletteSelect:piecePalettes,pieceSetSelect:['mobile','desktop','minimal']};
 const elements=new Map();
 for(const [id,values] of Object.entries(options))elements.set(id,{value:values[0],checked:false,querySelector(selector){const m=selector.match(/^option\[value="([^"]+)"\]$/);return m&&values.includes(m[1])?{}:null;}});
 for(const id of ['coordsToggle','showModeIndicatorToggle'])elements.set(id,{checked:id==='showModeIndicatorToggle'});
 const match=script.match(/function loadOptions\(\)\s*\{[\s\S]*?\n\}\n\ndocument\.getElementById\('coordsToggle'\)/);
 assert.ok(match,'loadOptions() was not found');
 const source=match[0].replace(/\n\ndocument\.getElementById\('coordsToggle'\)$/,'');
 const context={document:{getElementById:id=>elements.get(id)||null},window:{innerWidth:1440,matchMedia:()=>({matches:false})},localStorage:{getItem:()=>savedOptions===null?null:JSON.stringify(savedOptions)}};
 vm.runInNewContext(`let activePieceSet='classic';\n${source}\nloadOptions();\nglobalThis.result={piecePalette:document.getElementById('piecePaletteSelect').value,boardStyle:document.getElementById('boardStyleSelect').value,activePieceSet};`,context);
 return JSON.parse(JSON.stringify(context.result));
}
test('saved piece palette, board style, and piece design restore independently',()=>{
 assert.deepEqual(runLoadOptions({piecePalette:'ruby',boardStyle:'graphite',pieceSet:'minimal'}),{piecePalette:'ruby',boardStyle:'graphite',activePieceSet:'minimal'});
});
test('missing or invalid new preferences safely fall back to first palette choices',()=>{
 assert.deepEqual(runLoadOptions({piecePalette:'unknown',boardStyle:'unknown'}),{piecePalette:'classic',boardStyle:'soft-stone',activePieceSet:'desktop'});
});
test('piece palette is included in saved options and service-worker cache is bumped',()=>{
 assert.match(script,/piecePalette:\s*document\.getElementById\('piecePaletteSelect'\)\.value/);
 assert.match(sw,/jm-cache-v0\.8\.2-unified-colors-1/);
});

test('piece palette accents blend with the selected board profile for moats and indicators',()=>{
 assert.match(css,/background: color-mix\\(in srgb, var\\(--moat-w\\) 74%, var\\(--piece-moat-w-accent/);
 assert.match(css,/background: color-mix\\(in srgb, var\\(--moat-b\\) 74%, var\\(--piece-moat-b-accent/);
 assert.match(css,/--sel-fill: color-mix\\(in srgb, var\\(--board-sel-fill\\)/);
 assert.match(css,/--last-ring: color-mix\\(in srgb, var\\(--board-last-ring\\)/);
 for(const palette of piecePalettes){
  const blocks=[...css.matchAll(new RegExp(`html(?:\\\\.theme-dark)?\\\\[data-piece-palette="${palette}"\\\\](?::not\\\\(\\\\.theme-dark\\\\))?\\\\s*\\\\{([^}]+)\\\\}`,'g'))];
  assert.equal(blocks.length,2);
  for(const block of blocks)assert.match(block[1],/--piece-moat-w-accent:/);
 }
});
test('appearance swatches expose all independent piece and board palette choices',()=>{
 assert.equal((html.match(/data-piece-palette-choice=/g)||[]).length,4);
 assert.equal((html.match(/data-board-style-choice=/g)||[]).length,4);
 assert.match(script,/syncAppearanceSwatches\\(\\)/);
});
test('reset appearance restores visual defaults without changing game mode or side settings',()=>{
 assert.match(html,/id="resetAppearanceBtn"/);
 assert.match(script,/function resetAppearance\\(\\)[\\s\\S]*?piecePaletteSelect\\.value = 'classic'[\\s\\S]*?boardStyleSelect\\.value = 'soft-stone'[\\s\\S]*?themeSelect'\\)\\.value = 'auto'/);
 assert.match(script,/resetAppearanceBtn'\\)\\.addEventListener\\('click', resetAppearance\\)/);
});
