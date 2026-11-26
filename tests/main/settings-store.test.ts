import {
  mkdtemp,
  readFile,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { defaultSettings } from "../../src/domain/settings";
import { SettingsStore } from "../../src/main/settings-store";

describe("settings store", () => {
  it("round-trips a valid change with an atomic rename", async () => {
    const directory = await mkdtemp(join(tmpdir(), "followmeow-settings-"));
    const store = new SettingsStore(join(directory, "settings.json"), "darwin");
    await store.load();
    await store.save({
      ...store.value,
      enabled: false,
      languageMode: "A",
    });

    const saved = JSON.parse(
      await readFile(join(directory, "settings.json"), "utf8"),
    );
    expect(saved.enabled).toBe(false);
    expect(saved.languageMode).toBe("A");
  });

  it("backs up malformed JSON once and loads defaults", async () => {
    const directory = await mkdtemp(join(tmpdir(), "followmeow-settings-"));
    const path = join(directory, "settings.json");
    await writeFile(path, "{broken", "utf8");
    const store = new SettingsStore(path, "win32");
    const warnings = await store.load();

    expect(store.value).toEqual(defaultSettings("win32"));
    expect(warnings).toContain("invalid-json");
    expect(await readFile(join(directory, "settings.invalid.json"), "utf8")).toBe(
      "{broken",
    );
  });
});
