import type { AppSettings, LanguageMode } from "../domain/types";

export type TrayAction =
  | { type: "toggle-enabled"; value: boolean }
  | { type: "set-language"; value: LanguageMode }
  | { type: "set-speed"; value: 75 | 100 | 125 | 150 }
  | { type: "set-reduced-motion"; value: boolean }
  | { type: "set-full-screen"; value: boolean }
  | { type: "set-launch-at-login"; value: boolean }
  | { type: "about" }
  | { type: "quit" };

export type TrayMenuEntry = Readonly<{
  label: string;
  type?: "normal" | "checkbox" | "radio" | "separator" | "submenu";
  enabled?: boolean;
  checked?: boolean;
  action?: TrayAction;
  items?: readonly TrayMenuEntry[];
}>;

export function buildTrayMenuModel(
  version: string,
  settings: AppSettings,
): TrayMenuEntry[] {
  const languageItems: readonly TrayMenuEntry[] = [
    {
      label: "Automatic",
      type: "radio",
      checked: settings.languageMode === "automatic",
      action: { type: "set-language", value: "automatic" },
    },
    {
      label: "Hidden",
      type: "radio",
      checked: settings.languageMode === "hidden",
      action: { type: "set-language", value: "hidden" },
    },
    {
      label: "A",
      type: "radio",
      checked: settings.languageMode === "A",
      action: { type: "set-language", value: "A" },
    },
    {
      label: "한",
      type: "radio",
      checked: settings.languageMode === "한",
      action: { type: "set-language", value: "한" },
    },
  ];
  const speedItems: readonly TrayMenuEntry[] = (
    [
      ["Calm (75%)", 75],
      ["Normal (100%)", 100],
      ["Playful (125%)", 125],
      ["Quick (150%)", 150],
    ] as const
  ).map(([label, value]) => ({
    label,
    type: "radio",
    checked: settings.followSpeedPercent === value,
    action: { type: "set-speed", value },
  }));

  return [
    { label: `Followmeow ${version}`, enabled: false },
    {
      label: "Enable Followmeow",
      type: "checkbox",
      checked: settings.enabled,
      action: { type: "toggle-enabled", value: !settings.enabled },
    },
    { label: "separator", type: "separator" },
    { label: "Torso label", type: "submenu", items: languageItems },
    { label: "Follow speed", type: "submenu", items: speedItems },
    {
      label: "Reduce motion",
      type: "checkbox",
      checked: settings.motionPolicy === "reduced",
      action: {
        type: "set-reduced-motion",
        value: settings.motionPolicy !== "reduced",
      },
    },
    {
      label: "Show over full screen",
      type: "checkbox",
      checked: settings.showOverFullScreen,
      action: {
        type: "set-full-screen",
        value: !settings.showOverFullScreen,
      },
    },
    {
      label: "Launch at login",
      type: "checkbox",
      checked: settings.launchAtLogin,
      action: {
        type: "set-launch-at-login",
        value: !settings.launchAtLogin,
      },
    },
    { label: "separator", type: "separator" },
    { label: "About Followmeow", action: { type: "about" } },
    { label: "Quit", action: { type: "quit" } },
  ];
}
