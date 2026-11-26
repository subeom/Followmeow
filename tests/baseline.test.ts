import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("repository baseline", () => {
  it("uses a JS-only development dependency toolchain", () => {
    const manifest = JSON.parse(readFileSync("package.json", "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies: Record<string, string>;
    };

    expect(manifest.dependencies).toBeUndefined();
    expect(Object.keys(manifest.devDependencies).sort()).toEqual(
      expect.arrayContaining(["electron", "electron-builder", "typescript", "vitest"]),
    );
  });

  it("enables the required strict TypeScript checks", () => {
    const config = JSON.parse(readFileSync("tsconfig.json", "utf8"));
    expect(config.compilerOptions.strict).toBe(true);
    expect(config.compilerOptions.noUncheckedIndexedAccess).toBe(true);
    expect(config.compilerOptions.exactOptionalPropertyTypes).toBe(true);
  });
});
