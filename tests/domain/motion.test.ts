import { describe, expect, it } from "vitest";
import {
  SpringFollower,
  TurnTracker,
  chooseMotionState,
} from "../../src/domain/motion";

describe("motion state", () => {
  it.each([
    [{ speed: 29.9, displacement: 2, lag: 1, stoppedMs: 0 }, "idle"],
    [{ speed: 30, displacement: 0, lag: 0, stoppedMs: 0 }, "walk"],
    [{ speed: 0, displacement: 3, lag: 0, stoppedMs: 0 }, "walk"],
    [{ speed: 650, displacement: 0, lag: 0, stoppedMs: 0 }, "run"],
    [{ speed: 0, displacement: 0, lag: 24, stoppedMs: 0 }, "run"],
  ] as const)("chooses %s as %s", (metrics, expected) => {
    expect(chooseMotionState("idle", metrics, false)).toBe(expected);
  });

  it("settles to idle only after 180 ms", () => {
    expect(
      chooseMotionState(
        "run",
        { speed: 0, displacement: 0, lag: 0, stoppedMs: 179 },
        false,
      ),
    ).toBe("run");
    expect(
      chooseMotionState(
        "run",
        { speed: 0, displacement: 0, lag: 0, stoppedMs: 180 },
        false,
      ),
    ).toBe("idle");
  });

  it("forces reduced motion to idle", () => {
    expect(
      chooseMotionState(
        "run",
        { speed: 2_000, displacement: 200, lag: 100, stoppedMs: 0 },
        true,
      ),
    ).toBe("idle");
  });
});

describe("spring and turn", () => {
  it("converges in fixed steps without exceeding 1600 DIP/s", () => {
    const follower = new SpringFollower({ x: 0, y: 0 });
    let maximumSpeed = 0;
    for (let i = 0; i < 180; i += 1) {
      follower.step({ x: 100, y: 0 }, 1 / 60, 100);
      maximumSpeed = Math.max(
        maximumSpeed,
        Math.hypot(follower.velocity.x, follower.velocity.y),
      );
    }
    expect(maximumSpeed).toBeLessThanOrEqual(1600);
    expect(follower.position.x).toBeCloseTo(100, 1);
  });

  it("holds a turn for 120 ms and prevents a lockout retrigger", () => {
    const turn = new TurnTracker();
    expect(turn.update(0, true, true, 0)).toBe(false);
    expect(turn.update(12, true, false, 1_000)).toBe(true);
    expect(turn.update(-12, false, false, 1_050)).toBe(true);
    expect(turn.update(-24, false, false, 1_120)).toBe(false);
    expect(turn.update(-36, false, false, 1_130)).toBe(false);
    expect(turn.update(24, false, true, 1_161)).toBe(true);
  });

  it("clears active and lockout turn state on reset", () => {
    const turn = new TurnTracker();
    expect(turn.update(12, true, false, 1_000)).toBe(true);
    turn.reset();
    expect(turn.activeAt(1_050)).toBe(false);
    expect(turn.update(12, true, false, 1_050)).toBe(true);
  });

  it("accumulates opposite-direction movement below the turn threshold", () => {
    const turn = new TurnTracker();
    expect(turn.update(-8, true, false, 1_000)).toBe(false);
    expect(turn.update(0, true, null, 1_016)).toBe(false);
    expect(turn.update(-8, true, false, 1_032)).toBe(true);
  });

  it("accumulates a symmetric right reversal through stationary polling", () => {
    const turn = new TurnTracker();
    expect(turn.update(8, false, true, 1_000)).toBe(false);
    expect(turn.update(0, false, null, 1_016)).toBe(false);
    expect(turn.update(8, false, true, 1_032)).toBe(true);
  });

  it("reduces, rather than resets, progress on opposite-direction jitter", () => {
    const turn = new TurnTracker();
    expect(turn.update(-10, true, false, 1_000)).toBe(false);
    expect(turn.update(3, true, true, 1_016)).toBe(false);
    expect(turn.update(-5, true, false, 1_032)).toBe(true);
  });
});
