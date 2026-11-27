// SPDX-FileCopyrightText: 2026 subeomlee
// SPDX-License-Identifier: GPL-2.0-only

import { join } from "node:path";
import type {
  BrowserWindow,
  BrowserWindowConstructorOptions,
} from "electron";
import { isRenderFrame } from "../domain/contracts";
import { OVERLAY_SIZE, type RenderFrame } from "../domain/types";

export const OVERLAY_BROWSER_WINDOW_OPTIONS: BrowserWindowConstructorOptions = {
  width: OVERLAY_SIZE.width,
  height: OVERLAY_SIZE.height,
  transparent: true,
  frame: false,
  resizable: false,
  movable: false,
  fullscreenable: false,
  minimizable: false,
  maximizable: false,
  closable: false,
  focusable: false,
  skipTaskbar: true,
  show: false,
  hasShadow: false,
  webPreferences: {
    contextIsolation: true,
    sandbox: true,
    nodeIntegration: false,
    nodeIntegrationInWorker: false,
    webSecurity: true,
    preload: join(__dirname, "../preload/index.bundle.cjs"),
  },
};

export class OverlayWindow {
  private readonly window: BrowserWindow;
  private readonly loadPromise: Promise<void>;
  private readyReported = false;

  constructor(
    factory: (options: BrowserWindowConstructorOptions) => BrowserWindow,
    rendererPath: string,
    private readonly onReady?: () => void,
  ) {
    this.window = factory({
      ...OVERLAY_BROWSER_WINDOW_OPTIONS,
      webPreferences: {
        ...OVERLAY_BROWSER_WINDOW_OPTIONS.webPreferences,
        devTools: false,
      },
    });
    this.window.setIgnoreMouseEvents(true);
    this.window.setAlwaysOnTop(true, "screen-saver");
    this.window.setContentProtection(true);
    this.window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    this.window.webContents.on("will-navigate", (event) => {
      event.preventDefault();
    });
    this.window.webContents.session.setPermissionRequestHandler(
      (_webContents, _permission, callback) => callback(false),
    );
    this.window.webContents.session.setPermissionCheckHandler(() => false);
    this.loadPromise = this.window.loadFile(rendererPath);
  }

  whenLoaded(): Promise<void> {
    return this.loadPromise;
  }

  ready(): void {
    if (this.readyReported) {
      return;
    }
    this.readyReported = true;
    this.onReady?.();
  }

  setFullScreenVisibility(enabled: boolean): void {
    if (process.platform === "darwin") {
      this.window.setVisibleOnAllWorkspaces(enabled, {
        visibleOnFullScreen: enabled,
      });
    }
  }

  ownsWebContents(contents: Electron.WebContents): boolean {
    return this.window.webContents === contents;
  }

  apply(frame: RenderFrame): void {
    if (!isRenderFrame(frame)) {
      throw new TypeError("overlay received an invalid render frame");
    }
    if (this.window.isDestroyed()) {
      return;
    }

    if (frame.kind === "hide") {
      this.window.webContents.send("followmeow:frame", frame);
      this.window.hide();
      return;
    }

    this.window.setBounds({
      x: Math.round(frame.bounds.x),
      y: Math.round(frame.bounds.y),
      width: OVERLAY_SIZE.width,
      height: OVERLAY_SIZE.height,
    });
    this.window.webContents.send("followmeow:frame", frame);
    this.window.showInactive();
  }

  destroy(): void {
    if (!this.window.isDestroyed()) {
      this.window.destroy();
    }
  }
}
