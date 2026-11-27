// SPDX-FileCopyrightText: 2026 subeomlee
// SPDX-License-Identifier: GPL-2.0-only

import type { AppSettings, HideReason } from "../domain/types";
import type { TrayAction } from "./tray";

export type SanitizedLifecycleError =
  | "settings-save-failed"
  | "login-item-failed"
  | "language-provider-failed";

interface SettingsPort {
  readonly value: AppSettings;
  save(next: AppSettings): Promise<void>;
}

interface ControllerPort {
  rendererReady(): void;
  setSettings(settings: AppSettings): void;
  setReducedMotion?(reduced: boolean): void;
  invalidate(reason: HideReason, nowMs: number): void;
  quit(nowMs: number): void;
}

interface SamplerPort {
  start(): void;
  stop(): void;
}

interface OverlayPort {
  setFullScreenVisibility(enabled: boolean): void;
  destroy(): void;
}

interface TrayPort {
  update(settings: AppSettings): void;
  showError(reason: SanitizedLifecycleError): void;
  destroy(): void;
}

interface LanguageProviderPort {
  start(): Promise<void>;
  stop(): void;
  reset(): void;
}

export type LifecycleDependencies = Readonly<{
  store: SettingsPort;
  controller: ControllerPort;
  sampler: SamplerPort;
  overlay: OverlayPort;
  tray: TrayPort;
  languageProvider: LanguageProviderPort;
  setLoginItem: (enabled: boolean) => void;
  now: () => number;
  openAbout: () => void;
  quitApp?: () => void;
  systemReducedMotion?: boolean;
}>;

export class AppLifecycle {
  private rendererIsReady = false;
  private quitting = false;
  private samplerRunning = false;
  private providerRunning = false;
  private actionQueue: Promise<void> = Promise.resolve();

  constructor(private readonly dependencies: LifecycleDependencies) {}

  initialize(): void {
    const settings = this.dependencies.store.value;
    this.dependencies.overlay.setFullScreenVisibility(
      settings.showOverFullScreen,
    );
    this.dependencies.tray.update(settings);
  }

  async rendererReady(): Promise<void> {
    if (this.rendererIsReady || this.quitting) {
      return;
    }
    this.rendererIsReady = true;
    this.dependencies.controller.rendererReady();
    this.startRuntimeForSettings();
  }

  handleAction(action: TrayAction): Promise<void> {
    if (this.quitting) {
      return Promise.resolve();
    }
    if (action.type === "quit") {
      this.quit();
      return Promise.resolve();
    }
    if (action.type === "about") {
      this.dependencies.openAbout();
      return Promise.resolve();
    }

    const transaction = async () => {
      if (this.quitting) {
        return;
      }
      const previous = this.dependencies.store.value;
      const next = this.nextSettings(previous, action);
      if (action.type === "set-launch-at-login") {
        await this.updateLoginSetting(previous, next);
        return;
      }
      try {
        await this.dependencies.store.save(next);
      } catch {
        if (!this.quitting) {
          this.dependencies.tray.showError("settings-save-failed");
        }
        return;
      }
      if (!this.quitting) {
        this.applySavedSettings(next);
      }
    };
    const pending = this.actionQueue.then(transaction, transaction);
    this.actionQueue = pending.catch(() => {});
    return pending;
  }

  quit(): void {
    if (this.quitting) {
      return;
    }
    this.quitting = true;
    this.dependencies.sampler.stop();
    this.samplerRunning = false;
    this.dependencies.languageProvider.stop();
    this.providerRunning = false;
    this.dependencies.controller.quit(this.dependencies.now());
    this.dependencies.overlay.destroy();
    this.dependencies.tray.destroy();
    this.dependencies.quitApp?.();
  }

  private nextSettings(
    settings: AppSettings,
    action: Exclude<TrayAction, { type: "about" } | { type: "quit" }>,
  ): AppSettings {
    switch (action.type) {
      case "toggle-enabled":
        return { ...settings, enabled: action.value };
      case "set-language":
        return { ...settings, languageMode: action.value };
      case "set-speed":
        return { ...settings, followSpeedPercent: action.value };
      case "set-reduced-motion":
        return {
          ...settings,
          motionPolicy: action.value ? "reduced" : "system",
        };
      case "set-full-screen":
        return { ...settings, showOverFullScreen: action.value };
      case "set-launch-at-login":
        return { ...settings, launchAtLogin: action.value };
    }
  }

  private async updateLoginSetting(
    previous: AppSettings,
    next: AppSettings,
  ): Promise<void> {
    try {
      this.dependencies.setLoginItem(next.launchAtLogin);
    } catch {
      if (!this.quitting) {
        this.dependencies.tray.showError("login-item-failed");
      }
      return;
    }
    try {
      await this.dependencies.store.save(next);
    } catch {
      try {
        this.dependencies.setLoginItem(previous.launchAtLogin);
      } catch {
        if (!this.quitting) {
          this.dependencies.tray.showError("login-item-failed");
        }
        return;
      }
      if (!this.quitting) {
        this.dependencies.tray.showError("settings-save-failed");
      }
      return;
    }
    if (!this.quitting) {
      this.applySavedSettings(next);
    }
  }

  private applySavedSettings(settings: AppSettings): void {
    if (this.quitting) {
      return;
    }
    this.dependencies.controller.setSettings(settings);
    this.dependencies.controller.setReducedMotion?.(
      settings.motionPolicy === "reduced" ||
        this.dependencies.systemReducedMotion === true,
    );
    this.dependencies.overlay.setFullScreenVisibility(
      settings.showOverFullScreen,
    );
    this.dependencies.tray.update(settings);
    if (!settings.enabled) {
      this.stopRuntime();
      this.dependencies.controller.invalidate(
        "disabled",
        this.dependencies.now(),
      );
      return;
    }
    if (this.rendererIsReady) {
      this.startRuntimeForSettings();
    }
  }

  private startRuntimeForSettings(): void {
    if (!this.rendererIsReady || !this.dependencies.store.value.enabled) {
      return;
    }
    if (!this.samplerRunning) {
      this.dependencies.sampler.start();
      this.samplerRunning = true;
    }
    if (
      this.dependencies.store.value.languageMode === "automatic" &&
      !this.providerRunning
    ) {
      this.providerRunning = true;
      this.dependencies.languageProvider.reset();
      void this.dependencies.languageProvider.start().catch(() => {
        this.providerRunning = false;
        if (!this.quitting) {
          this.dependencies.tray.showError("language-provider-failed");
        }
      });
    } else if (
      this.dependencies.store.value.languageMode !== "automatic" &&
      this.providerRunning
    ) {
      this.dependencies.languageProvider.stop();
      this.providerRunning = false;
    }
  }

  private stopRuntime(): void {
    if (this.samplerRunning) {
      this.dependencies.sampler.stop();
      this.samplerRunning = false;
    }
    if (this.providerRunning) {
      this.dependencies.languageProvider.stop();
      this.providerRunning = false;
    }
  }
}
