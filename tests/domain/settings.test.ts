import { describe, expect, it } from "vitest";
import { decodeSettings, defaultSettings } from "../../src/domain/settings";

describe("settings", () => {
  it("uses platform defaults and automatic language mode", () => {
    expect(defaultSettings("darwin").showOverFullScreen).toBe(true);
    expect(defaultSettings("win32").showOverFullScreen).toBe(false);
    expect(defaultSettings("darwin").languageMode).toBe("automatic");
  });

  it("validates each known key independently", () => {
    const result = decodeSettings(
      {
        enabled: false,
        languageMode: "한",
        followSpeedPercent: 126,
        showOverFullScreen: "yes",
        launchAtLogin: true,
        motionPolicy: "fancy",
        unexpected: 1,
      },
      "darwin",
    );

    expect(result.settings).toEqual({
      ...defaultSettings("darwin"),
      enabled: false,
      languageMode: "한",
      followSpeedPercent: 126,
      launchAtLogin: true,
    });
    expect(result.warnings).toEqual([
      "unknown-key:unexpected",
      "invalid-key:showOverFullScreen",
      "invalid-key:motionPolicy",
    ]);
  });

  it("accepts only integer speed and supported language values", () => {
    expect(
      decodeSettings({ followSpeedPercent: 74.9 }, "win32").settings
        .followSpeedPercent,
    ).toBe(100);
    expect(
      decodeSettings({ followSpeedPercent: 151 }, "win32").settings
        .followSpeedPercent,
    ).toBe(100);
    expect(
      decodeSettings({ followSpeedPercent: 125 }, "win32").settings
        .followSpeedPercent,
    ).toBe(125);
    expect(
      decodeSettings({ languageMode: "guess" }, "darwin").settings.languageMode,
    ).toBe("automatic");
  });
});
