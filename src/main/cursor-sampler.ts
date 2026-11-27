// SPDX-FileCopyrightText: 2026 subeomlee
// SPDX-License-Identifier: GPL-2.0-only

import { isCursorSample } from "../domain/contracts";
import {
  SAMPLE_INTERVAL_MS,
  type CursorSample,
  type DisplaySnapshot,
  type Point,
} from "../domain/types";

export interface CursorSource {
  cursor(): Point;
  displays(): readonly DisplaySnapshot[];
  now(): number;
}

export class CursorSampler {
  private timer: ReturnType<typeof setInterval> | null = null;
  private displayGeneration = 0;
  private sequence = 0;
  private displays: readonly DisplaySnapshot[] | null = null;
  private lastInvalidReason: "screen-unknown" | "stale-cursor" | null = null;
  private nextDisplayRefreshAtMs = 0;

  constructor(
    private readonly source: CursorSource,
    private readonly onSample: (sample: CursorSample) => void,
    private readonly onInvalid: (
      reason: "screen-unknown" | "stale-cursor",
    ) => void,
  ) {}

  start(): void {
    if (this.timer !== null) {
      return;
    }
    this.tick();
    this.timer = setInterval(() => this.tick(), SAMPLE_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  noteDisplayChange(): void {
    this.displayGeneration += 1;
    if (this.timer !== null) {
      try {
        this.refreshDisplays(this.source.now());
      } catch {
        this.displays = null;
        this.reportInvalid("screen-unknown");
      }
    }
  }

  private tick(): void {
    let cursor: Point;
    let observedAtMs: number;
    try {
      cursor = this.source.cursor();
      observedAtMs = this.source.now();
    } catch {
      this.reportInvalid("screen-unknown");
      return;
    }
    if (this.displays === null) {
      if (observedAtMs < this.nextDisplayRefreshAtMs) {
        this.reportInvalid("screen-unknown");
        return;
      }
      this.refreshDisplays(observedAtMs);
      if (this.displays === null) {
        return;
      }
    }

    const candidate: CursorSample = {
      cursor,
      displays: this.displays,
      displayGeneration: this.displayGeneration,
      observedAtMs,
      sequence: this.sequence + 1,
    };
    if (!isCursorSample(candidate)) {
      this.reportInvalid("screen-unknown");
      return;
    }

    this.lastInvalidReason = null;
    this.sequence = candidate.sequence;
    this.onSample(candidate);
  }

  private refreshDisplays(nowMs: number): void {
    try {
      this.displays = this.source.displays();
      if (!Array.isArray(this.displays)) {
        this.displays = null;
        this.nextDisplayRefreshAtMs = nowMs + 1_000;
        this.reportInvalid("screen-unknown");
        return;
      }
      this.nextDisplayRefreshAtMs = 0;
    } catch {
      this.displays = null;
      this.nextDisplayRefreshAtMs = nowMs + 1_000;
      this.reportInvalid("screen-unknown");
    }
  }

  private reportInvalid(reason: "screen-unknown" | "stale-cursor"): void {
    if (this.lastInvalidReason === reason) {
      return;
    }
    this.lastInvalidReason = reason;
    this.onInvalid(reason);
  }
}
