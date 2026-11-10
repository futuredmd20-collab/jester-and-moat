const fs = require("fs");
const path = require("path");

const indexHtml = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const styleCss = fs.readFileSync(path.join(__dirname, "style.css"), "utf8");
const piecesCss = fs.readFileSync(path.join(__dirname, "pieces.css"), "utf8");
const piecesSvg = fs.readFileSync(path.join(__dirname, "pieces.svg"), "utf8");
const piecesFlatSvg = fs.readFileSync(path.join(__dirname, "pieces-flat.svg"), "utf8");
const piecesMinimalSvg = fs.readFileSync(path.join(__dirname, "pieces-minimal.svg"), "utf8");
const scriptJs = fs.readFileSync(path.join(__dirname, "script.js"), "utf8");
const mctsEngineJs = fs.readFileSync(path.join(__dirname, "engines", "mcts-engine.js"), "utf8");
const minmaxEngineJs = fs.readFileSync(path.join(__dirname, "engines", "minmax-engine.js"), "utf8");
const evolutionaryFeaturesJs = fs.readFileSync(path.join(__dirname, "scripts", "evolutionary-features.js"), "utf8");
const evolutionarySearchJs = fs.readFileSync(path.join(__dirname, "scripts", "evolutionary-search.js"), "utf8");
const evolutionaryEngineJs = fs.readFileSync(path.join(__dirname, "engines", "evolutionary-engine.js"), "utf8");
const evolutionaryDefaultPackage = JSON.parse(fs.readFileSync(path.join(__dirname, "engines", "evolutionary-default-v1.json"), "utf8"));

let combined = indexHtml.replace(
  '<link rel="stylesheet" href="style.css">',
  `<style>\n${styleCss}\n</style>`
);

// Development-only Eruda must never be carried into the self-contained build.
combined = combined.replace('<script src="scripts/eruda-loader.js"></script>', '');

combined = combined.replace(
  '<link rel="stylesheet" href="pieces.css">',
  `<style>\n${piecesCss}\n</style>`
);

// The single-file build carries the piece symbols inline, so the boot loader in
// index.html finds them and skips its fetch of pieces.svg.
combined = combined.replace(
  "<!-- PIECE-SPRITE:INLINE -->",
  piecesSvg.trimEnd()
);
combined = combined.replace(
  "<!-- PIECE-FLAT-SPRITE:INLINE -->",
  piecesFlatSvg.trimEnd()
);
combined = combined.replace(
  "<!-- PIECE-MINIMAL-SPRITE:INLINE -->",
  piecesMinimalSvg.trimEnd()
);

// Inline the MCTS module before script.js: the engine registry is initialized
// during script.js evaluation and needs mctsEngine to exist at that point.
const strictDirective = '"use strict";';
const scriptBody = scriptJs.replace(/^"use strict";\s*/, "");
const mctsBody = mctsEngineJs.replace(/^'use strict;'\s*/, "");
const minmaxBody = minmaxEngineJs.replace(/^'use strict;'\s*/, "");
const evolutionaryFeaturesBody = evolutionaryFeaturesJs.replace(/^'use strict';\s*/, "");
const evolutionarySearchBody = evolutionarySearchJs.replace(/^'use strict';\s*/, "");
const evolutionaryEngineBody = evolutionaryEngineJs.replace(/^'use strict';\s*/, "");
const evolutionaryPackageScript = `globalThis.EVOLUTIONARY_DEFAULT_PACKAGE = ${JSON.stringify(evolutionaryDefaultPackage)};`;
combined = combined.replace(
  /<!-- GAME-BOOT:BEGIN[\s\S]*?<!-- GAME-BOOT:END -->/,
  `<script>\n${strictDirective}\n${mctsBody}\n${minmaxBody}\n${evolutionaryPackageScript}\n${evolutionaryFeaturesBody}\n${evolutionarySearchBody}\n${evolutionaryEngineBody}\n${scriptBody}\n</script>`
);

fs.writeFileSync(path.join(__dirname, "jester-and-moat.html"), combined, "utf8");
console.log("jester-and-moat.html har skapats!");
