import { describe, expect, it } from "vitest";
import { isCursorSample, isRenderFrame } from "../../src/domain/contracts";
import type { CursorSample, RenderFrame } from "../../src/domain/types";

const sample: CursorSample = {
  cursor: { x: -120.5, y: 40 },
  displays: [{ id: 7, bounds: { x: -1920, y: 0, width: 1920, height: 1080 } }],
  displayGeneration: 3,
  observedAtMs: 10_000,
  sequence: 5,
};

describe("runtime contracts", () => {
  it("accepts a finite negative-origin cursor sample", () => {
    expect(isCursorSample(sample)).toBe(true);
  });

  it("rejects non-finite coordinates and invalid display bounds", () => {
    expect(isCursorSample({ ...sample, cursor: { x: Number.NaN, y: 40 } })).toBe(false);
    expect(
      isCursorSample({
        ...sample,
        displays: [{ id: 7, bounds: { x: 0, y: 0, width: 0, height: 1080 } }],
      }),
    ).toBe(false);
  });

  it("accepts show and hide frames but rejects invalid shape data", () => {
    const show: RenderFrame = {
      kind: "show",
      sequence: 9,
      observedAtMs: 10_016,
      bounds: { x: 10, y: 20, width: 144, height: 96 },
      motion: "walk",
      facesRight: true,
      glyph: "한",
      phaseMs: 32,
    };
    const hide: RenderFrame = {
      kind: "hide",
      sequence: 10,
      observedAtMs: 10_032,
      reason: "stale-cursor",
    };

    expect(isRenderFrame(show)).toBe(true);
    expect(isRenderFrame(hide)).toBe(true);
    expect(isRenderFrame({ ...show, bounds: { ...show.bounds, width: -1 } })).toBe(false);
    expect(isRenderFrame({ ...show, sequence: -1 })).toBe(false);
  });
});
