import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("renderer security", () => {
  it("has no inline script, no remote content, and denies connect", () => {
    const html = readFileSync("src/renderer/index.html", "utf8");
    expect(html).toContain("connect-src 'none'");
    expect(html).toContain("script-src 'self'");
    expect(html).not.toMatch(/<script(?![^>]+src=)/i);
    expect(html).not.toMatch(/(?:src|href)=["']https?:/i);
  });
});
