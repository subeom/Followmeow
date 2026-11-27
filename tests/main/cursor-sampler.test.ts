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

  it("queries topology only at start and explicit display invalidation", () => {
    const displays = vi.fn(() => [
      { id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
    ]);
    const sampler = new CursorSampler(
      {
        cursor: () => ({ x: 100, y: 200 }),
        displays,
        now: () => 1234,
      },
      vi.fn(),
      vi.fn(),
    );

    sampler.start();
    vi.advanceTimersByTime(32);
    expect(displays).toHaveBeenCalledTimes(1);

    sampler.noteDisplayChange();
    expect(displays).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(32);
    expect(displays).toHaveBeenCalledTimes(2);
    sampler.stop();
  });

  it("hides immediately if topology refresh fails", () => {
    let fail = false;
    const invalid = vi.fn();
    const sampler = new CursorSampler(
      {
        cursor: () => ({ x: 100, y: 200 }),
        displays: () => {
          if (fail) {
            throw new Error("display refresh failed");
          }
          return [
            { id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
          ];
        },
        now: () => 1234,
      },
      vi.fn(),
      invalid,
    );

    sampler.start();
    fail = true;
    sampler.noteDisplayChange();
    expect(invalid).toHaveBeenCalledWith("screen-unknown");
    sampler.stop();
  });

  it("retries a failed topology refresh after one second", () => {
    let now = 1_234;
    let fail = true;
    const displays = vi.fn(() => {
      if (fail) {
        throw new Error("temporary display failure");
      }
      return [
        { id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
      ];
    });
    const samples: unknown[] = [];
    const invalid = vi.fn();
    const sampler = new CursorSampler(
      {
        cursor: () => ({ x: 100, y: 200 }),
        displays,
        now: () => now,
      },
      (sample) => samples.push(sample),
      invalid,
    );

    sampler.start();
    expect(displays).toHaveBeenCalledTimes(1);
    expect(invalid).toHaveBeenCalledWith("screen-unknown");

    now = 2_233;
    vi.advanceTimersByTime(16);
    expect(displays).toHaveBeenCalledTimes(1);

    fail = false;
    now = 2_234;
    vi.advanceTimersByTime(16);
    expect(displays).toHaveBeenCalledTimes(2);
    expect(samples).toHaveLength(1);
    sampler.stop();
  });

  it("refreshes changed topology after a stop/start cycle", () => {
    let now = 1_000;
    let displays = [
      { id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
    ];
    const samples: any[] = [];
    const sampler = new CursorSampler(
      {
        cursor: () => ({ x: 100, y: 200 }),
        displays: () => displays,
        now: () => now,
      },
      (sample) => samples.push(sample),
      vi.fn(),
    );

    sampler.start();
    sampler.stop();
    displays = [
      { id: 2, bounds: { x: -1600, y: 0, width: 1600, height: 900 } },
    ];
    sampler.noteDisplayChange();
    now = 2_000;
    sampler.start();

    expect(samples.at(-1).displays).toEqual(displays);
    expect(samples.at(-1).displayGeneration).toBe(1);
    sampler.stop();
  });

  it("does not retain an empty topology and retries it", () => {
    let now = 1_000;
    let displays: Array<{
      id: number;
      bounds: { x: number; y: number; width: number; height: number };
    }> = [];
    const readDisplays = vi.fn(() => displays);
    const samples: unknown[] = [];
    const sampler = new CursorSampler(
      {
        cursor: () => ({ x: 100, y: 200 }),
        displays: readDisplays,
        now: () => now,
      },
      (sample) => samples.push(sample),
      vi.fn(),
    );

    sampler.start();
    now = 1_999;
    vi.advanceTimersByTime(16);
    expect(readDisplays).toHaveBeenCalledTimes(1);

    displays = [
      { id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
    ];
    now = 2_000;
    vi.advanceTimersByTime(16);
    expect(readDisplays).toHaveBeenCalledTimes(2);
    expect(samples).toHaveLength(1);
    sampler.stop();
  });
});
