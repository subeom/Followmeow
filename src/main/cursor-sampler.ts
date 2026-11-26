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
  }

  private tick(): void {
    let cursor: Point;
    let displays: readonly DisplaySnapshot[];
    let observedAtMs: number;
    try {
      cursor = this.source.cursor();
      displays = this.source.displays();
      observedAtMs = this.source.now();
    } catch {
      this.onInvalid("screen-unknown");
      return;
    }

    const candidate: CursorSample = {
      cursor,
      displays,
      displayGeneration: this.displayGeneration,
      observedAtMs,
      sequence: this.sequence + 1,
    };
    if (!isCursorSample(candidate)) {
      this.onInvalid("screen-unknown");
      return;
    }

    this.sequence = candidate.sequence;
    this.onSample(candidate);
  }
}
