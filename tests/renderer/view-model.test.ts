import { describe, expect, it } from "vitest";
import { toViewModel } from "../../src/renderer/view-model";
import type { RenderFrame } from "../../src/domain/types";

describe("renderer view model", () => {
  it.each([
    ["idle", "./assets/cat-idle.svg"],
    ["walk", "./assets/cat-walk-1.svg"],
    ["run", "./assets/cat-run-1.svg"],
    ["turn", "./assets/cat-turn.svg"],
  ] as const)("maps %s to %s", (motion, asset) => {
    const model = toViewModel({
      kind: "show",
      sequence: 1,
      observedAtMs: 1,
      bounds: { x: 2, y: 3, width: 144, height: 96 },
      motion,
      facesRight: true,
      glyph: "A",
      phaseMs: 0,
    });
    expect(model.asset).toBe(asset);
    expect(model.glyph).toBe("A");
    expect(model.scaleX).toBe(1);
  });

  it("alternates walk assets, mirrors left, and clears hidden frames", () => {
    const base: RenderFrame = {
      kind: "show",
      sequence: 2,
      observedAtMs: 2,
      bounds: { x: 2, y: 3, width: 144, height: 96 },
      motion: "walk",
      facesRight: false,
      glyph: "hidden",
      phaseMs: 400,
    };
    expect(toViewModel(base)).toMatchObject({
      asset: "./assets/cat-walk-2.svg",
      glyph: "",
      scaleX: -1,
    });
    expect(
      toViewModel({
        kind: "hide",
        sequence: 3,
        observedAtMs: 3,
        reason: "stale-cursor",
      }),
    ).toEqual({
      visible: false,
      asset: "./assets/cat-idle.svg",
      glyph: "",
      scaleX: 1,
    });
  });
});
