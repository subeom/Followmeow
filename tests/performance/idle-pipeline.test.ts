import { describe, expect, it, vi } from "vitest";
import { defaultSettings } from "../../src/domain/settings";
import type { CursorSample } from "../../src/domain/types";
import { FollowController } from "../../src/main/follow-controller";
import { OverlayWindow } from "../../src/main/overlay-window";

const SAMPLE_COUNT = 36_000;

describe("idle pipeline performance", () => {
  it("reports one overlay call for an unchanged 36,000-sample run", () => {
    const window = {
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
    const overlay = new OverlayWindow(
      () => window as never,
      "/app/dist/renderer/index.html",
    );
    let emittedFrames = 0;
    const controller = new FollowController(
      { ...defaultSettings("darwin"), languageMode: "hidden" },
      false,
      (frame) => {
        emittedFrames += 1;
        overlay.apply(frame);
      },
    );
    controller.rendererReady();

    for (let index = 0; index < SAMPLE_COUNT; index += 1) {
      const sample: CursorSample = {
        cursor: { x: 500, y: 400 },
        displays: [
          { id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
        ],
        displayGeneration: 0,
        observedAtMs: 1_000 + index * 16,
        sequence: index + 1,
      };
      controller.tick(sample, sample.observedAtMs);
    }

    expect({
      samples: SAMPLE_COUNT,
      emittedFrames,
      overlayCalls: window.webContents.send.mock.calls.length,
    }).toEqual({
      samples: 36_000,
      emittedFrames: 1,
      overlayCalls: 1,
    });
  });
});
