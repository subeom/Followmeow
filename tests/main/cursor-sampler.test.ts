import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CursorSampler } from "../../src/main/cursor-sampler";

describe("cursor sampler", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("polls immediately and then every 16 ms", () => {
    const samples: unknown[] = [];
    const invalid = vi.fn();
    const sampler = new CursorSampler(
      {
        cursor: () => ({ x: 100, y: 200 }),
        displays: () => [
          { id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
        ],
        now: () => 1234,
      },
      (sample) => samples.push(sample),
      invalid,
    );

    sampler.start();
    vi.advanceTimersByTime(32);

    expect(samples).toHaveLength(3);
    expect(samples.map((value: any) => value.sequence)).toEqual([1, 2, 3]);
    expect(samples[0]).toMatchObject({
      observedAtMs: 1234,
      displayGeneration: 0,
    });
    expect(invalid).not.toHaveBeenCalled();
    sampler.stop();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("invalidates immediately on a thrown screen read", () => {
    const invalid = vi.fn();
    const sampler = new CursorSampler(
      {
        cursor: () => {
          throw new Error("screen unavailable");
        },
        displays: () => [],
        now: () => 500,
      },
      vi.fn(),
      invalid,
    );

    sampler.start();
    expect(invalid).toHaveBeenCalledWith("screen-unknown");
    sampler.stop();
  });

  it("increments display generation without retaining an old sample", () => {
    const samples: any[] = [];
    const sampler = new CursorSampler(
      {
        cursor: () => ({ x: 100, y: 200 }),
        displays: () => [
          { id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
        ],
        now: () => 500,
      },
      (sample) => samples.push(sample),
      vi.fn(),
    );

    sampler.noteDisplayChange();
    sampler.start();
    expect(samples[0].displayGeneration).toBe(1);
    sampler.stop();
  });
});
