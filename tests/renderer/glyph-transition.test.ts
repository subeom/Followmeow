// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GlyphTransition } from "../../src/renderer/glyph-transition";

describe("glyph transition", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("fades the old glyph out and reveals the new glyph without overlap", () => {
    const element = document.createElement("span");
    const transition = new GlyphTransition(element, false);
    transition.update("A");
    transition.update("한");

    expect(element.textContent).toBe("A");
    expect(element.dataset.fading).toBe("true");
    vi.advanceTimersByTime(96);
    expect(element.textContent).toBe("");
    vi.advanceTimersByTime(24);
    expect(element.textContent).toBe("한");
    expect(element.dataset.fading).toBeUndefined();
    vi.advanceTimersByTime(120);
    expect(element.textContent).toBe("한");
  });

  it("changes immediately for reduced motion", () => {
    const element = document.createElement("span");
    const transition = new GlyphTransition(element, true);
    transition.update("A");
    transition.update("한");
    expect(element.textContent).toBe("한");
    expect(element.dataset.fading).toBeUndefined();
  });

  it("does not restart the same transition on every render frame", () => {
    const element = document.createElement("span");
    const transition = new GlyphTransition(element, false);
    transition.update("A");
    transition.update("한");
    vi.advanceTimersByTime(50);
    transition.update("한");
    vi.advanceTimersByTime(46);
    expect(element.textContent).toBe("");
    vi.advanceTimersByTime(24);
    expect(element.textContent).toBe("한");
  });
});
