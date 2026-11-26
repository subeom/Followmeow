import type {
  AppSettings,
  CursorSample,
  DisplaySnapshot,
  HideReason,
  LanguageGlyph,
  LanguageMode,
  MotionState,
  Point,
  Rect,
  RenderFrame,
} from "./types";

const HIDE_REASONS: readonly HideReason[] = [
  "disabled",
  "waiting-renderer",
  "stale-cursor",
  "screen-unknown",
  "topology-changed",
  "overlay-unavailable",
  "quitting",
];
const MOTION_STATES: readonly MotionState[] = ["idle", "walk", "run", "turn"];
const LANGUAGE_GLYPHS: readonly LanguageGlyph[] = ["hidden", "A", "한"];
const LANGUAGE_MODES: readonly LanguageMode[] = ["automatic", ...LANGUAGE_GLYPHS];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value) && value >= 0;
}

export function isPoint(value: unknown): value is Point {
  return isRecord(value) && isFiniteNumber(value.x) && isFiniteNumber(value.y);
}

export function isRect(value: unknown): value is Rect {
  return (
    isRecord(value) &&
    isFiniteNumber(value.x) &&
    isFiniteNumber(value.y) &&
    isFiniteNumber(value.width) &&
    isFiniteNumber(value.height) &&
    value.width > 0 &&
    value.height > 0
  );
}

function isDisplaySnapshot(value: unknown): value is DisplaySnapshot {
  return (
    isRecord(value) &&
    isNonNegativeInteger(value.id) &&
    isRect(value.bounds)
  );
}

export function isCursorSample(value: unknown): value is CursorSample {
  return (
    isRecord(value) &&
    isPoint(value.cursor) &&
    Array.isArray(value.displays) &&
    value.displays.every(isDisplaySnapshot) &&
    isNonNegativeInteger(value.displayGeneration) &&
    isFiniteNumber(value.observedAtMs) &&
    value.observedAtMs >= 0 &&
    isNonNegativeInteger(value.sequence)
  );
}

export function isRenderFrame(value: unknown): value is RenderFrame {
  if (!isRecord(value) || !isNonNegativeInteger(value.sequence) || !isFiniteNumber(value.observedAtMs)) {
    return false;
  }

  if (value.kind === "hide") {
    const keys = Object.keys(value).sort();
    return (
      keys.join(",") === "kind,observedAtMs,reason,sequence" &&
      HIDE_REASONS.includes(value.reason as HideReason)
    );
  }

  if (value.kind === "show") {
    const keys = Object.keys(value).sort();
    return (
      keys.join(",") === "bounds,facesRight,glyph,kind,motion,observedAtMs,phaseMs,sequence" &&
      isRect(value.bounds) &&
      MOTION_STATES.includes(value.motion as MotionState) &&
      typeof value.facesRight === "boolean" &&
      LANGUAGE_GLYPHS.includes(value.glyph as LanguageGlyph) &&
      isFiniteNumber(value.phaseMs) &&
      value.phaseMs >= 0
    );
  }

  return false;
}

export function isAppSettings(value: unknown): value is AppSettings {
  return (
    isRecord(value) &&
    Object.keys(value).sort().join(",") ===
      "enabled,followSpeedPercent,languageMode,launchAtLogin,motionPolicy,showOverFullScreen" &&
    typeof value.enabled === "boolean" &&
    LANGUAGE_MODES.includes(value.languageMode as LanguageMode) &&
    isFiniteNumber(value.followSpeedPercent) &&
    Number.isInteger(value.followSpeedPercent) &&
    value.followSpeedPercent >= 75 &&
    value.followSpeedPercent <= 150 &&
    typeof value.showOverFullScreen === "boolean" &&
    typeof value.launchAtLogin === "boolean" &&
    (value.motionPolicy === "system" || value.motionPolicy === "reduced")
  );
}
