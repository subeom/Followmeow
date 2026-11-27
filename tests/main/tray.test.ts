import { describe, expect, it } from "vitest";
import { defaultSettings } from "../../src/domain/settings";
import { buildTrayMenuModel } from "../../src/main/tray";

describe("tray menu model", () => {
  it("has stable menu order and selected radio values", () => {
    const menu = buildTrayMenuModel(
      "0.1.0",
      {
        ...defaultSettings("darwin"),
        languageMode: "한",
        followSpeedPercent: 125,
        motionPolicy: "reduced",
      },
      "darwin",
    );

    expect(menu.map((item) => item.label)).toEqual([
      "Followmeow 0.1.0",
      "Enable Followmeow",
      "separator",
      "Torso label",
      "Follow speed",
      "Reduce motion",
      "Show over full screen",
      "Launch at login",
      "separator",
      "About Followmeow",
      "Quit",
    ]);
    expect(
      menu
        .find((item) => item.label === "Torso label")
        ?.items?.map((item) => item.label),
    ).toEqual(["Automatic", "Hidden", "A", "한"]);
    expect(
      menu
        .find((item) => item.label === "Torso label")
        ?.items?.find((item) => item.label === "한")?.checked,
    ).toBe(true);
    expect(
      menu
        .find((item) => item.label === "Follow speed")
        ?.items?.find((item) => item.label === "Playful (125%)")?.checked,
    ).toBe(true);
  });

  it("checks automatic mode by default", () => {
    const menu = buildTrayMenuModel(
      "0.1.0",
      defaultSettings("win32"),
      "win32",
    );
    expect(
      menu
        .find((item) => item.label === "Torso label")
        ?.items?.find((item) => item.label === "Automatic")?.checked,
    ).toBe(true);
    expect(menu.map((item) => item.label)).not.toContain(
      "Show over full screen",
    );
  });
});
