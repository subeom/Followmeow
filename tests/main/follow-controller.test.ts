import { describe, expect, it } from "vitest";
import { defaultSettings } from "../../src/domain/settings";
import type { CursorSample, RenderFrame } from "../../src/domain/types";
import { FollowController } from "../../src/main/follow-controller";

const sample = (
  sequence: number,
  x: number,
  now: number,
): CursorSample => ({
  cursor: { x, y: 400 },
  displays: [{ id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 } }],
  displayGeneration: 0,
  observedAtMs: now,
  sequence,
});

function excludesCursor(
  frame: Extract<RenderFrame, { kind: "show" }>,
  cursor: Readonly<{ x: number; y: number }>,
): boolean {
  return (
    frame.bounds.x >= cursor.x ||
    frame.bounds.x + frame.bounds.width <= cursor.x
  );
}

describe("follow controller", () => {
  it("emits ordered show frames and a manual torso glyph", () => {
    const frames: RenderFrame[] = [];
    const controller = new FollowController(
      { ...defaultSettings("darwin"), languageMode: "한" },
      false,
      (frame) => frames.push(frame),
    );
    controller.rendererReady();
    controller.tick(sample(1, 500, 1_000), 1_000);
    controller.tick(sample(2, 505, 1_016), 1_016);

    expect(frames.at(-1)).toMatchObject({
      kind: "show",
      sequence: 2,
      glyph: "한",
      motion: "walk",
    });
  });

  it("hides stale samples without preserving the glyph", () => {
    const frames: RenderFrame[] = [];
    const controller = new FollowController(
      { ...defaultSettings("win32"), languageMode: "A" },
      false,
      (frame) => frames.push(frame),
    );
    controller.rendererReady();
    controller.tick(sample(1, 500, 1_000), 1_000);
    controller.tick(sample(2, 501, 1_001), 1_300);

    expect(frames.at(-1)).toEqual({
      kind: "hide",
      sequence: 2,
      observedAtMs: 1_300,
      reason: "stale-cursor",
    });
  });

  it("resets rather than animating across display generations", () => {
    const frames: RenderFrame[] = [];
    const controller = new FollowController(
      defaultSettings("darwin"),
      false,
      (frame) => frames.push(frame),
    );
    controller.rendererReady();
    controller.tick(sample(1, 500, 1_000), 1_000);
    const changed: CursorSample = {
      ...sample(2, 2_200, 1_016),
      displays: [
        { id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
        { id: 2, bounds: { x: 1920, y: 0, width: 1920, height: 1080 } },
      ],
      displayGeneration: 1,
    };
    controller.tick(changed, 1_016);
    controller.tick(changed, 1_016);

    expect(frames[1]).toMatchObject({
      kind: "hide",
      reason: "topology-changed",
    });
    expect(frames[2]).toMatchObject({ kind: "show" });
    if (frames[2]?.kind === "show") {
      expect(frames[2].bounds.x).toBeGreaterThanOrEqual(1_928);
    }
  });

  it("hides an automatic glyph until a fresh provider observation exists", () => {
    const frames: RenderFrame[] = [];
    const controller = new FollowController(
      defaultSettings("darwin"),
      false,
      (frame) => frames.push(frame),
    );
    controller.rendererReady();
    controller.tick(sample(1, 500, 1_000), 1_000);
    expect(frames[0]).toMatchObject({ kind: "show", glyph: "hidden" });

    controller.setAutomaticLanguage({
      glyph: "한",
      observedAtMs: 1_010,
    });
    controller.tick(sample(2, 501, 1_016), 1_016);
    expect(frames.at(-1)).toMatchObject({ kind: "show", glyph: "한" });

    controller.tick(sample(3, 502, 4_100), 4_100);
    expect(frames.at(-1)).toMatchObject({ kind: "show", glyph: "hidden" });
  });

  it("jumps to the clamped target in reduced-motion mode", () => {
    const frames: RenderFrame[] = [];
    const controller = new FollowController(
      defaultSettings("darwin"),
      true,
      (frame) => frames.push(frame),
    );
    controller.rendererReady();
    controller.tick(sample(1, 50, 1_000), 1_000);
    controller.tick(sample(2, 1_880, 1_016), 1_016);

    expect(frames.at(-1)).toMatchObject({ kind: "show", motion: "idle" });
    if (frames.at(-1)?.kind === "show") {
      expect((frames.at(-1) as Extract<RenderFrame, { kind: "show" }>).bounds.x)
        .toBeLessThanOrEqual(1_768);
    }
  });

  it("recovers after repeated invalidations with a monotonic output sequence", () => {
    const frames: RenderFrame[] = [];
    const controller = new FollowController(
      defaultSettings("darwin"),
      false,
      (frame) => frames.push(frame),
    );
    controller.rendererReady();
    controller.tick(sample(1, 500, 1_000), 1_000);
    for (let index = 0; index < 10; index += 1) {
      controller.invalidate("screen-unknown", 1_010 + index);
    }

    controller.tick(sample(2, 520, 1_100), 1_100);
    expect(frames.at(-1)).toMatchObject({
      kind: "show",
      sequence: 3,
      glyph: "hidden",
    });
    expect(frames.map((frame) => frame.sequence)).toEqual([1, 2, 3]);
  });

  it.each(["stale-cursor", "screen-unknown"] as const)(
    "initializes at the next target after a %s discontinuity",
    (reason) => {
      const frames: RenderFrame[] = [];
      const controller = new FollowController(
        defaultSettings("darwin"),
        false,
        (frame) => frames.push(frame),
      );
      controller.rendererReady();
      controller.tick(sample(1, 100, 1_000), 1_000);
      if (reason === "stale-cursor") {
        controller.tick(sample(2, 110, 1_016), 1_300);
      } else {
        controller.tick(sample(2, 2_100, 1_016), 1_016);
      }
      expect(frames.at(-1)).toMatchObject({ kind: "hide", reason });

      controller.tick(sample(3, 1_000, 1_316), 1_316);
      const recovered = frames.at(-1);
      expect(recovered).toMatchObject({ kind: "show", motion: "idle" });
      if (recovered?.kind === "show") {
        expect(recovered.bounds.x).toBeCloseTo(822, 6);
      }
    },
  );

  it("keeps facing through a 1-DIP reversal and commits at the turn threshold", () => {
    const frames: RenderFrame[] = [];
    const controller = new FollowController(
      defaultSettings("darwin"),
      false,
      (frame) => frames.push(frame),
    );
    controller.rendererReady();
    controller.tick(sample(1, 500, 1_000), 1_000);
    controller.tick(sample(2, 499, 1_016), 1_016);
    expect(frames.at(-1)).toMatchObject({ facesRight: true });

    controller.tick(sample(3, 480, 1_032), 1_032);
    expect(frames.at(-1)).toMatchObject({
      facesRight: false,
      motion: "turn",
    });
    controller.tick(sample(4, 481, 1_033), 1_033);
    expect(frames.at(-1)).toMatchObject({
      facesRight: false,
      motion: "turn",
    });
  });

  it("accumulates repeated sub-threshold cursor movement into one turn", () => {
    const frames: RenderFrame[] = [];
    const controller = new FollowController(
      defaultSettings("darwin"),
      false,
      (frame) => frames.push(frame),
    );
    controller.rendererReady();
    controller.tick(sample(1, 500, 1_000), 1_000);
    controller.tick(sample(2, 492, 1_016), 1_016);
    expect(frames.at(-1)).toMatchObject({ facesRight: true });

    controller.tick(sample(3, 492, 1_032), 1_032);
    expect(frames.at(-1)).toMatchObject({ facesRight: true });

    controller.tick(sample(4, 484, 1_048), 1_048);
    expect(frames.at(-1)).toMatchObject({
      facesRight: false,
      motion: "turn",
    });
    const turnStart = frames.length - 1;
    for (let index = 0; index < 60; index += 1) {
      controller.tick(
        sample(5 + index, 484, 1_064 + index * 16),
        1_064 + index * 16,
      );
    }
    const settledHeading = frames.at(-1);
    expect(settledHeading?.kind).toBe("show");
    if (settledHeading?.kind === "show") {
      expect(settledHeading.bounds.x).toBeGreaterThan(400);
    }
    for (const frame of frames.slice(turnStart)) {
      if (frame.kind === "show") {
        expect(excludesCursor(frame, { x: 484, y: 400 })).toBe(true);
      }
    }
  });

  it("does not commit heading against the 160 ms turn lockout", () => {
    const frames: RenderFrame[] = [];
    const controller = new FollowController(
      defaultSettings("darwin"),
      false,
      (frame) => frames.push(frame),
    );
    controller.rendererReady();
    controller.tick(sample(1, 500, 1_000), 1_000);
    controller.tick(sample(2, 480, 1_016), 1_016);
    controller.tick(sample(3, 500, 1_137), 1_137);
    for (let index = 0; index < 8; index += 1) {
      controller.tick(
        sample(4 + index, 500, 1_153 + index * 16),
        1_153 + index * 16,
      );
    }

    const followingFrames = frames.slice(2);
    expect(followingFrames.length).toBeGreaterThan(0);
    for (const frame of followingFrames) {
      expect(frame.kind).toBe("show");
      if (frame.kind === "show") {
        expect(excludesCursor(frame, { x: 500, y: 400 })).toBe(true);
      }
    }
    const settled = followingFrames.at(-1);
    expect(settled?.kind).toBe("show");
    if (settled?.kind === "show") {
      expect(settled.bounds.x).toBeGreaterThanOrEqual(500);
    }
  });

  it.each([
    [{ x: 20, y: 400 }, 1_000],
    [{ x: 1_900, y: 400 }, 1_000],
  ] as const)("places edge frames without containing cursor %o", (cursor, now) => {
    const frames: RenderFrame[] = [];
    const controller = new FollowController(
      defaultSettings("darwin"),
      false,
      (frame) => frames.push(frame),
    );
    controller.rendererReady();
    controller.tick(
      {
        cursor,
        displays: [
          { id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
        ],
        displayGeneration: 0,
        observedAtMs: now,
        sequence: 1,
      },
      now,
    );
    const frame = frames.at(-1);
    expect(frame?.kind).toBe("show");
    if (frame?.kind === "show") {
      expect(excludesCursor(frame, cursor)).toBe(true);
      expect(frame.bounds.x).toBeGreaterThanOrEqual(8);
      expect(frame.bounds.x + frame.bounds.width).toBeLessThanOrEqual(1_912);
    }
  });

  it("never interpolates a committed turn through the cursor", () => {
    const frames: RenderFrame[] = [];
    const controller = new FollowController(
      defaultSettings("darwin"),
      false,
      (frame) => frames.push(frame),
    );
    controller.rendererReady();
    controller.tick(sample(1, 500, 1_000), 1_000);
    controller.tick(sample(2, 480, 1_016), 1_016);
    const turnStart = frames.length - 1;
    for (let index = 0; index < 12; index += 1) {
      controller.tick(
        sample(3 + index, 480, 1_032 + index * 16),
        1_032 + index * 16,
      );
    }

    for (const frame of frames.slice(turnStart)) {
      expect(frame.kind).toBe("show");
      if (frame.kind === "show") {
        expect(excludesCursor(frame, { x: 480, y: 400 })).toBe(true);
      }
    }
  });

  it("does not accumulate alternating 1-DIP reversal noise", () => {
    const frames: RenderFrame[] = [];
    const controller = new FollowController(
      defaultSettings("darwin"),
      false,
      (frame) => frames.push(frame),
    );
    controller.rendererReady();
    controller.tick(sample(1, 500, 1_000), 1_000);
    for (let index = 0; index < 20; index += 1) {
      controller.tick(
        sample(2 + index, index % 2 === 0 ? 499 : 500, 1_016 + index * 16),
        1_016 + index * 16,
      );
      const frame = frames.at(-1);
      expect(frame).toMatchObject({ facesRight: true });
    }
  });

  it.each([
    [16, 120, "walk"],
    [100, 16, "run"],
  ] as const)(
    "returns to the %s-point normal baseline exactly when turn expires",
    (displacement, elapsedMs, baseline) => {
      const frames: RenderFrame[] = [];
      const controller = new FollowController(
        defaultSettings("darwin"),
        false,
        (frame) => frames.push(frame),
      );
      controller.rendererReady();
      controller.tick(sample(1, 500, 1_000), 1_000);
      const turnStartMs = 1_000 + elapsedMs;
      const reversedX = 500 - displacement;
      controller.tick(
        sample(2, reversedX, turnStartMs),
        turnStartMs,
      );
      expect(frames.at(-1)).toMatchObject({
        motion: "turn",
        facesRight: false,
      });

      controller.tick(
        sample(3, reversedX, turnStartMs + 119),
        turnStartMs + 119,
      );
      expect(frames.at(-1)).toMatchObject({ motion: "turn" });

      controller.tick(
        sample(4, reversedX, turnStartMs + 120),
        turnStartMs + 120,
      );
      expect(frames.at(-1)).toMatchObject({ motion: baseline });

      controller.tick(
        sample(5, reversedX, turnStartMs + 121),
        turnStartMs + 121,
      );
      expect(frames.at(-1)).toMatchObject({ motion: baseline });

      controller.tick(
        sample(6, reversedX, turnStartMs + 180),
        turnStartMs + 180,
      );
      expect(frames.at(-1)).toMatchObject({ motion: "idle" });
    },
  );

  it("keeps reduced motion on the idle baseline during a reversal", () => {
    const frames: RenderFrame[] = [];
    const controller = new FollowController(
      defaultSettings("darwin"),
      true,
      (frame) => frames.push(frame),
    );
    controller.rendererReady();
    controller.tick(sample(1, 500, 1_000), 1_000);
    controller.tick(sample(2, 480, 1_016), 1_016);
    controller.tick(sample(3, 480, 1_032), 1_032);

    for (const frame of frames) {
      expect(frame.kind).toBe("show");
      if (frame.kind === "show") {
        expect(frame.motion).toBe("idle");
        expect(excludesCursor(frame, { x: 480, y: 400 })).toBe(true);
      }
    }
  });

  it("emits one visual frame for 36,000 unchanged idle ticks", () => {
    const frames: RenderFrame[] = [];
    const controller = new FollowController(
      { ...defaultSettings("darwin"), languageMode: "hidden" },
      false,
      (frame) => frames.push(frame),
    );
    controller.rendererReady();

    for (let index = 0; index < 36_000; index += 1) {
      controller.tick(
        sample(index + 1, 500, 1_000 + index * 16),
        1_000 + index * 16,
      );
    }

    expect(frames).toHaveLength(1);
    expect(frames[0]).toMatchObject({
      kind: "show",
      sequence: 1,
      motion: "idle",
    });
  });

  it("emits a fresh sequence after a deduplicated hide transition", () => {
    const frames: RenderFrame[] = [];
    const controller = new FollowController(
      defaultSettings("darwin"),
      false,
      (frame) => frames.push(frame),
    );
    controller.rendererReady();
    controller.tick(sample(1, 500, 1_000), 1_000);
    controller.invalidate("screen-unknown", 1_010);
    controller.invalidate("screen-unknown", 1_011);
    controller.tick(sample(2, 500, 1_020), 1_020);

    expect(frames.map((frame) => frame.sequence)).toEqual([1, 2, 3]);
    expect(frames[1]).toMatchObject({
      kind: "hide",
      reason: "screen-unknown",
    });
    expect(frames[2]).toMatchObject({ kind: "show" });
  });
});
