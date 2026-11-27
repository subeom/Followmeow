import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("packaging", () => {
  const manifest = JSON.parse(readFileSync("package.json", "utf8"));

  it("defines four separate architecture commands", () => {
    expect(manifest.scripts["package:mac:x64"]).toContain("--mac --x64");
    expect(manifest.scripts["package:mac:arm64"]).toContain("--mac --arm64");
    expect(manifest.scripts["package:win:x64"]).toContain("--win --x64");
    expect(manifest.scripts["package:win:arm64"]).toContain("--win --arm64");
  });

  it("includes the app, legal files, and Windows provider", () => {
    expect(manifest.build.appId).toBe("com.subeom.Followmeow");
    expect(manifest.build.files).toEqual(
      expect.arrayContaining([
        "dist/**/*",
        "LICENSE",
        "NOTICE",
        "THIRD_PARTY_NOTICES.md",
        "PRIVACY.md",
      ]),
    );
    expect(manifest.build.extraResources).toEqual(
      expect.arrayContaining([
        {
          from: "resources/win-input-language.ps1",
          to: "resources/win-input-language.ps1",
        },
        {
          from: "THIRD_PARTY_NOTICES.md",
          to: "THIRD_PARTY_NOTICES.md",
        },
      ]),
    );
    expect(JSON.stringify(manifest.build.files)).not.toContain("src/");
    expect(JSON.stringify(manifest.build.files)).not.toContain("tests/");
  });

  it("has a 512px application icon derived from the original cat", () => {
    expect(existsSync("build/icon.png")).toBe(true);
    const png = readFileSync("build/icon.png");
    expect(png.subarray(1, 4).toString("ascii")).toBe("PNG");
    expect(png.readUInt32BE(16)).toBe(512);
    expect(png.readUInt32BE(20)).toBe(512);
  });

  it("packages only English and Korean Electron locales", () => {
    expect(manifest.build.mac.electronLanguages).toEqual(["en", "ko"]);
    expect(manifest.build.win.electronLanguages).toEqual(["en-US", "ko"]);
  });

  it("runs the packaged runtime smoke test in CI and release packaging", () => {
    for (const path of [
      ".github/workflows/ci.yml",
      ".github/workflows/release.yml",
    ]) {
      const workflow = readFileSync(path, "utf8");
      expect(workflow).toContain("npm run test:runtime");
      expect(workflow.match(/npm run build/g)).toHaveLength(1);
      expect(workflow).not.toContain("path: release/");
      expect(workflow).toContain(
        "release/Followmeow-*-${{ matrix.platform }}-${{ matrix.arch }}.zip",
      );
      expect(workflow).toContain(
        "release/Followmeow-*-${{ matrix.platform }}-${{ matrix.arch }}.exe",
      );
    }
    expect(manifest.scripts["test:runtime"]).toBe(
      "vitest run --run tests/runtime/bootstrap.test.ts",
    );
    expect(manifest.scripts["test:runtime:clean"]).toBe(
      "npm run build && npm run test:runtime",
    );
  });
});
