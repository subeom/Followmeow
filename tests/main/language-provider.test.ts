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
      expect.any(AbortSignal),
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

    expect(onState).not.toHaveBeenCalled();
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
      expect.any(AbortSignal),
    );
  });

  it("ignores a pending result after stop and does not schedule retry", async () => {
    let resolvePending:
      | ((value: {
          exitCode: number;
          stdout: string;
          stderr: string;
          timedOut: boolean;
        }) => void)
      | undefined;
    let signal: AbortSignal | undefined;
    const runner = vi.fn(
      async (
        _command: string,
        _args: readonly string[],
        _timeout: number,
        receivedSignal: AbortSignal,
      ) => {
        signal = receivedSignal;
        return await new Promise((resolve) => {
          resolvePending = resolve;
        });
      },
    );
    const onState = vi.fn();
    const onError = vi.fn();
    const provider = new LanguageProvider(
      "darwin",
      runner,
      onState,
      onError,
      "/unused/win.ps1",
    );

    const running = provider.start();
    provider.stop();
    expect(signal?.aborted).toBe(true);
    resolvePending?.({
      exitCode: 0,
      stdout: "com.apple.keylayout.ABC\n",
      stderr: "",
      timedOut: false,
    });
    await running;

    expect(onState).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("bounds reset/start generations to the newest poll", async () => {
    const pending: Array<{
      resolve: (result: {
        exitCode: number;
        stdout: string;
        stderr: string;
        timedOut: boolean;
      }) => void;
      signal: AbortSignal;
    }> = [];
    const runner = vi.fn(
      async (
        _command: string,
        _args: readonly string[],
        _timeout: number,
        signal: AbortSignal,
      ) =>
        await new Promise((resolve) => {
          pending.push({ resolve, signal });
        }),
    );
    const onState = vi.fn();
    const onError = vi.fn();
    const provider = new LanguageProvider(
      "darwin",
      runner,
      onState,
      onError,
      "/unused/win.ps1",
    );

    const first = provider.start();
    provider.reset();
    const second = provider.start();
    expect(pending).toHaveLength(2);
    expect(pending[0]?.signal.aborted).toBe(true);
    pending[0]?.resolve({
      exitCode: 1,
      stdout: "",
      stderr: "old",
      timedOut: false,
    });
    await first;
    pending[1]?.resolve({
      exitCode: 0,
      stdout: "com.apple.keylayout.2SetHangul\n",
      stderr: "",
      timedOut: false,
    });
    await second;

    expect(onError).not.toHaveBeenCalled();
    expect(onState).toHaveBeenCalledTimes(1);
    expect(onState).toHaveBeenCalledWith({
      glyph: "한",
      observedAtMs: expect.any(Number),
    });
    expect(vi.getTimerCount()).toBe(1);
  });

  it("emits state only on glyph change while heartbeating freshness", async () => {
    const runner = vi.fn().mockResolvedValue({
      exitCode: 0,
      stdout: "com.apple.keylayout.ABC\n",
      stderr: "",
      timedOut: false,
    });
    const onState = vi.fn();
    const onHeartbeat = vi.fn();
    const provider = new LanguageProvider(
      "darwin",
      runner,
      onState,
      vi.fn(),
      "/unused/win.ps1",
      onHeartbeat,
    );

    await provider.poll();
    await provider.poll();

    expect(onState).toHaveBeenCalledOnce();
    expect(onHeartbeat).toHaveBeenCalledTimes(2);
  });

  it("deduplicates repeated hidden observations across failures", async () => {
    const runner = vi.fn().mockResolvedValue({
      exitCode: 0,
      stdout: "unknown.source",
      stderr: "",
      timedOut: false,
    });
    const onState = vi.fn();
    const provider = new LanguageProvider(
      "darwin",
      runner,
      onState,
      vi.fn(),
      "/unused/win.ps1",
    );

    await provider.poll();
    await provider.poll();

    expect(onState).toHaveBeenCalledTimes(0);
  });
});
