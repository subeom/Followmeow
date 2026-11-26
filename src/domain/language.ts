import {
  LANGUAGE_OBSERVATION_MAX_AGE_MS,
  type LanguageGlyph,
  type LanguageMode,
} from "./types";

export type LanguageObservation = Readonly<{
  glyph: LanguageGlyph;
  observedAtMs: number;
}>;

const MAC_LATIN_LAYOUTS = new Set([
  "abc",
  "australian",
  "british",
  "canadian",
  "colemak",
  "dvorak",
  "dvorak-left",
  "dvorak-qwerty",
  "dvorak-right",
  "us",
  "usinternational-pc",
]);
const WINDOWS_LATIN_PRIMARY_LANGUAGE_IDS = new Set([
  0x03, 0x05, 0x06, 0x07, 0x09, 0x0a, 0x0b, 0x0c, 0x0e, 0x0f, 0x10,
  0x13, 0x14, 0x15, 0x16, 0x18, 0x1a, 0x1b, 0x1d, 0x1e, 0x1f, 0x24,
  0x25, 0x26, 0x27, 0x2a, 0x2d, 0x3a, 0x3c,
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseMacLayout(stdout: string): string | null {
  if (stdout.length > 256) {
    return null;
  }
  const trimmed = stdout.trim();
  if (trimmed.length === 0 || /[\r\n]/.test(trimmed)) {
    return null;
  }
  return trimmed;
}

export function classifyMacLayout(identifier: string): LanguageGlyph {
  const normalized = identifier.toLowerCase();
  if (
    normalized.startsWith("com.apple.keylayout.") ||
    normalized.startsWith("com.apple.inputmethod.")
  ) {
    if (
      normalized.includes("2sethangul") ||
      normalized.includes("hangul") ||
      normalized.includes(".korean.")
    ) {
      return "한";
    }
    if (
      normalized.startsWith("com.apple.keylayout.") &&
      MAC_LATIN_LAYOUTS.has(
        normalized.slice("com.apple.keylayout.".length),
      )
    ) {
      return "A";
    }
  }
  return "hidden";
}

export function parseWindowsLayoutStrict(stdout: string): LanguageGlyph | null {
  if (stdout.length > 512) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return null;
  }
  if (
    !isRecord(parsed) ||
    Object.keys(parsed).sort().join(",") !== "imeOpen,layoutId" ||
    typeof parsed.layoutId !== "string" ||
    !/^[0-9A-F]{4}$/i.test(parsed.layoutId) ||
    typeof parsed.imeOpen !== "boolean"
  ) {
    return null;
  }
  const layoutId = Number.parseInt(parsed.layoutId, 16);
  const languageId = layoutId & 0x3ff;
  if (layoutId === 0x0412) {
    return parsed.imeOpen ? "한" : "A";
  }
  return WINDOWS_LATIN_PRIMARY_LANGUAGE_IDS.has(languageId) ? "A" : "hidden";
}

export function parseWindowsLayout(stdout: string): LanguageGlyph {
  return parseWindowsLayoutStrict(stdout) ?? "hidden";
}

export function resolveLanguage(
  mode: LanguageMode,
  observation: LanguageObservation | null,
  nowMs: number,
): LanguageGlyph {
  if (mode !== "automatic") {
    return mode;
  }
  if (observation === null || !Number.isFinite(nowMs)) {
    return "hidden";
  }
  const ageMs = nowMs - observation.observedAtMs;
  if (
    ageMs < 0 ||
    ageMs > LANGUAGE_OBSERVATION_MAX_AGE_MS ||
    !Number.isFinite(ageMs)
  ) {
    return "hidden";
  }
  return observation.glyph;
}
