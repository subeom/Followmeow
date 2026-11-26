import { describe, expect, it, vi } from "vitest";
import { OverlayWindow } from "../../src/main/overlay-window";

function fakeWindow() {
  const permissionRequest = vi.fn();
  const permissionCheck = vi.fn();
  const webContents = {
    send: vi.fn(),
    setWindowOpenHandler: vi.fn(),
    on: vi.fn(),
    session: {
      setPermissionRequestHandler: permissionRequest,
      setPermissionCheckHandler: permissionCheck,
    },
  };
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
    webContents,
  };
}

describe("overlay runtime security", () => {
  it("denies navigation, popups, and all permissions", () => {
    const window = fakeWindow();
    new OverlayWindow(() => window as never, "/app/index.html");

    const popupHandler = window.webContents.setWindowOpenHandler.mock.calls[0]?.[0];
    expect(popupHandler?.()).toEqual({ action: "deny" });

    const navigation = window.webContents.on.mock.calls.find(
      ([event]) => event === "will-navigate",
    )?.[1];
    const preventDefault = vi.fn();
    navigation?.({ preventDefault });
    expect(preventDefault).toHaveBeenCalledOnce();

    const permissionHandler =
      window.webContents.session.setPermissionRequestHandler.mock.calls[0]?.[0];
    const grant = vi.fn();
    permissionHandler?.({}, "clipboard-read", grant);
    expect(grant).toHaveBeenCalledWith(false);
  });

  it("rejects invalid frames before IPC delivery", () => {
    const window = fakeWindow();
    const overlay = new OverlayWindow(() => window as never, "/app/index.html");
    expect(() =>
      overlay.apply({ kind: "show", sequence: -1 } as never),
    ).toThrow(TypeError);
    expect(window.webContents.send).not.toHaveBeenCalled();
  });
});
