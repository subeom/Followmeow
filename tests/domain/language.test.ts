import { describe, expect, it } from "vitest";
import {
  classifyMacLayout,
  parseMacLayout,
  parseWindowsLayout,
  resolveLanguage,
} from "../../src/domain/language";

describe("language output parsing", () => {
  it("parses exactly one macOS layout identifier line", () => {
    expect(parseMacLayout("com.apple.keylayout.2SetHangul\n")).toBe(
      "com.apple.keylayout.2SetHangul",
    );
    expect(parseMacLayout("")).toBeNull();
    expect(parseMacLayout("US\nextra")).toBeNull();
  });

  it.each([
    ["com.apple.keylayout.2SetHangul", "한"],
    ["com.apple.inputmethod.Korean.2SetKorean", "한"],
    ["com.apple.keylayout.ABC", "A"],
    ["com.apple.keylayout.US", "A"],
    ["com.apple.keylayout.Dvorak", "A"],
    ["third.party.korean.guess", "hidden"],
  ] as const)("classifies %s as %s", (layout, expected) => {
    expect(classifyMacLayout(layout)).toBe(expected);
  });

  it.each([
    ['{"layoutId":"0412","imeOpen":true}', "한"],
    ['{"layoutId":"0412","imeOpen":false}', "A"],
    ['{"layoutId":"0409","imeOpen":false}', "A"],
    ['{"layoutId":"0411","imeOpen":true}', "hidden"],
    ['{"layoutId":"wat","imeOpen":true}', "hidden"],
    ['not-json', "hidden"],
  ] as const)("parses Windows layout state %s as %s", (stdout, expected) => {
    expect(parseWindowsLayout(stdout)).toBe(expected);
  });
});

describe("manual override and freshness", () => {
  const korean = { glyph: "한", observedAtMs: 5_000 } as const;

  it("uses a fresh automatic result and hides stale/unknown results", () => {
    expect(resolveLanguage("automatic", korean, 5_500)).toBe("한");
    expect(resolveLanguage("automatic", korean, 8_001)).toBe("hidden");
    expect(
      resolveLanguage(
        "automatic",
        { glyph: "hidden", observedAtMs: 5_500 },
        5_600,
      ),
    ).toBe("hidden");
  });

  it.each(["hidden", "A", "한"] as const)(
    "manual %s always wins",
    (mode) => {
      expect(resolveLanguage(mode, korean, 50_000)).toBe(mode);
    },
  );
});
