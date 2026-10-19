const fs = require("fs");
const path = require("path");

const indexHtml = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const styleCss = fs.readFileSync(path.join(__dirname, "style.css"), "utf8");
const piecesCss = fs.readFileSync(path.join(__dirname, "pieces.css"), "utf8");
const piecesSvg = fs.readFileSync(path.join(__dirname, "pieces.svg"), "utf8");
const scriptJs = fs.readFileSync(path.join(__dirname, "script.js"), "utf8");

let combined = indexHtml.replace(
  '<link rel="stylesheet" href="style.css">',
  `<style>\n${styleCss}\n</style>`
);

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

// Replace the loader itself with the game script, so the file works from file://.
combined = combined.replace(
  /<!-- GAME-BOOT:BEGIN[\s\S]*?<!-- GAME-BOOT:END -->/,
  `<script>\n${scriptJs}\n</script>`
);

fs.writeFileSync(path.join(__dirname, "jester-and-moat.html"), combined, "utf8");
console.log("jester-and-moat.html har skapats!");
