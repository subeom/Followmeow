// SPDX-FileCopyrightText: 2026 subeomlee
// SPDX-License-Identifier: GPL-2.0-only

import { execFile } from "node:child_process";
import { performance } from "node:perf_hooks";
import {
  classifyMacLayout,
  parseMacLayout,
  parseWindowsLayoutStrict,
  type LanguageObservation,
} from "../domain/language";
import type { PlatformName } from "../domain/types";

export type ProcessResult = Readonly<{
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}>;
export type ProcessRunner = (
  command: string,
  args: readonly string[],
  timeoutMs: number,
  signal: AbortSignal,
) => Promise<ProcessResult>;
export type ProviderError =
  | "provider-exit"
  | "provider-timeout"
  | "provider-output";

const POLL_INTERVAL_MS = 1_000;
const PROCESS_TIMEOUT_MS = 1_500;
const BACKOFF_MS = [1_000, 2_000, 4_000, 8_000, 16_000, 30_000] as const;

export const runProcess: ProcessRunner = (
  command,
  args,
  timeoutMs,
  signal,
) =>
  new Promise((resolve) => {
    execFile(
      command,
      [...args],
      {
        encoding: "utf8",
        maxBuffer: 16 * 1024,
        shell: false,
        signal,
        timeout: timeoutMs,
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        const timedOut =
          error !== null &&
          !signal.aborted &&
          "killed" in error &&
          error.killed === true &&
          (error.signal === "SIGTERM" || error.code === null);
        resolve({
          exitCode:
            error !== null && typeof error.code === "number"
              ? error.code
              : error === null
                ? 0
                : null,
          stdout,
          stderr,
          timedOut,
        });
      },
    );
  });

export class LanguageProvider {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = true;
  private generation = 0;
  private failureIndex = 0;
  private lastError: ProviderError | null = null;
  private readonly controllers = new Map<number, AbortController>();

  constructor(
    private readonly platform: PlatformName,
    private readonly runner: ProcessRunner,
    private readonly onState: (observation: LanguageObservation) => void,
    private readonly onError: (reason: ProviderError) => void,
    private readonly windowsScriptPath: string,
  ) {}

  async start(): Promise<void> {
    if (!this.stopped) {
      return;
    }
    this.stopped = false;
    const generation = ++this.generation;
    await this.runAndSchedule(generation);
  }

  async poll(): Promise<void> {
    await this.runOnce(this.generation);
  }

  reset(): void {
    this.stop();
    this.failureIndex = 0;
    this.lastError = null;
  }

  stop(): void {
    this.stopped = true;
    this.generation += 1;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    for (const controller of this.controllers.values()) {
      controller.abort();
    }
  }

  private async runAndSchedule(generation: number): Promise<void> {
    const success = await this.runOnce(generation);
    if (this.stopped || generation !== this.generation) {
      return;
    }
    const delay = success
      ? POLL_INTERVAL_MS
      : (BACKOFF_MS[
          Math.min(this.failureIndex - 1, BACKOFF_MS.length - 1)
        ] ?? 30_000);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.runAndSchedule(generation);
    }, delay);
  }

  private async runOnce(generation: number): Promise<boolean> {
    if (this.controllers.has(generation)) {
      return false;
    }
    const controller = new AbortController();
    this.controllers.set(generation, controller);
    try {
      const invocation =
        this.platform === "darwin"
          ? {
              command: "/usr/bin/defaults",
              args: [
                "read",
                "com.apple.HIToolbox",
                "AppleCurrentKeyboardLayoutInputSourceID",
              ],
            }
          : {
              command: "powershell.exe",
              args: [
                "-NoLogo",
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                this.windowsScriptPath,
              ],
            };
      let result: ProcessResult;
      try {
        result = await this.runner(
          invocation.command,
          invocation.args,
          PROCESS_TIMEOUT_MS,
          controller.signal,
        );
      } catch {
        if (generation !== this.generation) {
          return false;
        }
        this.failed("provider-exit");
        return false;
      }
      if (generation !== this.generation) {
        return false;
      }
      if (result.timedOut) {
        this.failed("provider-timeout");
        return false;
      }
      if (result.exitCode !== 0) {
        this.failed("provider-exit");
        return false;
      }

      const glyph =
        this.platform === "darwin"
          ? this.classifyMacResult(result.stdout)
          : parseWindowsLayoutStrict(result.stdout);
      if (glyph === null) {
        this.failed("provider-output");
        return false;
      }

      this.failureIndex = 0;
      this.lastError = null;
      this.onState({ glyph, observedAtMs: performance.now() });
      return true;
    } finally {
      if (this.controllers.get(generation) === controller) {
        this.controllers.delete(generation);
      }
    }
  }

  private classifyMacResult(stdout: string) {
    const identifier = parseMacLayout(stdout);
    return identifier === null ? null : classifyMacLayout(identifier);
  }

  private failed(reason: ProviderError): void {
    this.failureIndex = Math.min(this.failureIndex + 1, BACKOFF_MS.length);
    this.onState({ glyph: "hidden", observedAtMs: performance.now() });
    if (reason !== this.lastError) {
      this.onError(reason);
      this.lastError = reason;
    }
  }
}
