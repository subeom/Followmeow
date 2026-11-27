// SPDX-FileCopyrightText: 2026 subeomlee
// SPDX-License-Identifier: GPL-2.0-only

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
const WINDOWS_LATIN_LAYOUT_IDS = new Set([
  0x0409,
  0x0809,
  0x0c09,
  0x1009,
  0x1409,
  0x1809,
  0x1c09,
  0x2009,
  0x2409,
  0x2809,
  0x2c09,
  0x3009,
  0x3409,
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
  if (layoutId === 0x0412) {
    return parsed.imeOpen ? "한" : "A";
  }
  return WINDOWS_LATIN_LAYOUT_IDS.has(layoutId) ? "A" : "hidden";
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
