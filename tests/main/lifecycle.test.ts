import { describe, expect, it, vi } from "vitest";
import { defaultSettings } from "../../src/domain/settings";
import type { AppSettings } from "../../src/domain/types";
import { AppLifecycle } from "../../src/main/lifecycle";

function harness(initial: AppSettings = defaultSettings("darwin")) {
  let value = initial;
  const calls: string[] = [];
  const store = {
    get value() {
      return value;
    },
    save: vi.fn(async (next: AppSettings) => {
      value = next;
    }),
  };
  const controller = {
    rendererReady: vi.fn(() => calls.push("controller-ready")),
    setSettings: vi.fn(),
    invalidate: vi.fn(),
    quit: vi.fn(() => calls.push("controller-quit")),
  };
  const sampler = {
    start: vi.fn(() => calls.push("sampler-start")),
    stop: vi.fn(() => calls.push("sampler-stop")),
  };
  const overlay = {
    setFullScreenVisibility: vi.fn(),
    destroy: vi.fn(() => calls.push("overlay-destroy")),
  };
  const tray = {
    update: vi.fn(),
    showError: vi.fn(),
    destroy: vi.fn(() => calls.push("tray-destroy")),
  };
  const provider = {
    start: vi.fn(async () => calls.push("provider-start")),
    stop: vi.fn(() => calls.push("provider-stop")),
    reset: vi.fn(),
  };
  const login = vi.fn();
  const lifecycle = new AppLifecycle({
    store,
    controller,
    sampler,
    overlay,
    tray,
    languageProvider: provider,
    setLoginItem: login,
    now: () => 10_000,
    openAbout: vi.fn(),
  });
  return {
    lifecycle,
    store,
    controller,
    sampler,
    overlay,
    tray,
    provider,
    login,
    calls,
    setValue(next: AppSettings) {
      value = next;
    },
  };
}

describe("app lifecycle", () => {
  it("starts sampling and automatic language after renderer-ready", async () => {
    const h = harness();
    await h.lifecycle.rendererReady();
    expect(h.controller.rendererReady).toHaveBeenCalledOnce();
    expect(h.sampler.start).toHaveBeenCalledOnce();
    expect(h.provider.start).toHaveBeenCalledOnce();
  });

  it("persists disable, stops work, and rebuilds tray state", async () => {
    const h = harness();
    await h.lifecycle.rendererReady();
    await h.lifecycle.handleAction({ type: "toggle-enabled", value: false });

    expect(h.store.save).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false }),
    );
    expect(h.sampler.stop).toHaveBeenCalledOnce();
    expect(h.controller.invalidate).toHaveBeenCalledWith("disabled", 10_000);
    expect(h.tray.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: false }),
    );
  });

  it("destroys in reverse operational order", async () => {
    const h = harness();
    h.lifecycle.quit();
    expect(h.calls).toEqual([
      "sampler-stop",
      "provider-stop",
      "controller-quit",
      "overlay-destroy",
      "tray-destroy",
    ]);
  });

  it("keeps settings and menu unchanged after save failure", async () => {
    const h = harness();
    h.store.save.mockRejectedValueOnce(new Error("disk full"));
    await h.lifecycle.handleAction({ type: "toggle-enabled", value: false });

    expect(h.store.value.enabled).toBe(true);
    expect(h.tray.update).not.toHaveBeenCalled();
    expect(h.tray.showError).toHaveBeenCalledWith("settings-save-failed");
  });

  it("rolls back launch-at-login if the settings write fails", async () => {
    const h = harness({
      ...defaultSettings("darwin"),
      launchAtLogin: false,
    });
    h.store.save.mockRejectedValueOnce(new Error("disk full"));
    await h.lifecycle.handleAction({
      type: "set-launch-at-login",
      value: true,
    });

    expect(h.login).toHaveBeenNthCalledWith(1, true);
    expect(h.login).toHaveBeenNthCalledWith(2, false);
    expect(h.store.value.launchAtLogin).toBe(false);
  });
});
