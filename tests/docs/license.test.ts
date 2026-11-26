import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("project notices", () => {
  const files = (directory: string): string[] =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory()
        ? files(join(directory, entry.name))
        : [join(directory, entry.name)],
    );

  it("keeps GPL and required attribution text", () => {
    const license = readFileSync("LICENSE", "utf8");
    const notices = readFileSync("THIRD_PARTY_NOTICES.md", "utf8");
    const notice = readFileSync("NOTICE", "utf8");
    expect(license).toContain("GNU GENERAL PUBLIC LICENSE");
    expect(notices).toContain("Deskflow");
    expect(notices).toContain(
      "subeomlee-microsoft-korean-input-cursor-indicator",
    );
    expect(notice).toContain("subeomlee");
    expect(notice).toContain("cat-poses.svg");
  });

  it("states automatic and manual language privacy boundaries", () => {
    const privacy = readFileSync("PRIVACY.md", "utf8");
    expect(privacy).toContain("automatic");
    expect(privacy).toContain("manual override");
    expect(privacy).toContain("does not read field text or key events");
    expect(privacy).toContain("Accessibility");
    expect(privacy).toContain("no network");
  });

  it("documents an honest four-platform release gate", () => {
    const smoke = readFileSync("docs/release-smoke-checklist.md", "utf8");
    for (const target of [
      "macOS x64",
      "macOS arm64",
      "Windows x64",
      "Windows arm64",
    ]) {
      expect(smoke).toContain(target);
    }
    expect(smoke).toContain("cross-packaging is not native runtime proof");
  });

  it("marks authored production source with SPDX", () => {
    const sourceFiles = [
      ...files("src").filter((path) => path.endsWith(".ts")),
      ...readdirSync("scripts").map((name) => join("scripts", name)),
      "resources/win-input-language.ps1",
    ];
    for (const path of sourceFiles) {
      const source = readFileSync(path, "utf8");
      expect(source, path).toContain("SPDX-License-Identifier: GPL-2.0-only");
    }
  });
});
