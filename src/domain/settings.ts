import type {
  AppSettings,
  LanguageMode,
  MotionPolicy,
  PlatformName,
} from "./types";

export type SettingsDecodeResult = Readonly<{
  settings: AppSettings;
  warnings: readonly string[];
}>;

const KNOWN_KEYS = [
  "enabled",
  "languageMode",
  "followSpeedPercent",
  "showOverFullScreen",
  "launchAtLogin",
  "motionPolicy",
] as const;
const LANGUAGE_MODES: readonly LanguageMode[] = [
  "automatic",
  "hidden",
  "A",
  "한",
];

export function defaultSettings(platform: PlatformName): AppSettings {
  return {
    enabled: true,
    languageMode: "automatic",
    followSpeedPercent: 100,
    showOverFullScreen: platform === "darwin",
    launchAtLogin: false,
    motionPolicy: "system",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function decodeSettings(
  value: unknown,
  platform: PlatformName,
): SettingsDecodeResult {
  const defaults = defaultSettings(platform);
  if (!isRecord(value)) {
    return { settings: defaults, warnings: ["invalid-json"] };
  }

  const warnings: string[] = [];
  const known = new Set<string>(KNOWN_KEYS);
  for (const key of Object.keys(value).sort()) {
    if (!known.has(key)) {
      warnings.push(`unknown-key:${key}`);
    }
  }

  let enabled = defaults.enabled;
  if (typeof value.enabled === "boolean") {
    enabled = value.enabled;
  } else if ("enabled" in value) {
    warnings.push("invalid-key:enabled");
  }

  let languageMode = defaults.languageMode;
  if (LANGUAGE_MODES.includes(value.languageMode as LanguageMode)) {
    languageMode = value.languageMode as LanguageMode;
  } else if ("languageMode" in value) {
    warnings.push("invalid-key:languageMode");
  }

  let followSpeedPercent = defaults.followSpeedPercent;
  if (
    typeof value.followSpeedPercent === "number" &&
    Number.isInteger(value.followSpeedPercent) &&
    value.followSpeedPercent >= 75 &&
    value.followSpeedPercent <= 150
  ) {
    followSpeedPercent = value.followSpeedPercent;
  } else if ("followSpeedPercent" in value) {
    warnings.push("invalid-key:followSpeedPercent");
  }

  let showOverFullScreen = defaults.showOverFullScreen;
  if (typeof value.showOverFullScreen === "boolean") {
    showOverFullScreen = value.showOverFullScreen;
  } else if ("showOverFullScreen" in value) {
    warnings.push("invalid-key:showOverFullScreen");
  }

  let launchAtLogin = defaults.launchAtLogin;
  if (typeof value.launchAtLogin === "boolean") {
    launchAtLogin = value.launchAtLogin;
  } else if ("launchAtLogin" in value) {
    warnings.push("invalid-key:launchAtLogin");
  }

  let motionPolicy = defaults.motionPolicy;
  if (value.motionPolicy === "system" || value.motionPolicy === "reduced") {
    motionPolicy = value.motionPolicy as MotionPolicy;
  } else if ("motionPolicy" in value) {
    warnings.push("invalid-key:motionPolicy");
  }

  return {
    settings: {
      enabled,
      languageMode,
      followSpeedPercent,
      showOverFullScreen,
      launchAtLogin,
      motionPolicy,
    },
    warnings,
  };
}
