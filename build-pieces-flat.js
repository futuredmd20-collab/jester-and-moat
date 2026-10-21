"use strict";

/* build-pieces-flat.js — builds pieces-flat.svg from the seven flat-*.svg art
 * crops.
 *
 * Each flat-*.svg is a standalone crop of the flat piece artwork: viewBox set
 * to the piece's bounding box, every path copied verbatim, every fill a
 * var(--p-*) palette variable with a light-side fallback, and a baked
 * silhouette copy of all paths painted behind the art as a uniform outline.
 * This script wraps each crop in a <symbol id="flat-p-{name}"> so
 * pieceMarkup()'s existing #flat-p-* references, the .piece-set-flat sizing
 * rules and the single-file build all keep working unchanged. Gradient defs
 * are hoisted into one shared <defs> so their ids stay document-unique.
 *
 * Run: node build-pieces-flat.js
 * The output is committed; index.html, sw.js and build.js only need to know
 * the file name. No dependencies. Fails loudly if a crop loses its viewBox,
 * its baked silhouette outline or the var(--p-*) palette, so an art edit
 * cannot silently ship broken.
 */

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PIECES = ["rook", "knight", "bishop", "queen", "king", "jester", "pawn"];

/* Raw fill colours carried over from the artwork on purpose: the jester's
 * skin-tone hat lining and the king's pale gem highlight. Any other fill that
 * is not var(--p-*) or url(#...) is an error, not a fallback. */
const ART_LITERAL_FILLS = ["rgb(198,127,115)", "rgb(189,146,213)"];

function readCrop(name) {
  const file = path.join(ROOT, "flat-" + name + ".svg");
  const source = fs.readFileSync(file, "utf8");

  const viewBox = (source.match(/viewBox="([^"]+)"/) || [])[1];
  if (!viewBox) throw new Error(file + ": no viewBox");
  if (!/<g fill="var\(--p-outline/.test(source)) {
    throw new Error(file + ": baked silhouette outline group missing");
  }

  const gradients = source.match(/<linearGradient[\s\S]*?<\/linearGradient>/g) || [];
  const gradientIds = gradients.map((g) => (g.match(/id="([^"]+)"/) || [])[1]);
  if (gradientIds.some((id) => !id)) throw new Error(file + ": gradient without id");

  const inner = source
    .replace(/^<svg[^>]*>\n?/, "")
    .replace(/<\/svg>\s*$/, "")
    .replace(/<title>[\s\S]*?<\/title>\n?/, "")
    .replace(/\s*<linearGradient[\s\S]*?<\/linearGradient>\n?/g, "")
    .replace(/\n{2,}/g, "\n")
    .trim();
  if (!inner.startsWith("<g ")) throw new Error(file + ": unexpected crop content");

  for (const match of source.matchAll(/\bfill="([^"]*)"/g)) {
    const fill = match[1];
    if (/^var\(--p-/.test(fill)) continue;
    if (fill.startsWith("url(#")) {
      const id = fill.slice(5, -1);
      if (!gradientIds.includes(id)) throw new Error(file + ": fill references missing gradient " + id);
      continue;
    }
    if (ART_LITERAL_FILLS.includes(fill)) continue;
    throw new Error(file + ": undeclared fill " + fill);
  }

  return { name, file, viewBox, gradients, gradientIds, inner };
}

function main() {
  const crops = PIECES.map(readCrop);

  const seen = new Set();
  for (const crop of crops) {
    for (const id of crop.gradientIds) {
      if (seen.has(id)) throw new Error("duplicate gradient id across crops: " + id);
      seen.add(id);
    }
  }

  const lines = [
    '<svg xmlns="http://www.w3.org/2000/svg" class="piece-sprite piece-sprite-flat" width="0" height="0" aria-hidden="true" focusable="false" style="position:absolute;left:-9999px">',
  ];
  const allGradients = crops.flatMap((c) => c.gradients);
  if (allGradients.length) {
    lines.push("<defs>");
    for (const gradient of allGradients) lines.push(gradient);
    lines.push("</defs>");
  }
  for (const crop of crops) {
    lines.push('<symbol id="flat-p-' + crop.name + '" viewBox="' + crop.viewBox + '" preserveAspectRatio="none">');
    lines.push(crop.inner);
    lines.push("</symbol>");
  }
  lines.push("</svg>");
  const svg = lines.join("\n") + "\n";

  fs.writeFileSync(path.join(ROOT, "pieces-flat.svg"), svg);
  console.log(
    "pieces-flat.svg " + Buffer.byteLength(svg) + " B, " +
    crops.length + " symbols, " + allGradients.length + " gradients"
  );
}

main();
