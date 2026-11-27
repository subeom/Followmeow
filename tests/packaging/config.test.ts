import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { inflateSync } from "node:zlib";
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

  it("uses the approved 1024px metaphysical application icon exactly", () => {
    expect(existsSync("build/icon.png")).toBe(true);
    const png = readFileSync("build/icon.png");
    expect(png.subarray(1, 4).toString("ascii")).toBe("PNG");
    expect(png.readUInt32BE(16)).toBe(1024);
    expect(png.readUInt32BE(20)).toBe(1024);
    expect(png[25]).toBe(6);
    expect(
      createHash("sha256").update(png).digest("hex"),
    ).toBe("41d6270158ed148695f525256af8ae4e6091a8a5445305bd6e17262d7ee2eda4");
    const rgba = readPngRgba(png);
    expect(rgba[(512 * 1024 + 512) * 4 + 3]).toBeGreaterThanOrEqual(240);
    let nearlyOpaquePixels = 0;
    for (let alpha = 3; alpha < rgba.length; alpha += 4) {
      if ((rgba[alpha] ?? 0) >= 240) {
        nearlyOpaquePixels += 1;
      }
    }
    expect(nearlyOpaquePixels / (1024 * 1024)).toBeGreaterThan(0.7);
    expect(manifest.build.mac.icon).toBe("build/icon.png");
    expect(manifest.build.win.icon).toBe("build/icon.png");
  });

  it("preserves the approved icon source and provenance", () => {
    const source = readFileSync(
      "artwork/icon/followmeow-metaphysical-icon.png",
    );
    const buildIcon = readFileSync("build/icon.png");
    expect(source.equals(buildIcon)).toBe(true);
    expect(readFileSync("artwork/icon/README.md", "utf8")).toContain(
      "GPL-2.0-only",
    );
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
      expect(workflow).toContain(
        "npm run verify:icons:${{ matrix.platform }}",
      );
    }
    expect(manifest.scripts["test:runtime"]).toBe(
      "vitest run --run tests/runtime/bootstrap.test.ts",
    );
    expect(manifest.scripts["test:runtime:clean"]).toBe(
      "npm run build && npm run test:runtime",
    );
    expect(manifest.scripts["verify:icons:mac"]).toBe(
      "node scripts/verify-packaged-icons.mjs mac",
    );
    expect(manifest.scripts["verify:icons:win"]).toBe(
      "node scripts/verify-packaged-icons.mjs win",
    );
  });
});

function readPngRgba(png: Buffer): Buffer {
  let offset = 8;
  let width = 0;
  let height = 0;
  const idat: Buffer[] = [];
  while (offset + 12 <= png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.subarray(offset + 4, offset + 8).toString("ascii");
    const data = png.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      expect(data[8]).toBe(8);
      expect(data[9]).toBe(6);
    } else if (type === "IDAT") {
      idat.push(data);
    }
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const pixels = Buffer.alloc(stride * height);
  let cursor = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[cursor];
    cursor += 1;
    const row = pixels.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x += 1) {
      const left = x >= 4 ? row[x - 4] ?? 0 : 0;
      const above = y > 0 ? pixels[(y - 1) * stride + x] ?? 0 : 0;
      const upperLeft =
        y > 0 && x >= 4 ? pixels[(y - 1) * stride + x - 4] ?? 0 : 0;
      const rawByte = raw[cursor + x] ?? 0;
      const predictors = [
        0,
        left,
        above,
        Math.floor((left + above) / 2),
        (() => {
          const p = left + above - upperLeft;
          const pa = Math.abs(p - left);
          const pb = Math.abs(p - above);
          const pc = Math.abs(p - upperLeft);
          return pa <= pb && pa <= pc ? left : pb <= pc ? above : upperLeft;
        })(),
      ];
      row[x] = (rawByte + (predictors[filter] ?? 0)) & 0xff;
    }
    cursor += stride;
  }
  return pixels;
}
