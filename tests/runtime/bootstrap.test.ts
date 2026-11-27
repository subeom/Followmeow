// @vitest-environment jsdom

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { beforeAll, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  execFileSync(process.execPath, ["scripts/bundle-runtime.mjs"], {
    cwd: process.cwd(),
    stdio: "pipe",
  });
});

describe("packaged browser runtime", () => {
  it("loads the renderer bundle without CommonJS globals and accepts a frame", () => {
    const html = readFileSync("dist/renderer/index.html", "utf8");
    document.open();
    document.write(html);
    document.close();

    const ready = vi.fn();
    let onFrame: ((frame: unknown) => void) | undefined;
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: () => ({ matches: false }),
    });
    Object.assign(window, {
      followmeow: {
        ready,
        onFrame(listener: (frame: unknown) => void) {
          onFrame = listener;
          return () => {};
        },
      },
    });

    expect(html).toContain('<script src="./index.bundle.js">');
    const bundle = readFileSync("dist/renderer/index.bundle.js", "utf8");
    expect(bundle).not.toMatch(/\brequire\s*\(/);
    expect(() => {
      vm.runInContext(
        bundle,
        vm.createContext({
          window,
          document,
          console,
          HTMLElement: window.HTMLElement,
          HTMLImageElement: window.HTMLImageElement,
        }),
      );
    }).not.toThrow();

    expect(ready).toHaveBeenCalledOnce();
    onFrame?.({
      kind: "show",
      sequence: 1,
      observedAtMs: 1,
      bounds: { x: 10, y: 20, width: 144, height: 96 },
      motion: "idle",
      facesRight: true,
      glyph: "A",
      phaseMs: 0,
    });
    expect(
      document.querySelector<HTMLElement>("#followmeow-canvas")?.dataset
        .visible,
    ).toBe("true");
    expect(document.querySelector("#followmeow-glyph")?.textContent).toBe("A");
    onFrame?.({
      kind: "hide",
      sequence: 1,
      observedAtMs: 2,
      reason: "stale-cursor",
    });
    expect(
      document.querySelector<HTMLElement>("#followmeow-canvas")?.dataset
        .visible,
    ).toBe("true");
  });
});

describe("packaged preload runtime", () => {
  it("is self-contained except for Electron and forwards only valid frames", () => {
    const bundle = readFileSync("dist/preload/index.bundle.cjs", "utf8");
    expect(bundle).not.toMatch(/require\(["']\.\.?\//);

    const ipcHandlers = new Map<string, (event: unknown, value: unknown) => void>();
    const exposed: Record<string, unknown> = {};
    const ipcRenderer = {
      send: vi.fn(),
      on: vi.fn(
        (channel: string, handler: (event: unknown, value: unknown) => void) =>
          ipcHandlers.set(channel, handler),
      ),
      removeListener: vi.fn(),
    };
    const contextBridge = {
      exposeInMainWorld: vi.fn((name: string, value: unknown) => {
        exposed[name] = value;
      }),
    };
    const module = { exports: {} };
    const require = vi.fn((id: string) => {
      if (id === "electron") {
        return { contextBridge, ipcRenderer };
      }
      throw new Error(`unexpected preload dependency: ${id}`);
    });

    expect(() => {
      vm.runInNewContext(bundle, {
        module,
        exports: module.exports,
        require,
        console,
      });
    }).not.toThrow();

    const bridge = exposed.followmeow as {
      ready: () => void;
      onFrame: (listener: (frame: unknown) => void) => void;
    };
    bridge.ready();
    expect(ipcRenderer.send).toHaveBeenCalledWith("followmeow:renderer-ready");

    const listener = vi.fn();
    bridge.onFrame(listener);
    ipcHandlers.get("followmeow:frame")?.(
      {},
      {
        kind: "show",
        sequence: 1,
        observedAtMs: 1,
        bounds: { x: 0, y: 0, width: 144, height: 96 },
        motion: "idle",
        facesRight: true,
        glyph: "hidden",
        phaseMs: 0,
      },
    );
    ipcHandlers.get("followmeow:frame")?.({}, { kind: "show", sequence: -1 });
    expect(listener).toHaveBeenCalledOnce();
  });
});
