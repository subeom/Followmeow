import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(join(directory, entry.name))
      : [join(directory, entry.name)],
  );
}

describe("privacy source boundary", () => {
  it("contains no forbidden privileged or network API", () => {
    const source = files("src")
      .filter((path) => !path.endsWith(".png"))
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");
    expect(source).not.toMatch(
      /\bfetch\s*\(|XMLHttpRequest|WebSocket|node:http|node:https|clipboard|globalShortcut|robotjs|accessibility|AXUIElement|CGEventTap|keycode|shell\.openExternal/,
    );
  });

  it("allows only the two preload IPC messages", () => {
    const preload = readFileSync("src/preload/index.ts", "utf8");
    expect(
      [...preload.matchAll(/"(followmeow:[^"]+)"/g)]
        .map((match) => match[1])
        .sort(),
    ).toEqual(["followmeow:frame", "followmeow:renderer-ready"]);
  });
});
