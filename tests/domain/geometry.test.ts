import { describe, expect, it } from "vitest";
import {
  clampOverlayOrigin,
  desiredOverlayOrigin,
  findContainingDisplay,
} from "../../src/domain/geometry";
import type { DisplaySnapshot } from "../../src/domain/types";

const left: DisplaySnapshot = {
  id: 2,
  bounds: { x: -1920, y: 0, width: 1920, height: 1080 },
};
const primary: DisplaySnapshot = {
  id: 1,
  bounds: { x: 0, y: 0, width: 1920, height: 1080 },
};

describe("display geometry", () => {
  it("finds a negative-origin display and preserves snapshot order at an edge", () => {
    expect(findContainingDisplay([left, primary], { x: -100, y: 500 })?.id).toBe(2);
    expect(findContainingDisplay([left, primary], { x: 0, y: 500 })?.id).toBe(2);
    expect(findContainingDisplay([primary], { x: 2000, y: 500 })).toBeNull();
  });

  it("places the leading edge 34 DIP behind a right-facing cursor", () => {
    expect(desiredOverlayOrigin({ x: 1000, y: 500 }, { x: 1, y: 0 })).toEqual({
      x: 822,
      y: 452,
    });
  });

  it("mirrors the follower position for a left-facing cursor", () => {
    expect(desiredOverlayOrigin({ x: 1000, y: 500 }, { x: -1, y: 0 })).toEqual({
      x: 1034,
      y: 452,
    });
  });

  it("clamps every edge within the display plus 8 DIP", () => {
    expect(clampOverlayOrigin({ x: -2000, y: -10 }, left)).toEqual({
      x: -1912,
      y: 8,
    });
    expect(clampOverlayOrigin({ x: 1800, y: 1000 }, primary)).toEqual({
      x: 1768,
      y: 976,
    });
  });

  it("rejects a non-finite origin or a display smaller than the overlay", () => {
    expect(() =>
      desiredOverlayOrigin({ x: Number.POSITIVE_INFINITY, y: 0 }, { x: 1, y: 0 }),
    ).toThrow(RangeError);
    expect(clampOverlayOrigin({ x: Number.NaN, y: 0 }, primary)).toBeNull();
    expect(
      clampOverlayOrigin(
        { x: 0, y: 0 },
        { id: 3, bounds: { x: 0, y: 0, width: 100, height: 100 } },
      ),
    ).toBeNull();
  });
});
