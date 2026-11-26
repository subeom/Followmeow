export const OVERLAY_SIZE = Object.freeze({ width: 144, height: 96 });
export const DISPLAY_MARGIN_DIP = 8;
export const STALE_CURSOR_MS = 250;
export const LANGUAGE_OBSERVATION_MAX_AGE_MS = 3_000;
export const MAX_FRAME_STEPS = 4;
export const SAMPLE_INTERVAL_MS = 16;

export type Point = Readonly<{ x: number; y: number }>;
export type Size = Readonly<{ width: number; height: number }>;
export type Rect = Point & Size;
export type DisplaySnapshot = Readonly<{
  id: number;
  bounds: Rect;
}>;
export type CursorSample = Readonly<{
  cursor: Point;
  displays: readonly DisplaySnapshot[];
  displayGeneration: number;
  observedAtMs: number;
  sequence: number;
}>;

export type MotionState = "idle" | "walk" | "run" | "turn";
export type LanguageGlyph = "hidden" | "A" | "한";
export type LanguageMode = "automatic" | LanguageGlyph;
export type MotionPolicy = "system" | "reduced";
export type PlatformName = "darwin" | "win32";

export type HideReason =
  | "disabled"
  | "waiting-renderer"
  | "stale-cursor"
  | "screen-unknown"
  | "topology-changed"
  | "overlay-unavailable"
  | "quitting";

export type AppSettings = Readonly<{
  enabled: boolean;
  languageMode: LanguageMode;
  followSpeedPercent: number;
  showOverFullScreen: boolean;
  launchAtLogin: boolean;
  motionPolicy: MotionPolicy;
}>;

export type RenderFrame =
  | Readonly<{
      kind: "hide";
      sequence: number;
      observedAtMs: number;
      reason: HideReason;
    }>
  | Readonly<{
      kind: "show";
      sequence: number;
      observedAtMs: number;
      bounds: Rect;
      motion: MotionState;
      facesRight: boolean;
      glyph: LanguageGlyph;
      phaseMs: number;
    }>;
