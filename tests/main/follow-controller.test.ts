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
});
