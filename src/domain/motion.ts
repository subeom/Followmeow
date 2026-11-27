// SPDX-FileCopyrightText: 2026 subeomlee
// SPDX-License-Identifier: GPL-2.0-only

import type { MotionState, Point } from "./types";

export type MotionMetrics = Readonly<{
  speed: number;
  displacement: number;
  lag: number;
  stoppedMs: number;
}>;

const STIFFNESS = 110;
const DAMPING = 21;
const MAXIMUM_SPEED = 1_600;
const WALK_SPEED = 30;
const RUN_SPEED = 650;
const WALK_DISPLACEMENT = 3;
const RUN_DISPLACEMENT = 48;
const RUN_FOLLOWER_LAG = 24;
const SETTLE_MS = 180;
const TURN_DURATION_MS = 120;
const TURN_LOCKOUT_MS = 160;
export const TURN_DISPLACEMENT_DIP = 12;

function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

export class SpringFollower {
  public position: Point;
  public velocity: Point;

  constructor(initial: Point) {
    this.assertPoint(initial);
    this.position = { ...initial };
    this.velocity = { x: 0, y: 0 };
  }

  reset(position: Point): void {
    this.assertPoint(position);
    this.position = { ...position };
    this.velocity = { x: 0, y: 0 };
  }

  step(target: Point, seconds: number, speedPercent: number): void {
    this.assertPoint(target);
    if (!Number.isFinite(seconds) || seconds <= 0) {
      throw new RangeError("spring step must be a positive finite duration");
    }
    const requestedSpeed = Number.isFinite(speedPercent) ? speedPercent : 100;
    const scale = Math.min(150, Math.max(75, requestedSpeed)) / 100;
    const acceleration = {
      x:
        STIFFNESS * scale * (target.x - this.position.x) -
        DAMPING * this.velocity.x,
      y:
        STIFFNESS * scale * (target.y - this.position.y) -
        DAMPING * this.velocity.y,
    };
    let velocity = {
      x: this.velocity.x + acceleration.x * seconds,
      y: this.velocity.y + acceleration.y * seconds,
    };
    const speed = Math.hypot(velocity.x, velocity.y);
    if (speed > MAXIMUM_SPEED) {
      const ratio = MAXIMUM_SPEED / speed;
      velocity = { x: velocity.x * ratio, y: velocity.y * ratio };
    }

    this.velocity = velocity;
    this.position = {
      x: this.position.x + velocity.x * seconds,
      y: this.position.y + velocity.y * seconds,
    };
  }

  private assertPoint(point: Point): void {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      throw new RangeError("spring points must be finite");
    }
  }
}

export function chooseMotionState(
  previous: MotionState,
  metrics: MotionMetrics,
  reducedMotion: boolean,
): MotionState {
  if (reducedMotion) {
    return "idle";
  }

  const speed = finiteOrZero(metrics.speed);
  const displacement = finiteOrZero(metrics.displacement);
  const lag = finiteOrZero(metrics.lag);
  const stoppedMs = finiteOrZero(metrics.stoppedMs);

  if (
    speed >= RUN_SPEED ||
    displacement >= RUN_DISPLACEMENT ||
    lag >= RUN_FOLLOWER_LAG
  ) {
    return "run";
  }
  if (speed >= WALK_SPEED || displacement >= WALK_DISPLACEMENT) {
    return "walk";
  }
  if (stoppedMs >= SETTLE_MS) {
    return "idle";
  }
  return previous;
}

export class TurnTracker {
  private turnStartedAtMs: number | null = null;
  private lastTurnAtMs: number | null = null;
  private candidateFacesRight: boolean | null = null;
  private candidateDisplacement = 0;

  activeAt(nowMs: number): boolean {
    this.assertTime(nowMs);
    return (
      this.turnStartedAtMs !== null &&
      nowMs >= this.turnStartedAtMs &&
      nowMs - this.turnStartedAtMs < TURN_DURATION_MS
    );
  }

  update(
    horizontalDisplacement: number,
    previousFacesRight: boolean,
    facesRight: boolean,
    nowMs: number,
  ): boolean {
    this.assertTime(nowMs);
    if (this.activeAt(nowMs)) {
      return true;
    }
    if (previousFacesRight === facesRight) {
      this.clearCandidate();
      return false;
    }
    if (this.candidateFacesRight !== facesRight) {
      this.candidateFacesRight = facesRight;
      this.candidateDisplacement = 0;
    }
    this.candidateDisplacement += Math.max(
      0,
      Math.abs(horizontalDisplacement),
    );
    if (this.candidateDisplacement < TURN_DISPLACEMENT_DIP) {
      return false;
    }
    if (
      this.lastTurnAtMs === null ||
      nowMs - this.lastTurnAtMs >= TURN_LOCKOUT_MS
    ) {
      this.turnStartedAtMs = nowMs;
      this.lastTurnAtMs = nowMs;
      this.clearCandidate();
      return true;
    }
    return false;
  }

  reset(): void {
    this.turnStartedAtMs = null;
    this.lastTurnAtMs = null;
    this.clearCandidate();
  }

  private assertTime(nowMs: number): void {
    if (!Number.isFinite(nowMs)) {
      throw new RangeError("turn timing must be finite");
    }
  }

  private clearCandidate(): void {
    this.candidateFacesRight = null;
    this.candidateDisplacement = 0;
  }
}
