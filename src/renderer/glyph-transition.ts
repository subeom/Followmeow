export type TorsoGlyph = "" | "A" | "한";

export class GlyphTransition {
  private value: TorsoGlyph = "";
  private target: TorsoGlyph = "";
  private timers: number[] = [];

  constructor(
    private readonly element: HTMLElement,
    private readonly reducedMotion: boolean,
    private readonly schedule: typeof window.setTimeout = window.setTimeout.bind(
      window,
    ),
    private readonly cancel: typeof window.clearTimeout = window.clearTimeout.bind(
      window,
    ),
  ) {}

  update(next: TorsoGlyph): void {
    if (next === this.target) {
      return;
    }
    this.target = next;
    this.clear();
    if (this.reducedMotion || this.value.length === 0) {
      this.present(next);
      return;
    }

    this.element.dataset.fading = "true";
    this.timers.push(
      this.schedule(() => {
        this.present("");
      }, 96),
      this.schedule(() => {
        this.present(next);
        delete this.element.dataset.fading;
      }, 120),
      this.schedule(() => {
        delete this.element.dataset.fading;
      }, 240),
    );
  }

  dispose(): void {
    this.clear();
  }

  private present(value: TorsoGlyph): void {
    this.value = value;
    this.element.textContent = value;
    this.element.dataset.glyph = value || "hidden";
  }

  private clear(): void {
    for (const timer of this.timers) {
      this.cancel(timer);
    }
    this.timers = [];
  }
}
