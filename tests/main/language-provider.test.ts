import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "../../src/main/language-provider";

describe("language provider", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("invokes macOS defaults directly with no shell", async () => {
    const runner = vi.fn().mockResolvedValue({
      exitCode: 0,
      stdout: "com.apple.keylayout.2SetHangul\n",
      stderr: "",
      timedOut: false,
    });
    const provider = new LanguageProvider(
      "darwin",
      runner,
      vi.fn(),
      vi.fn(),
      "/unused/win.ps1",
    );

    await provider.poll();

    expect(runner).toHaveBeenCalledWith(
      "/usr/bin/defaults",
      [
        "read",
        "com.apple.HIToolbox",
        "AppleCurrentKeyboardLayoutInputSourceID",
      ],
      1_500,
    );
  });

  it("backs off after a non-zero exit and resets after recovery", async () => {
    const runner = vi
      .fn()
      .mockResolvedValueOnce({
        exitCode: 1,
        stdout: "",
        stderr: "failed",
        timedOut: false,
      })
      .mockResolvedValue({
        exitCode: 0,
        stdout: "com.apple.keylayout.ABC\n",
        stderr: "",
        timedOut: false,
      });
    const onState = vi.fn();
    const onError = vi.fn();
    const provider = new LanguageProvider(
      "darwin",
      runner,
      onState,
      onError,
      "/unused/win.ps1",
    );

    await provider.start();
    expect(runner).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(999);
    expect(runner).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(runner).toHaveBeenCalledTimes(2);
    expect(onState).toHaveBeenLastCalledWith({
      glyph: "A",
      observedAtMs: expect.any(Number),
    });
    await vi.advanceTimersByTimeAsync(999);
    expect(runner).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(runner).toHaveBeenCalledTimes(3);
  });

  it("emits hidden and bounded errors for malformed/timeout output", async () => {
    const runner = vi
      .fn()
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: "bad",
        stderr: "",
        timedOut: false,
      })
      .mockResolvedValueOnce({
        exitCode: null,
        stdout: "",
        stderr: "",
        timedOut: true,
      });
    const onState = vi.fn();
    const onError = vi.fn();
    const provider = new LanguageProvider(
      "win32",
      runner,
      onState,
      onError,
      "C:\\resources\\win-input-language.ps1",
    );

    await provider.poll();
    await provider.poll();

    expect(onState).toHaveBeenLastCalledWith({
      glyph: "hidden",
      observedAtMs: expect.any(Number),
    });
    expect(onError).toHaveBeenCalledTimes(2);
  });

  it("builds the Windows command with a file and no shell", async () => {
    const runner = vi.fn().mockResolvedValue({
      exitCode: 0,
      stdout: '{"layoutId":"0409","imeOpen":false}',
      stderr: "",
      timedOut: false,
    });
    const provider = new LanguageProvider(
      "win32",
      runner,
      vi.fn(),
      vi.fn(),
      "C:\\Program Files\\Followmeow\\resources\\win-input-language.ps1",
    );
    await provider.poll();
    expect(runner).toHaveBeenCalledWith(
      "powershell.exe",
      [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        "C:\\Program Files\\Followmeow\\resources\\win-input-language.ps1",
      ],
      1_500,
    );
  });
});
