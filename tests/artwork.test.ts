import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const assets = [
  "cat-idle.svg",
  "cat-walk-1.svg",
  "cat-walk-2.svg",
  "cat-run-1.svg",
  "cat-run-2.svg",
  "cat-turn.svg",
];

describe("approved cat artwork", () => {
  it("preserves the approved source hashes", () => {
    const manifest = JSON.parse(
      readFileSync("artwork/source-manifest.json", "utf8"),
    );
    const digest = (path: string) =>
      createHash("sha256").update(readFileSync(path)).digest("hex");

    expect(digest("artwork/source/cat-poses.svg")).toBe(
      manifest.catPosesSha256,
    );
    expect(digest("artwork/source/05-turn.svg")).toBe(manifest.turnSha256);
    expect(digest("artwork/visual-spec.md")).toBe(manifest.visualSpecSha256);
  });

  it("ships six self-contained, transparent pose assets", () => {
    for (const name of assets) {
      const svg = readFileSync(`src/renderer/assets/${name}`, "utf8");
      expect(svg).toMatch(/<svg[^>]+viewBox=/);
      expect(svg).not.toMatch(
        /(?:href|src)=["'](?:https?:|data:|file:|\/\/)/i,
      );
      expect(svg).not.toMatch(/Octocat|GitHub/i);
      expect(svg).not.toMatch(/<rect[^>]+width="(?:1440|2100)"/i);
      expect(svg).toContain("<path");
    }
  });
});
