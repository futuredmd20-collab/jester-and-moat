"use strict";

/* generate-piece-sprite.js — builds pieces.svg and pieces.css from the seven
 * light-*.svg art files.
 *
 * The art is stored once. Each piece is a single <symbol>; the light/dark split
 * is a palette swap, not a second copy of the geometry (the old inline sprite
 * carried every piece twice, ~126 KB of index.html). Colours are CSS variables
 * set on .piece[data-color] in pieces.css, which inherit into the <use> shadow
 * tree at paint time.
 *
 * Run: node generate-piece-sprite.js
 * The output is committed; index.html, sw.js and build.js only need to know the
 * file names. No dependencies. Fails loudly if the art no longer matches the
 * palette table below, so a new colour in an SVG cannot silently render black.
 */

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PIECES = ["rook", "knight", "bishop", "queen", "king", "jester", "pawn"];

/* Art fill -> palette role. The seven SVGs share one colour vocabulary; the
 * theme (style.css, PIECE-COLOURS block) decides what each role looks like on
 * each side. A hex missing here is an error, not a fallback. */
const ART_ROLE = {
  "#dcdcdc": "body",
  "#d1d1d1": "gloss",
  "#2f2f2f": "deep",
  "#575757": "mid",
  "#bebebe": "tone",
  "#6d6d6d": "shade",
  "#838383": "shade",
  "#c6c6c6": "light",
  "#c9993f": "gold",
  "#161616": "ink",
};

/* Paths whose art colour is reused for a different material. The queen's gem is
 * drawn with the body grey but has always rendered as the gem colour. Indices
 * are 0-based and listed in art order; they are asserted below so an art edit
 * cannot shift them silently. */
const ROLE_OVERRIDES = { queen: { 24: "gem" } };

/* role -> theme variable, per side. Mirrors the PIECE-COLOURS block in
 * style.css; every name there is used here except the unused shade/gloss steps
 * the theme still declares for future art. */
const SIDE_VARS = {
  w: {
    body: "--piece-w-body",
    gloss: "--piece-w-gloss",
    deep: "--piece-w-exact-1",
    mid: "--piece-w-exact-2",
    tone: "--piece-w-tone",
    shade: "--piece-w-shade-434",
    light: "--piece-w-shade-844",
    gold: "--piece-accent-gold",
    ink: "--piece-w-ink",
    gem: "--piece-queen-gem",
    outline: "--piece-w-outline",
  },
  b: {
    body: "--piece-b-body",
    gloss: "--piece-b-gloss",
    deep: "--piece-b-exact-5",
    mid: "--piece-b-exact-4",
    tone: "--piece-b-exact-2",
    shade: "--piece-b-exact-3",
    light: "--piece-b-exact-1",
    gold: "--piece-accent-gold",
    ink: "--piece-b-ink",
    gem: "--piece-queen-gem",
    outline: "--piece-b-outline",
  },
};

/* ---------------------------------------------------------------- path data */

function parsePath(d) {
  const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) || [];
  const commands = [];
  let current = null;
  for (const token of tokens) {
    if (/[A-Za-z]/.test(token)) {
      current = { cmd: token, args: [] };
      commands.push(current);
    } else {
      current.args.push(parseFloat(token));
    }
  }
  return commands;
}

function num(value) {
  if (!Number.isFinite(value)) throw new Error("bad number: " + value);
  if (Math.abs(value) < 0.0005) return "0";
  let text = value.toFixed(3).replace(/\.?0+$/, "");
  if (text === "-0") text = "0";
  if (text.startsWith("0.")) text = text.slice(1);
  else if (text.startsWith("-0.")) text = "-" + text.slice(2);
  return text;
}

/* Absolute -> relative. The art only uses M, C, L and z, so the conversion is
 * exact: every delta is a difference of two 3-decimal numbers, and the format
 * below keeps 3 decimals, so the rebuilt path matches the original to rounding
 * noise. A command outside that set is a hard error rather than a guess. */
function toRelative(commands) {
  const out = [];
  let cx = 0;
  let cy = 0;
  let startX = 0;
  let startY = 0;
  for (const { cmd, args } of commands) {
    if (cmd === "M") {
      if (args.length !== 2) throw new Error("M with " + args.length + " args");
      out.push({ cmd: "m", args: [args[0] - cx, args[1] - cy] });
      cx = startX = args[0];
      cy = startY = args[1];
    } else if (cmd === "L") {
      const pairs = [];
      for (let i = 0; i < args.length; i += 2) {
        pairs.push(args[i] - cx, args[i + 1] - cy);
        cx = args[i];
        cy = args[i + 1];
      }
      out.push({ cmd: "l", args: pairs });
    } else if (cmd === "C") {
      // A curve's three points are all relative to the point the curve starts
      // from, not chained: x1,y1 x2,y2 x,y come off the same origin.
      const deltas = [];
      for (let i = 0; i < args.length; i += 6) {
        const x0 = cx;
        const y0 = cy;
        for (let j = 0; j < 6 && i + j < args.length; j += 2) {
          deltas.push(args[i + j] - x0, args[i + j + 1] - y0);
        }
        cx = args[i + 4];
        cy = args[i + 5];
      }
      out.push({ cmd: "c", args: deltas });
    } else if (cmd === "z" || cmd === "Z") {
      out.push({ cmd: "z", args: [] });
      cx = startX;
      cy = startY;
    } else {
      throw new Error("unsupported path command: " + cmd);
    }
  }
  return out;
}

function serialize(commands) {
  let out = "";
  for (const { cmd, args } of commands) {
    out += cmd;
    args.forEach((value, index) => {
      const text = num(value);
      if (index > 0 && !text.startsWith("-")) out += " ";
      out += text;
    });
  }
  return out;
}

/* Rebuild absolute points from the relative output and compare with the source
 * points. Guards the converter, not the format: one bad delta shifts every
 * later segment of that path. */
function verifyPath(name, original, relative) {
  const points = [];
  const rebuilt = [];
  let cx = 0;
  let cy = 0;
  for (const { cmd, args } of original) {
    for (let i = 0; i < args.length; i += 2) points.push([args[i], args[i + 1]]);
    if (cmd === "M" || cmd === "L" || cmd === "C") {
      cx = args[args.length - 2];
      cy = args[args.length - 1];
    }
  }
  cx = cy = 0;
  for (const { cmd, args } of relative) {
    if (cmd === "c") {
      for (let i = 0; i < args.length; i += 6) {
        const x0 = cx;
        const y0 = cy;
        rebuilt.push([x0 + args[i], y0 + args[i + 1]], [x0 + args[i + 2], y0 + args[i + 3]]);
        cx = x0 + args[i + 4];
        cy = y0 + args[i + 5];
        rebuilt.push([cx, cy]);
      }
    } else {
      for (let i = 0; i < args.length; i += 2) {
        cx += args[i];
        cy += args[i + 1];
        rebuilt.push([cx, cy]);
      }
    }
  }
  if (points.length !== rebuilt.length) {
    throw new Error(name + ": point count changed " + points.length + " -> " + rebuilt.length);
  }
  for (let i = 0; i < points.length; i++) {
    const dx = Math.abs(points[i][0] - rebuilt[i][0]);
    const dy = Math.abs(points[i][1] - rebuilt[i][1]);
    if (dx > 0.003 || dy > 0.003) {
      throw new Error(name + ": point " + i + " drifted by " + dx.toFixed(4) + "," + dy.toFixed(4));
    }
  }
}

/* --------------------------------------------------------------------- art */

function readPiece(name) {
  const file = path.join(ROOT, "light-" + name + ".svg");
  const source = fs.readFileSync(file, "utf8");
  const viewBox = (source.match(/viewBox="([^"]+)"/) || [])[1];
  if (!viewBox) throw new Error(file + ": no viewBox");

  const paths = [...source.matchAll(/<path\b([^>]*)>/g)].map((match, index) => {
    const attrs = match[1];
    const d = (attrs.match(/\bd="([^"]*)"/) || [])[1];
    const fill = (attrs.match(/\bfill="([^"]*)"/) || [])[1];
    const stroke = /\bstroke="/.test(attrs);
    if (!d || !fill) throw new Error(file + ": path " + index + " lacks d or fill");
    const role = (ROLE_OVERRIDES[name] || {})[index] || ART_ROLE[fill.toLowerCase()];
    if (!role) throw new Error(file + ": path " + index + " uses undeclared colour " + fill);
    return { index, d, role, stroke };
  });

  const absolute = paths.map(p => parsePath(p.d));
  const relative = absolute.map((p, i) => {
    const converted = toRelative(p);
    verifyPath(file + " path " + paths[i].index, p, converted);
    return serialize(converted);
  });

  return { name, viewBox, paths, relative };
}

/* ------------------------------------------------------------------ output */

function buildSvg(pieces) {
  const lines = [
    '<svg class="piece-sprite" width="0" height="0" aria-hidden="true" focusable="false" style="position:absolute;left:-9999px">',
  ];
  for (const piece of pieces) {
    lines.push(
      '<symbol id="p-' + piece.name + '" viewBox="' + piece.viewBox + '" preserveAspectRatio="none">'
    );
    piece.paths.forEach((p, i) => {
      const fill = ' fill="var(--p-' + p.role + ')"';
      // Stroked art inherits stroke and stroke-width from .piece; the flat fills
      // opt out explicitly, exactly as they rendered before the hoist.
      const stroke = p.stroke ? "" : ' stroke="none"';
      lines.push('<path d="' + piece.relative[i] + '"' + fill + stroke + "/>");
    });
    lines.push("</symbol>");
  }
  lines.push("</svg>");
  return lines.join("\n") + "\n";
}

function buildCss() {
  const lines = [
    "/* pieces.css — generated by generate-piece-sprite.js. Do not edit by hand.",
    "   Palette for the shared piece symbols in pieces.svg. One symbol per piece",
    "   serves both sides; these variables inherit into the <use> shadow tree, so",
    "   the same geometry paints as light or dark. */",
    ".piece {",
    "  stroke: var(--p-outline);",
    "  stroke-width: 2.2;",
    "  stroke-linejoin: round;",
    "}",
  ];
  for (const side of ["w", "b"]) {
    const vars = SIDE_VARS[side];
    lines.push('.piece[data-color="' + side + '"] {');
    lines.push("  --p-outline: var(" + vars.outline + ");");
    for (const role of ["body", "gloss", "deep", "mid", "tone", "shade", "light", "gold", "ink", "gem"]) {
      lines.push("  --p-" + role + ": var(" + vars[role] + ");");
    }
    lines.push("}");
  }
  return lines.join("\n") + "\n";
}

function main() {
  const pieces = PIECES.map(readPiece);

  const gemCount = pieces
    .flatMap(p => p.paths)
    .filter(p => p.role === "gem").length;
  if (gemCount !== 1) {
    throw new Error("expected exactly one gem path, found " + gemCount + " - ROLE_OVERRIDES is stale");
  }

  const svg = buildSvg(pieces);
  const css = buildCss();
  fs.writeFileSync(path.join(ROOT, "pieces.svg"), svg);
  fs.writeFileSync(path.join(ROOT, "pieces.css"), css);

  const paths = pieces.reduce((n, p) => n + p.paths.length, 0);
  console.log(
    "pieces.svg " + Buffer.byteLength(svg) + " B, pieces.css " + Buffer.byteLength(css) +
    " B, " + pieces.length + " symbols, " + paths + " paths"
  );
}

main();
