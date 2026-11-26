// SPDX-FileCopyrightText: 2026 subeomlee
// SPDX-License-Identifier: GPL-2.0-only

import { isCursorSample } from "./contracts";
import { findContainingDisplay } from "./geometry";
import {
  STALE_CURSOR_MS,
  type CursorSample,
  type HideReason,
} from "./types";

export type VisibilityPolicyInput = Readonly<{
  enabled: boolean;
  overlayReady: boolean;
  quitting: boolean;
  nowMs: number;
  previousDisplayGeneration: number | null;
  sample: unknown;
}>;

export type VisibilityDecision =
  | Readonly<{ kind: "hide"; reason: HideReason }>
  | Readonly<{ kind: "show"; sample: CursorSample }>;

function hide(reason: HideReason): VisibilityDecision {
  return { kind: "hide", reason };
}

export function evaluateVisibility(
  input: VisibilityPolicyInput,
): VisibilityDecision {
  if (input.quitting) {
    return hide("quitting");
  }
  if (!input.enabled) {
    return hide("disabled");
  }
  if (!input.overlayReady) {
    return hide("waiting-renderer");
  }
  if (!isCursorSample(input.sample) || !Number.isFinite(input.nowMs)) {
    return hide("screen-unknown");
  }

  const ageMs = input.nowMs - input.sample.observedAtMs;
  if (ageMs < 0 || ageMs > STALE_CURSOR_MS) {
    return hide("stale-cursor");
  }
  if (
    input.previousDisplayGeneration !== null &&
    input.sample.displayGeneration !== input.previousDisplayGeneration
  ) {
    return hide("topology-changed");
  }
  if (
    findContainingDisplay(input.sample.displays, input.sample.cursor) === null
  ) {
    return hide("screen-unknown");
  }

  return { kind: "show", sample: input.sample };
}
