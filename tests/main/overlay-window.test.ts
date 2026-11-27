import { describe, expect, it, vi } from "vitest";
import {
  OVERLAY_BROWSER_WINDOW_OPTIONS,
  OverlayWindow,
} from "../../src/main/overlay-window";

function fakeWindow() {
  return {
    loadFile: vi.fn().mockResolvedValue(undefined),
    setIgnoreMouseEvents: vi.fn(),
    setAlwaysOnTop: vi.fn(),
    setVisibleOnAllWorkspaces: vi.fn(),
    setContentProtection: vi.fn(),
    setBounds: vi.fn(),
    showInactive: vi.fn(),
    hide: vi.fn(),
    destroy: vi.fn(),
    isDestroyed: () => false,
    webContents: {
      send: vi.fn(),
      setWindowOpenHandler: vi.fn(),
      on: vi.fn(),
      session: {
        setPermissionRequestHandler: vi.fn(),
        setPermissionCheckHandler: vi.fn(),
      },
    },
  };
}

describe("overlay window", () => {
  it("locks the BrowserWindow to the transparent overlay shape", () => {
    expect(OVERLAY_BROWSER_WINDOW_OPTIONS).toMatchObject({
      width: 144,
      height: 96,
      transparent: true,
      frame: false,
      resizable: false,
      movable: false,
      fullscreenable: false,
      focusable: false,
      skipTaskbar: true,
      webPreferences: {
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        nodeIntegrationInWorker: false,
        webSecurity: true,
      },
    });
  });

  it("makes the page click-through and applies show/hide frames", () => {
    const window = fakeWindow();
    const ready = vi.fn();
    const overlay = new OverlayWindow(
      () => window as never,
      "/app/dist/renderer/index.html",
      ready,
    );
    overlay.ready();
    overlay.apply({
      kind: "show",
      sequence: 1,
      observedAtMs: 1,
      bounds: { x: -1912.4, y: 8.2, width: 144, height: 96 },
      motion: "idle",
      facesRight: true,
      glyph: "hidden",
      phaseMs: 0,
    });
    overlay.apply({
      kind: "hide",
      sequence: 2,
      observedAtMs: 2,
      reason: "stale-cursor",
    });

    expect(ready).toHaveBeenCalledOnce();
    expect(window.setIgnoreMouseEvents).toHaveBeenCalledWith(true);
    expect(window.setBounds).toHaveBeenCalledWith({
      x: -1912,
      y: 8,
      width: 144,
      height: 96,
    });
    expect(window.showInactive).toHaveBeenCalledOnce();
    expect(window.hide).toHaveBeenCalledOnce();
    expect(window.webContents.send).toHaveBeenCalledTimes(2);
  });

  it("does not repeat identical positioning, IPC, or show calls", () => {
    const window = fakeWindow();
    const overlay = new OverlayWindow(
      () => window as never,
      "/app/dist/renderer/index.html",
    );
    const base = {
      kind: "show" as const,
      sequence: 1,
      observedAtMs: 1,
      bounds: { x: 100.2, y: 200.4, width: 144, height: 96 },
      motion: "idle" as const,
      facesRight: true,
      glyph: "hidden" as const,
      phaseMs: 0,
    };
    overlay.apply(base);
    overlay.apply({
      ...base,
      sequence: 2,
      observedAtMs: 2,
      bounds: { x: 100.4, y: 200.49, width: 144, height: 96 },
    });

    expect(window.setBounds).toHaveBeenCalledOnce();
    expect(window.showInactive).toHaveBeenCalledOnce();
    expect(window.webContents.send).toHaveBeenCalledOnce();
  });
});
