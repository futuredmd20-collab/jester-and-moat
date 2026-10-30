const fs = require("fs");
const path = require("path");

const indexHtml = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const styleCss = fs.readFileSync(path.join(__dirname, "style.css"), "utf8");
const piecesCss = fs.readFileSync(path.join(__dirname, "pieces.css"), "utf8");
const piecesSvg = fs.readFileSync(path.join(__dirname, "pieces.svg"), "utf8");
const piecesFlatSvg = fs.readFileSync(path.join(__dirname, "pieces-flat.svg"), "utf8");
const scriptJs = fs.readFileSync(path.join(__dirname, "script.js"), "utf8");
const mctsEngineJs = fs.readFileSync(path.join(__dirname, "engines", "mcts-engine.js"), "utf8");

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

// Inline the MCTS module before script.js: the engine registry is initialized
// during script.js evaluation and needs mctsEngine to exist at that point.
const strictDirective = '"use strict";';
const scriptBody = scriptJs.replace(/^"use strict";\s*/, "");
const mctsBody = mctsEngineJs.replace(/^'use strict;'\s*/, "");
combined = combined.replace(
  /<!-- GAME-BOOT:BEGIN[\s\S]*?<!-- GAME-BOOT:END -->/,
  `<script>\n${strictDirective}\n${mctsBody}\n${scriptBody}\n</script>`
);

fs.writeFileSync(path.join(__dirname, "jester-and-moat.html"), combined, "utf8");
console.log("jester-and-moat.html har skapats!");
