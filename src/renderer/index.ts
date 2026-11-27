// SPDX-FileCopyrightText: 2026 subeomlee
// SPDX-License-Identifier: GPL-2.0-only

import type { RenderFrame } from "../domain/types";
import { toViewModel } from "./view-model";
import { GlyphTransition } from "./glyph-transition";

declare global {
  interface Window {
    followmeow: Readonly<{
      ready: () => void;
      onFrame: (listener: (frame: RenderFrame) => void) => () => void;
    }>;
  }
}

const canvas = document.querySelector<HTMLElement>("#followmeow-canvas");
const cat = document.querySelector<HTMLImageElement>("#followmeow-cat");
const glyph = document.querySelector<HTMLElement>("#followmeow-glyph");

if (canvas === null || cat === null || glyph === null) {
  throw new Error("Followmeow renderer DOM is incomplete");
}

let lastSequence = -1;
const glyphTransition = new GlyphTransition(
  glyph,
  window.matchMedia("(prefers-reduced-motion: reduce)").matches,
);
window.followmeow.onFrame((frame) => {
  if (frame.sequence <= lastSequence) {
    return;
  }
  lastSequence = frame.sequence;

  const model = toViewModel(frame);
  canvas.dataset.visible = String(model.visible);
  canvas.dataset.facing = model.scaleX === 1 ? "right" : "left";
  cat.src = model.asset;
  cat.style.transform = `scaleX(${model.scaleX})`;
  glyphTransition.update(model.glyph);
});

window.followmeow.ready();
