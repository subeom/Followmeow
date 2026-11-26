// SPDX-FileCopyrightText: 2026 subeomlee
// SPDX-License-Identifier: GPL-2.0-only

import { mkdir, readFile, writeFile } from "node:fs/promises";

const artworkRoot = new URL("../artwork/source/", import.meta.url);
const outputRoot = new URL("../src/renderer/assets/", import.meta.url);

function element(source, opening) {
  const start = source.indexOf(opening);
  if (start < 0) {
    throw new Error(`approved SVG is missing ${opening}`);
  }
  const tagName = opening.slice(1, opening.indexOf(">"));
  const closing = `</${tagName}>`;
  const end = source.indexOf(closing, start);
  if (end < 0) {
    throw new Error(`approved SVG has an unclosed ${tagName}`);
  }
  return source.slice(start, end + closing.length);
}

function group(source, opening) {
  const start = source.indexOf(opening);
  if (start < 0) {
    throw new Error(`approved SVG is missing ${opening}`);
  }
  const tags = /<\/g>|<g\b[^>]*>/g;
  tags.lastIndex = start;
  let depth = 0;
  let match;
  while ((match = tags.exec(source)) !== null) {
    const token = match[0];
    depth += token.startsWith("</") ? -1 : token.endsWith("/>") ? 0 : 1;
    if (depth === 0) {
      const end = tags.lastIndex;
      return source.slice(start, end);
    }
  }
  throw new Error(`approved SVG has an unclosed group ${opening}`);
}

function poseSvg(definitions, poseId) {
  if (!definitions.includes(`id="${poseId}"`)) {
    throw new Error(`approved SVG is missing pose ${poseId}`);
  }
  return clean(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="144" height="96" viewBox="60 20 540 360" role="img" aria-hidden="true">
${definitions}
<use href="#${poseId}" xlink:href="#${poseId}"/>
</svg>
`);
}

function turnSvg(source) {
  const globalDefinitions = element(source, "<defs>");
  const hero = group(
    source,
    '<g transform="translate(733.00 638.00) scale(1.64)">',
  );
  const openingEnd = hero.indexOf(">");
  const inner = hero.slice(openingEnd + 1, hero.lastIndexOf("</g>"));
  const glyphStart = inner.lastIndexOf(
    '<g transform="translate(21.06 -126.33)">',
  );
  if (glyphStart < 0) {
    throw new Error("approved turn SVG is missing the removable glyph group");
  }
  const glyphEnd = inner.indexOf("</g>", glyphStart);
  const body = `${inner.slice(0, glyphStart)}${inner.slice(glyphEnd + 4)}`;
  return clean(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="144" height="96" viewBox="-260 -260 520 347" role="img" aria-hidden="true">
${globalDefinitions}
${body}
</svg>
`);
}

function clean(svg) {
  return `${svg.replace(/[ \t]+$/gm, "").trimEnd()}\n`;
}

const poses = [
  ["cat-idle.svg", "sit"],
  ["cat-walk-1.svg", "walk-reach"],
  ["cat-walk-2.svg", "walk-pass"],
  ["cat-run-1.svg", "run-air"],
  ["cat-run-2.svg", "run-land"],
];

await mkdir(outputRoot, { recursive: true });
const poseSource = await readFile(
  new URL("cat-poses.svg", artworkRoot),
  "utf8",
);
const definitions = element(poseSource, "<defs>");
for (const [name, id] of poses) {
  await writeFile(new URL(name, outputRoot), poseSvg(definitions, id));
}

const turnSource = await readFile(new URL("05-turn.svg", artworkRoot), "utf8");
await writeFile(new URL("cat-turn.svg", outputRoot), turnSvg(turnSource));
