import { describe, expect, it } from "vitest";
import { evaluateVisibility } from "../../src/domain/policy";
import type { CursorSample } from "../../src/domain/types";

const current: CursorSample = {
  cursor: { x: 400, y: 300 },
  displays: [{ id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 } }],
  displayGeneration: 2,
  observedAtMs: 9_900,
  sequence: 3,
};

const ready = {
  enabled: true,
  overlayReady: true,
  quitting: false,
  nowMs: 10_000,
  previousDisplayGeneration: 2,
  sample: current as unknown,
};

describe("visibility policy", () => {
  it("shows only a valid, current, on-screen sample", () => {
    expect(evaluateVisibility(ready)).toEqual({ kind: "show", sample: current });
  });

  it.each([
    [{ enabled: false }, "disabled"],
    [{ overlayReady: false }, "waiting-renderer"],
    [{ quitting: true }, "quitting"],
    [{ nowMs: 10_151 }, "stale-cursor"],
    [{ nowMs: 9_800 }, "stale-cursor"],
    [{ sample: { ...current, cursor: { x: 4000, y: 300 } } }, "screen-unknown"],
    [{ previousDisplayGeneration: 1 }, "topology-changed"],
  ] as const)("hides for %o with %s", (change, reason) => {
    expect(evaluateVisibility({ ...ready, ...change })).toEqual({
      kind: "hide",
      reason,
    });
  });

  it("rejects malformed samples without reusing stale state", () => {
    expect(
      evaluateVisibility({
        ...ready,
        sample: { ...current, cursor: { x: Number.NaN, y: 0 } },
      }),
    ).toEqual({ kind: "hide", reason: "screen-unknown" });
  });
});
