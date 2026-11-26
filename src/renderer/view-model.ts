// SPDX-FileCopyrightText: 2026 subeomlee
// SPDX-License-Identifier: GPL-2.0-only

import type { RenderFrame } from "../domain/types";

export type RenderViewModel = Readonly<{
  visible: boolean;
  asset: string;
  glyph: "" | "A" | "한";
  scaleX: -1 | 1;
}>;

const HIDDEN_MODEL: RenderViewModel = {
  visible: false,
  asset: "./assets/cat-idle.svg",
  glyph: "",
  scaleX: 1,
};

function frameAsset(frame: Extract<RenderFrame, { kind: "show" }>): string {
  if (frame.motion === "idle") {
    return "./assets/cat-idle.svg";
  }
  if (frame.motion === "turn") {
    return "./assets/cat-turn.svg";
  }
  const alternate = Math.floor(frame.phaseMs / 250) % 2 === 1;
  if (frame.motion === "walk") {
    return alternate
      ? "./assets/cat-walk-2.svg"
      : "./assets/cat-walk-1.svg";
  }
  return alternate ? "./assets/cat-run-2.svg" : "./assets/cat-run-1.svg";
}

export function toViewModel(frame: RenderFrame): RenderViewModel {
  if (frame.kind === "hide") {
    return HIDDEN_MODEL;
  }
  return {
    visible: true,
    asset: frameAsset(frame),
    glyph: frame.glyph === "hidden" ? "" : frame.glyph,
    scaleX: frame.facesRight ? 1 : -1,
  };
}
