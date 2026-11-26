// SPDX-FileCopyrightText: 2026 subeomlee
// SPDX-License-Identifier: GPL-2.0-only

import { constants } from "node:fs";
import {
  copyFile,
  open,
  readFile,
  rename,
  unlink,
} from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { decodeSettings, defaultSettings } from "../domain/settings";
import type { AppSettings, PlatformName } from "../domain/types";

function isErrno(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  );
}

export class SettingsStore {
  public value: AppSettings;

  constructor(
    public readonly path: string,
    private readonly platform: PlatformName,
  ) {
    this.value = defaultSettings(platform);
  }

  async load(): Promise<string[]> {
    let contents: string;
    try {
      contents = await readFile(this.path, "utf8");
    } catch (error) {
      if (isErrno(error, "ENOENT")) {
        this.value = defaultSettings(this.platform);
        return [];
      }
      throw error;
    }

    let decoded: unknown;
    try {
      decoded = JSON.parse(contents);
    } catch {
      await this.backupInvalid();
      this.value = defaultSettings(this.platform);
      await this.save(this.value);
      return ["invalid-json"];
    }

    const result = decodeSettings(decoded, this.platform);
    this.value = result.settings;
    if (result.warnings.includes("invalid-json")) {
      await this.backupInvalid();
      await this.save(this.value);
    }
    return [...result.warnings];
  }

  async save(next: AppSettings): Promise<void> {
    const result = decodeSettings(next, this.platform);
    if (result.warnings.length > 0) {
      throw new TypeError(
        `invalid settings candidate: ${result.warnings.join(",")}`,
      );
    }

    const temporaryPath = join(
      dirname(this.path),
      `.${basename(this.path)}.tmp`,
    );
    const file = await open(temporaryPath, "w", 0o600);
    try {
      await file.writeFile(`${JSON.stringify(result.settings, null, 2)}\n`, "utf8");
      await file.sync();
    } finally {
      await file.close();
    }

    try {
      await rename(temporaryPath, this.path);
    } catch (error) {
      try {
        await unlink(temporaryPath);
      } catch (cleanupError) {
        if (!isErrno(cleanupError, "ENOENT")) {
          throw cleanupError;
        }
      }
      throw error;
    }
    this.value = result.settings;
  }

  private async backupInvalid(): Promise<void> {
    const backupPath = join(dirname(this.path), "settings.invalid.json");
    try {
      await copyFile(this.path, backupPath, constants.COPYFILE_EXCL);
    } catch (error) {
      if (!isErrno(error, "EEXIST")) {
        throw error;
      }
    }
  }
}
