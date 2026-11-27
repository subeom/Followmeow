// SPDX-FileCopyrightText: 2026 subeomlee
// SPDX-License-Identifier: GPL-2.0-only

import { isCursorSample } from "../domain/contracts";
import {
  resolveLanguage,
  type LanguageObservation,
} from "../domain/language";
import {
  clampOverlayOrigin,
  desiredOverlayOrigin,
  findContainingDisplay,
} from "../domain/geometry";
import {
  SpringFollower,
  TurnTracker,
  TURN_DISPLACEMENT_DIP,
  chooseMotionState,
} from "../domain/motion";
import { evaluateVisibility } from "../domain/policy";
import {
  MAX_FRAME_STEPS,
  OVERLAY_SIZE,
  type AppSettings,
  type CursorSample,
  type DisplaySnapshot,
  type HideReason,
  type LanguageGlyph,
  type MotionState,
  type Point,
  type RenderFrame,
} from "../domain/types";

const FIXED_STEP_SECONDS = 1 / 60;

export class FollowController {
  private overlayReady = false;
  private quitting = false;
  private lastEmittedSequence = 0;
  private previousDisplayGeneration: number | null = null;
  private lastSample: CursorSample | null = null;
  private follower: SpringFollower | null = null;
  private heading: Point = { x: 1, y: 0 };
  private facesRight = true;
  private motion: MotionState = "idle";
  private motionStartedAtMs = 0;
  private lastMovementAtMs = 0;
  private automaticLanguage: LanguageObservation | null = null;
  private readonly turns = new TurnTracker();

  constructor(
    private settings: AppSettings,
    private reducedMotion: boolean,
    private readonly emit: (frame: RenderFrame) => void,
  ) {}

  rendererReady(): void {
    this.overlayReady = true;
  }

  setSettings(settings: AppSettings): void {
    this.settings = settings;
  }

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
  }

  setAutomaticLanguage(observation: LanguageObservation): void {
    if (
      (observation.glyph === "hidden" ||
        observation.glyph === "A" ||
        observation.glyph === "한") &&
      Number.isFinite(observation.observedAtMs)
    ) {
      this.automaticLanguage = observation;
      return;
    }
    throw new TypeError("invalid automatic language observation");
  }

  invalidate(reason: HideReason, nowMs: number): void {
    this.resetMotion();
    this.emitHide(reason, nowMs);
  }

  quit(nowMs: number): void {
    this.quitting = true;
    this.resetMotion();
    this.emitHide("quitting", nowMs);
  }

  tick(sample: unknown, nowMs: number): void {
    const decision = evaluateVisibility({
      enabled: this.settings.enabled,
      overlayReady: this.overlayReady,
      quitting: this.quitting,
      nowMs,
      previousDisplayGeneration: this.previousDisplayGeneration,
      sample,
    });
    if (decision.kind === "hide") {
      if (isCursorSample(sample) && decision.reason === "topology-changed") {
        this.previousDisplayGeneration = sample.displayGeneration;
        this.resetMotion();
      }
      if (
        decision.reason === "stale-cursor" ||
        decision.reason === "screen-unknown"
      ) {
        this.resetMotion();
      }
      this.emitHide(decision.reason, nowMs);
      return;
    }

    const current = decision.sample;
    const display = findContainingDisplay(current.displays, current.cursor);
    if (display === null) {
      this.emitHide("screen-unknown", nowMs);
      return;
    }

    const sameDisplay =
      this.previousDisplayGeneration === current.displayGeneration;
    if (
      this.previousDisplayGeneration !== null &&
      current.displayGeneration !== this.previousDisplayGeneration
    ) {
      this.resetMotion();
    }
    this.previousDisplayGeneration = current.displayGeneration;

    const target = this.targetOrigin(current, display);
    if (target === null) {
      this.resetMotion();
      this.emitHide("screen-unknown", nowMs);
      return;
    }

    if (this.follower === null || !sameDisplay || this.reducedMotion) {
      this.follower = new SpringFollower(target);
    } else {
      this.advanceSpring(target, current.observedAtMs);
    }
    const clampedFollower = clampOverlayOrigin(this.follower.position, display);
    if (clampedFollower === null) {
      this.resetMotion();
      this.emitHide("screen-unknown", nowMs);
      return;
    }
    if (
      clampedFollower.x !== this.follower.position.x ||
      clampedFollower.y !== this.follower.position.y
    ) {
      this.follower.reset(clampedFollower);
    }

    const metrics = this.updateMotionMetrics(current, nowMs, target);
    const normalState = chooseMotionState(
      this.motion,
      metrics,
      this.reducedMotion,
    );
    const state = this.turns.activeAt(nowMs) ? "turn" : normalState;
    if (state !== this.motion) {
      this.motion = state;
      this.motionStartedAtMs = nowMs;
    }

    const frame: RenderFrame = {
      kind: "show",
      sequence: this.nextSequence(),
      observedAtMs: nowMs,
      bounds: {
        x: this.follower.position.x,
        y: this.follower.position.y,
        width: OVERLAY_SIZE.width,
        height: OVERLAY_SIZE.height,
      },
      motion: state,
      facesRight: this.facesRight,
      glyph: this.resolveGlyph(nowMs),
      phaseMs: Math.max(0, nowMs - this.motionStartedAtMs),
    };
    this.lastEmittedSequence = frame.sequence;
    this.emit(frame);
  }

  private targetOrigin(
    sample: CursorSample,
    display: DisplaySnapshot,
  ): Point | null {
    if (this.lastSample !== null) {
      const deltaX = sample.cursor.x - this.lastSample.cursor.x;
      const deltaY = sample.cursor.y - this.lastSample.cursor.y;
      const distance = Math.hypot(deltaX, deltaY);
      const previousFacesRight = this.facesRight;
      const desiredFacesRight = deltaX >= 0;
      const turnWasActive = this.turns.activeAt(sample.observedAtMs);
      const turnActive =
        turnWasActive ||
        this.turns.update(
          deltaX,
          previousFacesRight,
          desiredFacesRight,
          sample.observedAtMs,
        );
      if (
        !turnWasActive &&
        turnActive &&
        previousFacesRight !== desiredFacesRight
      ) {
        this.facesRight = desiredFacesRight;
      }
      if (
        distance >= 0.5 &&
        !turnWasActive &&
        Math.abs(deltaX) >= TURN_DISPLACEMENT_DIP
      ) {
        this.heading = { x: deltaX / distance, y: deltaY / distance };
      }
    }
    return clampOverlayOrigin(
      desiredOverlayOrigin(sample.cursor, this.heading),
      display,
    );
  }

  private advanceSpring(target: Point, sampleTimeMs: number): void {
    if (this.follower === null) {
      return;
    }
    const elapsedMs =
      this.lastSample === null
        ? 0
        : Math.max(0, sampleTimeMs - this.lastSample.observedAtMs);
    const stepCount = Math.min(
      MAX_FRAME_STEPS,
      Math.max(1, Math.round(elapsedMs / (FIXED_STEP_SECONDS * 1_000))),
    );
    for (let index = 0; index < stepCount; index += 1) {
      this.follower.step(
        target,
        FIXED_STEP_SECONDS,
        this.settings.followSpeedPercent,
      );
    }
  }

  private updateMotionMetrics(
    sample: CursorSample,
    nowMs: number,
    target: Point,
  ): {
    speed: number;
    displacement: number;
    lag: number;
    stoppedMs: number;
  } {
    const previous = this.lastSample;
    const displacement =
      previous === null
        ? 0
        : Math.hypot(
            sample.cursor.x - previous.cursor.x,
            sample.cursor.y - previous.cursor.y,
          );
    const elapsedMs =
      previous === null
        ? 0
        : Math.max(0, sample.observedAtMs - previous.observedAtMs);
    const speed = elapsedMs > 0 ? (displacement * 1_000) / elapsedMs : 0;
    if (previous === null || speed >= 0.5) {
      this.lastMovementAtMs = nowMs;
    }

    const lag =
      this.follower === null
        ? 0
        : Math.hypot(
            target.x - this.follower.position.x,
            target.y - this.follower.position.y,
          );
    this.lastSample = sample;
    return {
      speed,
      displacement,
      lag,
      stoppedMs: Math.max(0, nowMs - this.lastMovementAtMs),
    };
  }

  private resolveGlyph(nowMs: number): LanguageGlyph {
    return resolveLanguage(
      this.settings.languageMode,
      this.automaticLanguage,
      nowMs,
    );
  }

  private emitHide(reason: HideReason, nowMs: number): void {
    const sequence = this.nextSequence();
    this.lastEmittedSequence = sequence;
    this.emit({
      kind: "hide",
      sequence,
      observedAtMs: nowMs,
      reason,
    });
  }

  private nextSequence(): number {
    return this.lastEmittedSequence + 1;
  }

  private resetMotion(): void {
    this.turns.reset();
    this.follower = null;
    this.lastSample = null;
    this.heading = { x: 1, y: 0 };
    this.facesRight = true;
    this.motion = "idle";
    this.motionStartedAtMs = 0;
    this.lastMovementAtMs = 0;
  }
}
