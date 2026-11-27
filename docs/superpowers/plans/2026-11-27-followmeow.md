# Followmeow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Followmeow as a tray-only Electron cat companion that follows the cursor on macOS and Windows x64/arm64 while classifying only OS layout/IME state for A/한 and preserving manual override.

**Architecture:** A TypeScript main process owns Electron screen sampling, deterministic policy/geometry/motion, settings, the click-through overlay, and the tray. A sandboxed, context-isolated renderer receives only validated frames; all behavioral logic remains in pure domain modules covered by Vitest. Electron Builder and a four-row GitHub Actions matrix package separate x64 and arm64 releases.

**Tech Stack:** Electron, TypeScript, Vitest, jsdom, Electron Builder, Node file APIs, GitHub Actions.

---

## Read before implementation

- Specification: `docs/superpowers/specs/2026-11-27-followmeow-design.md`
- Existing repository baseline: `README.md` and GPL-2.0-only `LICENSE`
- Deskflow reference behavior:
  - `src/lib/gui/input/InputIndicatorGeometry.cpp`
  - `src/lib/gui/input/InputIndicatorPolicy.cpp`
  - `src/lib/gui/input/MacInputIndicatorController.mm`
  - `src/lib/gui/input/MacInputIndicatorPanel.h`
- Approved art inputs:
  - `/Users/subeomlee/.copilot/session-state/9825e0bd-8139-47fe-b559-07f6b89986e4/files/cat-art/cat-poses.svg`
  - `/Users/subeomlee/.copilot/session-state/9825e0bd-8139-47fe-b559-07f6b89986e4/files/cat-art/visual-spec.md`

Run every command from the repository root. Do not install or add native npm
addons. Do not request Accessibility, Screen Recording, Input Monitoring, or
key-event permission. Do not open a PR unless the coordinator explicitly asks
for one.

## File map

| File or directory | Responsibility |
|---|---|
| `package.json`, `package-lock.json`, `tsconfig.json`, `vitest.config.ts` | Toolchain, scripts, test/build settings |
| `.gitignore` | Build/package/runtime exclusions |
| `scripts/copy-static.mjs` | Copy HTML, CSS, SVG, and notices into `dist` |
| `scripts/verify-macos-architecture.mjs` | Inspect packaged Mach-O architecture |
| `scripts/verify-pe-architecture.mjs` | Inspect packaged PE architecture |
| `src/domain/types.ts` | Shared serializable data contracts and constants |
| `src/domain/contracts.ts` | Runtime validation for cursor and render data |
| `src/domain/geometry.ts` | Display containment, follower origin, clamping |
| `src/domain/policy.ts` | Show/hide fail-closed policy |
| `src/domain/motion.ts` | Fixed-step spring and motion state machine |
| `src/domain/language.ts` | macOS/Windows output parsers, classifiers, freshness, and manual override |
| `src/domain/settings.ts` | Strict settings defaults and validation |
| `src/main/settings-store.ts` | Atomic settings persistence |
| `src/main/language-provider.ts` | Exact process invocation, timeout, and retry/backoff |
| `src/main/cursor-sampler.ts` | Electron screen adapter and 16 ms polling |
| `src/main/follow-controller.ts` | Controller composition and render-frame sequence |
| `src/main/overlay-window.ts` | BrowserWindow security and placement |
| `src/main/tray.ts` | Typed tray menu model and Electron tray binding |
| `src/main/index.ts` | Electron lifecycle composition |
| `src/preload/index.ts` | Narrow context-isolated bridge |
| `src/renderer/index.html` | CSP, canvas, glyph, and stylesheet/script references |
| `src/renderer/index.css` | Transparent layout and pose transitions |
| `src/renderer/view-model.ts` | Pure frame-to-render view model |
| `src/renderer/index.ts` | DOM application of validated frames |
| `src/renderer/assets/*.svg` | Six normalized runtime pose assets |
| `resources/win-input-language.ps1` | Read-only Windows foreground layout/IME state probe |
| `artwork/source/*` | Preserved approved source art and visual spec |
| `tests/**/*.test.ts` | Unit and integration coverage |
| `.github/workflows/ci.yml` | Test/build matrix |
| `.github/workflows/release.yml` | Four-target release packaging |
| `README.md`, `PRIVACY.md`, `NOTICE`, `THIRD_PARTY_NOTICES.md` | User, privacy, and attribution documents |
| `docs/release-smoke-checklist.md` | Native four-platform release gate |

## Baseline commands

After Task 1, these commands are the common verification set:

```bash
npm ci
npm run check
npm test
npm run build
```

Expected after each task: `npm run check` exits 0, the task's targeted test exits
0, and the full suite has no failures. A packaging task additionally runs the
matching `npm run package:*` command and architecture verifier.

---

### Task 1: Establish the TypeScript and test baseline

**Files:**
- Create: `package.json`
- Create: `package-lock.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `scripts/copy-static.mjs`
- Create: `src/index.ts`
- Create: `tests/baseline.test.ts`

- [ ] **Step 1: Create the package manifest and install exact tooling**

Run:

```bash
npm init -y
npm pkg set name=followmeow version=0.1.0 main=dist/main/index.js type=commonjs
npm pkg set license=GPL-2.0-only
npm pkg set scripts.check="tsc -p tsconfig.json --noEmit"
npm pkg set scripts.test="vitest run"
npm pkg set scripts.test:watch="vitest"
npm pkg set scripts.build="tsc -p tsconfig.json && node scripts/copy-static.mjs"
npm pkg set scripts.start="npm run build && electron ."
npm pkg set scripts.package:mac:x64="electron-builder --mac --x64"
npm pkg set scripts.package:mac:arm64="electron-builder --mac --arm64"
npm pkg set scripts.package:win:x64="electron-builder --win --x64"
npm pkg set scripts.package:win:arm64="electron-builder --win --arm64"
npm pkg set scripts.verify:mac:x64="node scripts/verify-macos-architecture.mjs x64"
npm pkg set scripts.verify:mac:arm64="node scripts/verify-macos-architecture.mjs arm64"
npm pkg set scripts.verify:win:x64="node scripts/verify-pe-architecture.mjs x64"
npm pkg set scripts.verify:win:arm64="node scripts/verify-pe-architecture.mjs arm64"
npm install --save-dev electron@37.2.3 electron-builder@26.0.12 typescript@5.8.3 vitest@3.2.4 jsdom@26.1.0 @types/node@22.15.30
```

Expected: `package.json` contains no `dependencies` key; all packages are in
`devDependencies`; `package-lock.json` is present.

- [ ] **Step 2: Write the strict baseline test before configuration**

Create `tests/baseline.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("repository baseline", () => {
  it("uses a JS-only dev dependency toolchain", () => {
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
```

- [ ] **Step 3: Run the baseline test to record RED**

Run:

```bash
npm test -- --run tests/baseline.test.ts
```

Expected: FAIL because `tsconfig.json` does not exist.

- [ ] **Step 4: Add TypeScript, Vitest, and ignore configuration**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "Node",
    "lib": ["ES2022", "DOM"],
    "rootDir": "src",
    "outDir": "dist",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "types": ["node", "vitest/globals"]
  },
  "include": ["src/**/*.ts"],
  "exclude": ["dist", "release", "tests"]
}
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      include: ["src/domain/**", "src/main/**", "src/renderer/view-model.ts"],
    },
  },
});
```

Create `.gitignore`:

```gitignore
node_modules/
dist/
release/
.DS_Store
*.log
settings.invalid.json
```

Create `src/index.ts`:

```ts
export {};
```

Create the initial `scripts/copy-static.mjs`:

```js
import { mkdirSync } from "node:fs";

mkdirSync("dist", { recursive: true });
```

Rerun:

```bash
npm run check
npm test -- --run tests/baseline.test.ts
npm run build
```

Expected: `check`, the 2 baseline tests, and `build` all exit 0. The
`src/index.ts` marker gives TypeScript one input; no application behavior exists
yet.

- [ ] **Step 5: Commit the baseline**

```bash
git add .gitignore package.json package-lock.json tsconfig.json vitest.config.ts scripts/copy-static.mjs src/index.ts tests/baseline.test.ts
git commit -m "chore: establish Followmeow toolchain"
```

### Task 2: Define and validate domain contracts

**Files:**
- Create: `src/domain/types.ts`
- Create: `src/domain/contracts.ts`
- Create: `tests/domain/contracts.test.ts`
- Test: `tests/domain/contracts.test.ts`

- [ ] **Step 1: Write failing runtime-contract tests**

Create `tests/domain/contracts.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isCursorSample, isRenderFrame } from "../../src/domain/contracts";
import type { CursorSample, RenderFrame } from "../../src/domain/types";

const sample: CursorSample = {
  cursor: { x: -120.5, y: 40 },
  displays: [{ id: 7, bounds: { x: -1920, y: 0, width: 1920, height: 1080 } }],
  displayGeneration: 3,
  observedAtMs: 10_000,
  sequence: 5,
};

describe("runtime contracts", () => {
  it("accepts a finite negative-origin cursor sample", () => {
    expect(isCursorSample(sample)).toBe(true);
  });

  it("rejects NaN cursor coordinates and invalid display bounds", () => {
    expect(isCursorSample({ ...sample, cursor: { x: Number.NaN, y: 40 } })).toBe(false);
    expect(
      isCursorSample({
        ...sample,
        displays: [{ id: 7, bounds: { x: 0, y: 0, width: 0, height: 1080 } }],
      }),
    ).toBe(false);
  });

  it("accepts show and hide frames but rejects stale sequence shapes", () => {
    const show: RenderFrame = {
      kind: "show",
      sequence: 9,
      observedAtMs: 10_016,
      bounds: { x: 10, y: 20, width: 144, height: 96 },
      motion: "walk",
      facesRight: true,
      glyph: "한",
      phaseMs: 32,
    };
    const hide: RenderFrame = {
      kind: "hide",
      sequence: 10,
      observedAtMs: 10_032,
      reason: "stale-cursor",
    };

    expect(isRenderFrame(show)).toBe(true);
    expect(isRenderFrame(hide)).toBe(true);
    expect(isRenderFrame({ ...show, bounds: { ...show.bounds, width: -1 } })).toBe(false);
    expect(isRenderFrame({ ...show, sequence: -1 })).toBe(false);
  });
});
```

- [ ] **Step 2: Run the contract test to record RED**

Run:

```bash
npm test -- --run tests/domain/contracts.test.ts
```

Expected: FAIL with missing `src/domain/types` and `src/domain/contracts`
modules.

- [ ] **Step 3: Define exact shared values and guards**

Create `src/domain/types.ts` with these public contracts:

```ts
export const OVERLAY_SIZE = Object.freeze({ width: 144, height: 96 });
export const DISPLAY_MARGIN_DIP = 8;
export const STALE_CURSOR_MS = 250;
export const MAX_FRAME_STEPS = 4;
export const SAMPLE_INTERVAL_MS = 16;

export type Point = Readonly<{ x: number; y: number }>;
export type Size = Readonly<{ width: number; height: number }>;
export type Rect = Point & Size;
export type DisplaySnapshot = Readonly<{ id: number; bounds: Rect }>;
export type CursorSample = Readonly<{
  cursor: Point;
  displays: readonly DisplaySnapshot[];
  displayGeneration: number;
  observedAtMs: number;
  sequence: number;
}>;
export type MotionState = "idle" | "walk" | "run" | "turn";
export type LanguageGlyph = "hidden" | "A" | "한";
export type LanguageMode = "automatic" | LanguageGlyph;
export type MotionPolicy = "system" | "reduced";
export type PlatformName = "darwin" | "win32";
export type HideReason =
  | "disabled"
  | "waiting-renderer"
  | "stale-cursor"
  | "screen-unknown"
  | "topology-changed"
  | "overlay-unavailable"
  | "quitting";
export type AppSettings = Readonly<{
  enabled: boolean;
  languageMode: LanguageMode;
  followSpeedPercent: number;
  showOverFullScreen: boolean;
  launchAtLogin: boolean;
  motionPolicy: MotionPolicy;
}>;
export type RenderFrame =
  | Readonly<{
      kind: "hide";
      sequence: number;
      observedAtMs: number;
      reason: HideReason;
    }>
  | Readonly<{
      kind: "show";
      sequence: number;
      observedAtMs: number;
      bounds: Rect;
      motion: MotionState;
      facesRight: boolean;
      glyph: LanguageGlyph;
      phaseMs: number;
    }>;
```

Create `contracts.ts`. Every guard must reject non-finite values, negative
sequences, invalid display sizes, invalid enum values, and extra hide/show
fields that are meaningful to the opposite union member. The implementation
must not coerce strings to numbers.

- [ ] **Step 4: Verify GREEN and contract strictness**

Run:

```bash
npm run check
npm test -- --run tests/domain/contracts.test.ts
```

Expected: TypeScript exits 0 and all 3 contract tests pass.

- [ ] **Step 5: Commit the contracts**

```bash
git add src/domain/types.ts src/domain/contracts.ts tests/domain/contracts.test.ts
git commit -m "feat: define Followmeow domain contracts"
```

### Task 3: Implement display geometry and clamping

**Files:**
- Create: `src/domain/geometry.ts`
- Create: `tests/domain/geometry.test.ts`
- Test: `tests/domain/geometry.test.ts`

- [ ] **Step 1: Add failing geometry examples**

Create `tests/domain/geometry.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  clampOverlayOrigin,
  desiredOverlayOrigin,
  findContainingDisplay,
} from "../../src/domain/geometry";
import type { DisplaySnapshot } from "../../src/domain/types";

const left: DisplaySnapshot = {
  id: 2,
  bounds: { x: -1920, y: 0, width: 1920, height: 1080 },
};
const primary: DisplaySnapshot = {
  id: 1,
  bounds: { x: 0, y: 0, width: 1920, height: 1080 },
};

describe("display geometry", () => {
  it("finds a negative-origin display and preserves snapshot order at an edge", () => {
    expect(findContainingDisplay([left, primary], { x: -100, y: 500 })?.id).toBe(2);
    expect(findContainingDisplay([left, primary], { x: 0, y: 500 })?.id).toBe(2);
    expect(findContainingDisplay([primary], { x: 2000, y: 500 })).toBeNull();
  });

  it("places the leading edge 34 DIP behind a right-facing cursor", () => {
    expect(desiredOverlayOrigin({ x: 1000, y: 500 }, { x: 1, y: 0 })).toEqual({
      x: 822,
      y: 452,
    });
  });

  it("mirrors the follower position for a left-facing cursor", () => {
    expect(desiredOverlayOrigin({ x: 1000, y: 500 }, { x: -1, y: 0 })).toEqual({
      x: 1034,
      y: 452,
    });
  });

  it("clamps every edge within the display plus 8 DIP", () => {
    expect(
      clampOverlayOrigin(
        { x: -2000, y: -10 },
        left,
      ),
    ).toEqual({ x: -1912, y: 8 });
    expect(clampOverlayOrigin({ x: 1800, y: 1000 }, primary)).toEqual({
      x: 1768,
      y: 976,
    });
  });
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- --run tests/domain/geometry.test.ts
```

Expected: FAIL with missing `geometry` module.

- [ ] **Step 3: Implement the geometry functions**

`findContainingDisplay` treats display bounds as inclusive at both edges and
returns the first matching snapshot. `desiredOverlayOrigin` normalizes the
heading, uses `(0, 0)` as `(1, 0)`, computes the follower center
`cursor - heading * (34 + 144 / 2)`, and subtracts `(72, 48)`.
`clampOverlayOrigin` rejects a display smaller than `OVERLAY_SIZE + 2 *
DISPLAY_MARGIN_DIP` by returning `null` and otherwise clamps the entire window.

Use this signature so later tasks cannot silently diverge:

```ts
export function findContainingDisplay(
  displays: readonly DisplaySnapshot[],
  point: Point,
): DisplaySnapshot | null;

export function desiredOverlayOrigin(cursor: Point, heading: Point): Point;

export function clampOverlayOrigin(
  origin: Point,
  display: DisplaySnapshot,
): Point | null;
```

Add finite guards inside each function; do not let `Math` coercion convert
strings.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
npm run check
npm test -- --run tests/domain/geometry.test.ts
```

Expected: 4 geometry tests pass, including the shared-edge and negative-origin
cases.

- [ ] **Step 5: Commit geometry**

```bash
git add src/domain/geometry.ts tests/domain/geometry.test.ts
git commit -m "feat: add cursor follower geometry"
```

### Task 4: Implement the fail-closed visibility policy

**Files:**
- Create: `src/domain/policy.ts`
- Create: `tests/domain/policy.test.ts`
- Test: `tests/domain/policy.test.ts`

- [ ] **Step 1: Add failing policy decision tests**

Create `tests/domain/policy.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { evaluateVisibility } from "../../src/domain/policy";
import type { CursorSample } from "../../src/domain/types";

const current: CursorSample = {
  cursor: { x: 400, y: 300 },
  displays: [{ id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 } }],
  displayGeneration: 2,
  observedAtMs: 9_900,
  sequence: 3,
};
const ready = {
  enabled: true,
  overlayReady: true,
  quitting: false,
  nowMs: 10_000,
  previousDisplayGeneration: 2,
  sample: current,
};

describe("visibility policy", () => {
  it("shows only a valid, current, on-screen sample", () => {
    expect(evaluateVisibility(ready)).toEqual({ kind: "show", sample: current });
  });

  it.each([
    [{ enabled: false }, "disabled"],
    [{ overlayReady: false }, "waiting-renderer"],
    [{ quitting: true }, "quitting"],
    [{ nowMs: 10_151 }, "stale-cursor"],
    [{ sample: { ...current, cursor: { x: 4000, y: 300 } } }, "screen-unknown"],
    [{ previousDisplayGeneration: 1 }, "topology-changed"],
  ] as const)("hides for %o with %s", (change, reason) => {
    expect(evaluateVisibility({ ...ready, ...change })).toEqual({
      kind: "hide",
      reason,
    });
  });

  it("rejects malformed samples instead of reusing stale label state", () => {
    expect(
      evaluateVisibility({
        ...ready,
        sample: { ...current, cursor: { x: Number.NaN, y: 0 } },
      }),
    ).toEqual({ kind: "hide", reason: "screen-unknown" });
  });
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- --run tests/domain/policy.test.ts
```

Expected: FAIL with missing `policy` module.

- [ ] **Step 3: Implement the pure decision function**

Declare:

```ts
export type VisibilityPolicyInput = Readonly<{
  enabled: boolean;
  overlayReady: boolean;
  quitting: boolean;
  nowMs: number;
  previousDisplayGeneration: number | null;
  sample: unknown;
}>;

export type VisibilityDecision =
  | Readonly<{ kind: "hide"; reason: HideReason }>
  | Readonly<{ kind: "show"; sample: CursorSample }>;
```

The decision order must be:
`quitting`, `disabled`, `waiting-renderer`, runtime sample validation,
`sample.observedAtMs - nowMs` future or age over 250 ms, display generation
change when a previous generation exists, and on-screen containment. Return a
hide reason once; never carry a previous `RenderFrame` forward.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
npm run check
npm test -- --run tests/domain/policy.test.ts
```

Expected: all policy cases pass.

- [ ] **Step 5: Commit policy**

```bash
git add src/domain/policy.ts tests/domain/policy.test.ts
git commit -m "feat: add fail-closed overlay policy"
```

### Task 5: Implement spring following and the motion state machine

**Files:**
- Create: `src/domain/motion.ts`
- Create: `tests/domain/motion.test.ts`
- Test: `tests/domain/motion.test.ts`

- [ ] **Step 1: Add deterministic motion RED tests**

Create `tests/domain/motion.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  SpringFollower,
  TurnTracker,
  chooseMotionState,
} from "../../src/domain/motion";

describe("motion state", () => {
  it.each([
    [{ speed: 29.9, displacement: 2, lag: 1, stoppedMs: 0 }, "idle"],
    [{ speed: 30, displacement: 0, lag: 0, stoppedMs: 0 }, "walk"],
    [{ speed: 0, displacement: 3, lag: 0, stoppedMs: 0 }, "walk"],
    [{ speed: 650, displacement: 0, lag: 0, stoppedMs: 0 }, "run"],
    [{ speed: 0, displacement: 0, lag: 24, stoppedMs: 0 }, "run"],
  ] as const)("chooses %s as %s", (metrics, expected) => {
    expect(chooseMotionState("idle", metrics, false)).toBe(expected);
  });

  it("settles to idle only after 180 ms", () => {
    expect(chooseMotionState("run", { speed: 0, displacement: 0, lag: 0, stoppedMs: 179 }, false)).toBe("run");
    expect(chooseMotionState("run", { speed: 0, displacement: 0, lag: 0, stoppedMs: 180 }, false)).toBe("idle");
  });

  it("forces reduced motion to idle", () => {
    expect(chooseMotionState("run", { speed: 2_000, displacement: 200, lag: 100, stoppedMs: 0 }, true)).toBe("idle");
  });
});

describe("spring and turn", () => {
  it("converges in fixed steps without exceeding 1600 DIP/s", () => {
    const follower = new SpringFollower({ x: 0, y: 0 });
    let maximumSpeed = 0;
    for (let i = 0; i < 180; i += 1) {
      follower.step({ x: 100, y: 0 }, 1 / 60, 100);
      maximumSpeed = Math.max(maximumSpeed, Math.hypot(follower.velocity.x, follower.velocity.y));
    }
    expect(maximumSpeed).toBeLessThanOrEqual(1600);
    expect(follower.position.x).toBeCloseTo(100, 1);
  });

  it("holds a turn for 120 ms and prevents retrigger during the 160 ms lockout", () => {
    const turn = new TurnTracker();
    expect(turn.update(0, true, true, 0)).toBe(false);
    expect(turn.update(12, true, false, 1_000)).toBe(true);
    expect(turn.update(-12, false, false, 1_050)).toBe(true);
    expect(turn.update(-24, false, false, 1_120)).toBe(false);
    expect(turn.update(-36, false, false, 1_130)).toBe(false);
    expect(turn.update(24, false, true, 1_161)).toBe(true);
  });
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- --run tests/domain/motion.test.ts
```

Expected: FAIL with missing motion module.

- [ ] **Step 3: Implement fixed constants and minimal motion code**

Implement and export:

```ts
export type MotionMetrics = Readonly<{
  speed: number;
  displacement: number;
  lag: number;
  stoppedMs: number;
}>;

export class SpringFollower {
  public position: Point;
  public velocity: Point;
  constructor(initial: Point);
  reset(position: Point): void;
  step(target: Point, seconds: number, speedPercent: number): void;
}

export function chooseMotionState(
  previous: MotionState,
  metrics: MotionMetrics,
  reducedMotion: boolean,
): MotionState;

export class TurnTracker {
  activeAt(nowMs: number): boolean;
  update(
    horizontalDisplacement: number,
    previousFacesRight: boolean,
    facesRight: boolean,
    nowMs: number,
  ): boolean;
}
```

Use stiffness 110, damping 21, 1/60 fixed caller steps, and a 1,600 DIP/s speed
cap. Clamp `speedPercent` to 75-150 and non-finite values to 100. Use the exact
30/650 speed, 3/48 displacement, 24 lag, 180 settle, 120 turn-duration, 160
lockout thresholds from the specification. The turn method returns whether the
`turn` pose is active. It starts only when `previousFacesRight !== facesRight`
and the absolute displacement is at least 12 DIP. The active pose lasts 120 ms;
a direction reversal at 161 ms can start a new turn.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
npm run check
npm test -- --run tests/domain/motion.test.ts
```

Expected: the 9 motion assertions pass.

- [ ] **Step 5: Commit motion**

```bash
git add src/domain/motion.ts tests/domain/motion.test.ts
git commit -m "feat: add deterministic follower motion"
```

### Task 6: Validate and persist local settings atomically

**Files:**
- Create: `src/domain/settings.ts`
- Create: `src/main/settings-store.ts`
- Create: `tests/domain/settings.test.ts`
- Create: `tests/main/settings-store.test.ts`
- Test: `tests/domain/settings.test.ts`
- Test: `tests/main/settings-store.test.ts`

- [ ] **Step 1: Write settings validation RED tests**

Create `tests/domain/settings.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { decodeSettings, defaultSettings } from "../../src/domain/settings";

describe("settings", () => {
  it("uses platform-specific full-screen defaults", () => {
    expect(defaultSettings("darwin").showOverFullScreen).toBe(true);
    expect(defaultSettings("win32").showOverFullScreen).toBe(false);
    expect(defaultSettings("darwin").languageMode).toBe("automatic");
  });

  it("validates each known key independently", () => {
    const result = decodeSettings(
      {
        enabled: false,
        languageMode: "한",
        followSpeedPercent: 126,
        showOverFullScreen: "yes",
        launchAtLogin: true,
        motionPolicy: "fancy",
        unexpected: 1,
      },
      "darwin",
    );

    expect(result.settings).toEqual({
      ...defaultSettings("darwin"),
      enabled: false,
      languageMode: "한",
      followSpeedPercent: 126,
      launchAtLogin: true,
    });
    expect(result.warnings).toEqual([
      "unknown-key:unexpected",
      "invalid-key:showOverFullScreen",
      "invalid-key:motionPolicy",
    ]);
  });

  it("accepts only integer speed values from 75 through 150", () => {
    expect(decodeSettings({ followSpeedPercent: 74.9 }, "win32").settings.followSpeedPercent).toBe(100);
    expect(decodeSettings({ followSpeedPercent: 151 }, "win32").settings.followSpeedPercent).toBe(100);
    expect(decodeSettings({ followSpeedPercent: 125 }, "win32").settings.followSpeedPercent).toBe(125);
    expect(decodeSettings({ languageMode: "guess" }, "darwin").settings.languageMode).toBe("automatic");
  });
});
```

Create `tests/main/settings-store.test.ts` with an in-memory adapter:

```ts
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { SettingsStore } from "../../src/main/settings-store";
import { defaultSettings } from "../../src/domain/settings";

describe("settings store", () => {
  it("round-trips a valid change with an atomic rename", async () => {
    const directory = await mkdtemp(join(tmpdir(), "followmeow-settings-"));
    const store = new SettingsStore(join(directory, "settings.json"), "darwin");
    await store.load();
    await store.save({ ...store.value, enabled: false, languageMode: "A" });

    const saved = JSON.parse(await readFile(join(directory, "settings.json"), "utf8"));
    expect(saved.enabled).toBe(false);
    expect(saved.languageMode).toBe("A");
  });

  it("backs up malformed JSON once and loads defaults", async () => {
    const directory = await mkdtemp(join(tmpdir(), "followmeow-settings-"));
    const path = join(directory, "settings.json");
    await writeFile(path, "{broken", "utf8");
    const store = new SettingsStore(path, "win32");
    const warnings = await store.load();

    expect(store.value).toEqual(defaultSettings("win32"));
    expect(warnings).toContain("invalid-json");
    expect(await readFile(join(directory, "settings.invalid.json"), "utf8")).toBe("{broken");
  });
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- --run tests/domain/settings.test.ts tests/main/settings-store.test.ts
```

Expected: FAIL with both missing modules.

- [ ] **Step 3: Implement validation and persistence**

`defaultSettings(platform)` returns exactly the six keys in `AppSettings`.
`decodeSettings(unknown, platform)` never throws for values; it returns
`{ settings, warnings }`. Warnings have only the three stable forms
`unknown-key:<name>`, `invalid-key:<name>`, or `invalid-json`.

`SettingsStore` exposes:

```ts
class SettingsStore {
  readonly path: string;
  readonly value: AppSettings;
  constructor(path: string, platform: PlatformName);
  load(): Promise<string[]>;
  save(next: AppSettings): Promise<void>;
}
```

`save` validates by passing the complete candidate through `decodeSettings` and
must reject any warning. It writes `settings.tmp` with mode `0o600`, fsyncs the
file, renames it over `settings.json`, and changes `value` only after rename
succeeds. The malformed-load backup uses `copyFile` and never overwrites an
existing `settings.invalid.json`.

- [ ] **Step 4: Verify GREEN, including save failure**

Run:

```bash
npm run check
npm test -- --run tests/domain/settings.test.ts tests/main/settings-store.test.ts
```

Expected: 5 settings tests pass. Add one test that makes the target directory
read-only on POSIX and asserts `store.value` is unchanged after a rejected
`save`; skip the permission assertion on Windows only with
`it.skipIf(process.platform === "win32")`.

- [ ] **Step 5: Commit settings**

```bash
git add src/domain/settings.ts src/main/settings-store.ts tests/domain/settings.test.ts tests/main/settings-store.test.ts
git commit -m "feat: add validated local settings"
```

### Task 7: Import and normalize the approved cat artwork

**Files:**
- Copy: `artwork/source/cat-poses.svg`
- Copy: `artwork/source/05-turn.svg`
- Copy: `artwork/visual-spec.md`
- Create: `artwork/source-manifest.json`
- Create: `scripts/normalize-cat-art.mjs`
- Create: `src/renderer/assets/cat-idle.svg`
- Create: `src/renderer/assets/cat-walk-1.svg`
- Create: `src/renderer/assets/cat-walk-2.svg`
- Create: `src/renderer/assets/cat-run-1.svg`
- Create: `src/renderer/assets/cat-run-2.svg`
- Create: `src/renderer/assets/cat-turn.svg`
- Create: `tests/artwork.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Copy approved source bytes and write the failing asset test**

Run:

```bash
mkdir -p artwork/source
cp '/Users/subeomlee/.copilot/session-state/9825e0bd-8139-47fe-b559-07f6b89986e4/files/cat-art/cat-poses.svg' artwork/source/cat-poses.svg
cp '/Users/subeomlee/.copilot/session-state/9825e0bd-8139-47fe-b559-07f6b89986e4/files/cat-art/05-turn.svg' artwork/source/05-turn.svg
cp '/Users/subeomlee/.copilot/session-state/9825e0bd-8139-47fe-b559-07f6b89986e4/files/cat-art/visual-spec.md' artwork/visual-spec.md
sha256sum artwork/source/cat-poses.svg artwork/source/05-turn.svg artwork/visual-spec.md
```

Record the three printed lowercase hashes in `artwork/source-manifest.json`
with keys `catPosesSha256`, `turnSha256`, and `visualSpecSha256`. Add this test
before runtime assets exist:

```ts
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
  it("preserves source input hashes", () => {
    const manifest = JSON.parse(readFileSync("artwork/source-manifest.json", "utf8"));
    const digest = (path: string) =>
      createHash("sha256").update(readFileSync(path)).digest("hex");
    expect(digest("artwork/source/cat-poses.svg")).toBe(manifest.catPosesSha256);
    expect(digest("artwork/source/05-turn.svg")).toBe(manifest.turnSha256);
    expect(digest("artwork/visual-spec.md")).toBe(manifest.visualSpecSha256);
  });

  it("ships six self-contained, local-only pose files", () => {
    for (const name of assets) {
      const svg = readFileSync(`src/renderer/assets/${name}`, "utf8");
      expect(svg).toMatch(/<svg[^>]+viewBox=/);
      expect(svg).not.toMatch(/https?:|data:/i);
      expect(svg).not.toMatch(/Octocat|GitHub/i);
      expect(svg).toContain("<path");
    }
  });
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- --run tests/artwork.test.ts
```

Expected: FAIL because the normalized six runtime assets do not exist.

- [ ] **Step 3: Normalize the approved source without changing its geometry**

Create `scripts/normalize-cat-art.mjs`. The script must parse
`artwork/source/cat-poses.svg`, resolve the approved `sit`, `walk-reach`,
`walk-pass`, `run-air`, and `run-land` definitions, and wrap each with the
shared approved definitions in a standalone transparent SVG. It extracts the
hero pose from `artwork/source/05-turn.svg`, removes only its embedded A marker
and review scene wrapper, and writes it as `cat-turn.svg`. It rejects external
`<image>` or remote `href` references. Both source files are immutable; the
normalizer exits non-zero if a required source group is absent and never edits
either source plate, so all three source hashes remain stable. Add
`art:normalize` to `package.json`:

```json
{
  "scripts": {
    "art:normalize": "node scripts/normalize-cat-art.mjs"
  }
}
```

Run:

```bash
npm run art:normalize
npm test -- --run tests/artwork.test.ts
```

- [ ] **Step 4: Verify GREEN and source fidelity**

Run:

```bash
npm test -- --run tests/artwork.test.ts
git diff --check
```

Expected: 2 artwork tests pass, and the source files' hashes still equal the
manifest. Runtime files have no remote reference or GitHub/Octocat marker.

- [ ] **Step 5: Commit the approved art**

```bash
git add artwork scripts/normalize-cat-art.mjs src/renderer/assets package.json tests/artwork.test.ts
git commit -m "feat: import original Followmeow cat artwork"
```

### Task 8: Build the secure renderer and preload bridge

**Files:**
- Create: `src/preload/index.ts`
- Create: `src/renderer/index.html`
- Create: `src/renderer/index.css`
- Create: `src/renderer/view-model.ts`
- Create: `src/renderer/index.ts`
- Create: `scripts/bundle-runtime.mjs`
- Create: `tests/renderer/view-model.test.ts`
- Create: `tests/renderer/security.test.ts`
- Create: `tests/runtime/bootstrap.test.ts`
- Test: `tests/renderer/view-model.test.ts`
- Test: `tests/renderer/security.test.ts`

- [ ] **Step 1: Write pure view-model and CSP RED tests**

Create `tests/renderer/view-model.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { toViewModel } from "../../src/renderer/view-model";
import type { RenderFrame } from "../../src/domain/types";

describe("renderer view model", () => {
  it.each([
    ["idle", "./assets/cat-idle.svg"],
    ["walk", "./assets/cat-walk-1.svg"],
    ["run", "./assets/cat-run-1.svg"],
    ["turn", "./assets/cat-turn.svg"],
  ] as const)("maps %s to %s", (motion, asset) => {
    const model = toViewModel({
      kind: "show",
      sequence: 1,
      observedAtMs: 1,
      bounds: { x: 2, y: 3, width: 144, height: 96 },
      motion,
      facesRight: true,
      glyph: "A",
      phaseMs: 0,
    });
    expect(model.asset).toBe(asset);
    expect(model.glyph).toBe("A");
    expect(model.scaleX).toBe(1);
  });

  it("alternates walk/run assets, mirrors left, and clears hidden frames", () => {
    const base: RenderFrame = {
      kind: "show",
      sequence: 2,
      observedAtMs: 2,
      bounds: { x: 2, y: 3, width: 144, height: 96 },
      motion: "walk",
      facesRight: false,
      glyph: "hidden",
      phaseMs: 400,
    };
    expect(toViewModel(base)).toMatchObject({
      asset: "./assets/cat-walk-2.svg",
      glyph: "",
      scaleX: -1,
    });
    expect(toViewModel({ kind: "hide", sequence: 3, observedAtMs: 3, reason: "stale-cursor" })).toEqual({
      visible: false,
      asset: "./assets/cat-idle.svg",
      glyph: "",
      scaleX: 1,
    });
  });
});
```

Create `tests/renderer/security.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("renderer security", () => {
  it("has no inline script, no remote content, and denies connect", () => {
    const html = readFileSync("src/renderer/index.html", "utf8");
    expect(html).toContain("connect-src 'none'");
    expect(html).toContain("script-src 'self'");
    expect(html).not.toMatch(/<script(?![^>]+src=)/i);
    expect(html).not.toMatch(/https?:\/\//);
  });
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- --run tests/renderer/view-model.test.ts tests/renderer/security.test.ts
```

Expected: FAIL with missing renderer files.

- [ ] **Step 3: Implement only the typed bridge and frame application**

In `src/preload/index.ts`, expose only:

```ts
type FollowmeowBridge = Readonly<{
  ready: () => void;
  onFrame: (listener: (frame: RenderFrame) => void) => () => void;
}>;
```

The preload implementation validates every received payload with
`isRenderFrame`, exposes exactly the `followmeow` property through
`contextBridge`, subscribes to `followmeow:frame`, and sends
`followmeow:renderer-ready`. It never exposes `ipcRenderer.send`/`invoke`.

In `index.html`, include the full CSP from the specification, use external
`index.css` and `index.bundle.js`, and create:

```html
<main id="followmeow-canvas" data-visible="false" aria-hidden="true">
  <img id="followmeow-cat" alt="" draggable="false" />
  <span id="followmeow-glyph"></span>
</main>
```

`index.css` fixes the body to 144 x 96, makes the page transparent, disables
pointer events, and has no movement when `prefers-reduced-motion: reduce`.
`view-model.ts` chooses pose assets from `motion` and `phaseMs` (alternate
walk/run every 250 ms), maps `hidden` to an empty glyph, and maps `facesRight`
to `scaleX` 1 or -1. `index.ts` calls `ready`, maintains a monotonically
increasing `sequence`, discards duplicate and older frames, and clears
image/glyph on hide. Add `scripts/bundle-runtime.mjs`: bundle the renderer as a
browser IIFE and the preload as self-contained CommonJS with Electron external.
`tests/runtime/bootstrap.test.ts` executes both package outputs and asserts
ready plus the first valid frame.

- [ ] **Step 4: Verify GREEN and renderer type safety**

Run:

```bash
npm run check
npm test -- --run tests/renderer/view-model.test.ts tests/renderer/security.test.ts
npm run test:runtime
```

Expected: 6 renderer/security assertions pass. `npm run check` proves the
preload bridge and DOM types compile.

- [ ] **Step 5: Commit renderer**

```bash
git add src/preload src/renderer tests/renderer
git commit -m "feat: add isolated Followmeow renderer"
```

### Task 9: Implement cursor polling and display lifecycle

**Files:**
- Create: `src/main/cursor-sampler.ts`
- Create: `tests/main/cursor-sampler.test.ts`
- Test: `tests/main/cursor-sampler.test.ts`

- [ ] **Step 1: Write sampler RED tests with fake timers**

Create `tests/main/cursor-sampler.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CursorSampler } from "../../src/main/cursor-sampler";

describe("cursor sampler", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("polls at 16 ms, stamps monotonic time, and increments sequence", () => {
    const samples: unknown[] = [];
    const invalid = vi.fn();
    const sampler = new CursorSampler(
      {
        cursor: () => ({ x: 100, y: 200 }),
        displays: () => [{ id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 } }],
        now: () => 1234,
      },
      (sample) => samples.push(sample),
      invalid,
    );

    sampler.start();
    vi.advanceTimersByTime(32);
    expect(samples).toHaveLength(3);
    expect(samples.map((value: any) => value.sequence)).toEqual([1, 2, 3]);
    expect(samples[0]).toMatchObject({ observedAtMs: 1234, displayGeneration: 0 });
    expect(invalid).not.toHaveBeenCalled();
  });

  it("invalidates immediately on a thrown screen read and hides stale state", () => {
    const invalid = vi.fn();
    const sampler = new CursorSampler(
      {
        cursor: () => {
          throw new Error("screen unavailable");
        },
        displays: () => [],
        now: () => 500,
      },
      vi.fn(),
      invalid,
    );

    sampler.start();
    vi.advanceTimersByTime(16);
    expect(invalid).toHaveBeenCalledWith("screen-unknown");
    sampler.stop();
  });
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- --run tests/main/cursor-sampler.test.ts
```

Expected: FAIL with missing sampler module.

- [ ] **Step 3: Implement dependency-injected sampling**

Implement:

```ts
export interface CursorSource {
  cursor(): Point;
  displays(): readonly DisplaySnapshot[];
  now(): number;
}

export class CursorSampler {
  constructor(
    source: CursorSource,
    onSample: (sample: CursorSample) => void,
    onInvalid: (reason: "screen-unknown" | "stale-cursor") => void,
  );
  noteDisplayChange(): void;
  start(): void;
  stop(): void;
}
```

`start` is idempotent and schedules `setInterval(..., 16)` after one immediate
tick. It wraps source reads in a narrow `catch` only to map thrown cursor/screen
errors to `screen-unknown`; it rethrows programming errors in callback code
outside the source-read catch. `noteDisplayChange` increments
`displayGeneration` and does not retain the old sample. `stop` clears the timer.

- [ ] **Step 4: Verify GREEN and timer cleanup**

Run:

```bash
npm run check
npm test -- --run tests/main/cursor-sampler.test.ts
```

Expected: both sampler tests pass and `vi.getTimerCount()` is 0 after `stop`.

- [ ] **Step 5: Commit sampler**

```bash
git add src/main/cursor-sampler.ts tests/main/cursor-sampler.test.ts
git commit -m "feat: poll cursor and display state"
```

### Task 10: Compose policy, spring, geometry, and frame sequencing

**Files:**
- Create: `src/main/follow-controller.ts`
- Create: `tests/main/follow-controller.test.ts`
- Test: `tests/main/follow-controller.test.ts`

- [ ] **Step 1: Write end-to-end controller RED tests**

Create `tests/main/follow-controller.test.ts` with these fixed assertions:

```ts
import { describe, expect, it } from "vitest";
import { FollowController } from "../../src/main/follow-controller";
import { defaultSettings } from "../../src/domain/settings";
import type { CursorSample } from "../../src/domain/types";

const sample = (sequence: number, x: number, now: number): CursorSample => ({
  cursor: { x, y: 400 },
  displays: [{ id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 } }],
  displayGeneration: 0,
  observedAtMs: now,
  sequence,
});

describe("follow controller", () => {
  it("emits ordered show frames and an accepted torso glyph", () => {
    const frames: unknown[] = [];
    const controller = new FollowController(
      { ...defaultSettings("darwin"), languageMode: "한" },
      false,
      (frame) => frames.push(frame),
    );
    controller.rendererReady();
    controller.tick(sample(1, 500, 1_000), 1_000);
    controller.tick(sample(2, 505, 1_016), 1_016);

    expect(frames.at(-1)).toMatchObject({
      kind: "show",
      sequence: 2,
      glyph: "한",
      motion: "walk",
    });
  });

  it("hides on stale samples and does not preserve the previous glyph", () => {
    const frames: any[] = [];
    const controller = new FollowController(
      { ...defaultSettings("win32"), languageMode: "A" },
      false,
      (frame) => frames.push(frame),
    );
    controller.rendererReady();
    controller.tick(sample(1, 500, 1_000), 1_000);
    controller.tick(sample(2, 501, 1_001), 1_300);

    expect(frames.at(-1)).toEqual({
      kind: "hide",
      sequence: 2,
      observedAtMs: 1_300,
      reason: "stale-cursor",
    });
  });

  it("resets rather than animating across display generations", () => {
    const frames: any[] = [];
    const controller = new FollowController(defaultSettings("darwin"), false, (frame) => frames.push(frame));
    controller.rendererReady();
    controller.tick(sample(1, 500, 1_000), 1_000);
    const changed = {
      ...sample(2, 2_200, 1_016),
      displays: [
        { id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
        { id: 2, bounds: { x: 1920, y: 0, width: 1920, height: 1080 } },
      ],
      displayGeneration: 1,
    };
    controller.tick(changed, 1_016);
    controller.tick(changed, 1_016);

    expect(frames[1]).toMatchObject({ kind: "hide", reason: "topology-changed" });
    expect(frames[2].bounds.x).toBeGreaterThanOrEqual(1_928);
    expect(frames[2]).toMatchObject({ kind: "show" });
  });
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- --run tests/main/follow-controller.test.ts
```

Expected: FAIL with missing controller module.

- [ ] **Step 3: Implement the controller with injected emission**

Constructor:

```ts
export class FollowController {
  constructor(
    settings: AppSettings,
    reducedMotion: boolean,
    emit: (frame: RenderFrame) => void,
  );
  rendererReady(): void;
  setSettings(settings: AppSettings): void;
  setReducedMotion(reduced: boolean): void;
  invalidate(reason: HideReason, nowMs: number): void;
  tick(sample: unknown, nowMs: number): void;
  quit(nowMs: number): void;
}
```

The controller keeps no DOM/Electron dependency. A valid sample passes through
`evaluateVisibility`, `findContainingDisplay`, desired target, spring, clamp,
and motion state. It consumes at most `MAX_FRAME_STEPS` fixed steps, resets on a
display-generation, stale-cursor, or screen-unknown discontinuity, and emits
exactly one ordered frame per `tick` from a controller-owned output sequence.
A 12 DIP accumulated opposite-direction candidate commits facing and heading.
Zero horizontal delta preserves pending progress; movement toward committed
heading subtracts from it; alternating sub-threshold jitter preserves the
current facing, including while a turn is active. A manually hidden glyph and
a hide frame never preserve prior glyph or bounds data.
`FollowController.setAutomaticLanguage` is added in Task 13; before that task,
automatic mode resolves to `hidden`, while manual modes resolve immediately.

- [ ] **Step 4: Verify GREEN and repeated invariants**

Run:

```bash
npm run check
npm test -- --run tests/main/follow-controller.test.ts
npm test
```

Expected: all 3 controller tests and all previous domain/integration tests
pass. Add a repeated 1,000-sample property-style test inside the same file:
every show-frame bounds remain finite, every sequence increases, and every hide
frame has no `glyph` property.

- [ ] **Step 5: Commit controller**

```bash
git add src/main/follow-controller.ts tests/main/follow-controller.test.ts
git commit -m "feat: compose Followmeow follow controller"
```

### Task 11: Create the transparent click-through overlay

**Files:**
- Create: `src/main/overlay-window.ts`
- Create: `tests/main/overlay-window.test.ts`
- Test: `tests/main/overlay-window.test.ts`
- Modify: `scripts/copy-static.mjs`

- [ ] **Step 1: Add overlay security and bounds RED tests**

Create `tests/main/overlay-window.test.ts` with a fake factory:

```ts
import { describe, expect, it, vi } from "vitest";
import {
  OVERLAY_BROWSER_WINDOW_OPTIONS,
  OverlayWindow,
} from "../../src/main/overlay-window";

describe("overlay window", () => {
  it("locks the BrowserWindow to the approved transparent overlay shape", () => {
    expect(OVERLAY_BROWSER_WINDOW_OPTIONS).toMatchObject({
      width: 144,
      height: 96,
      transparent: true,
      frame: false,
      resizable: false,
      movable: false,
      fullscreenable: false,
      focusable: false,
      skipTaskbar: true,
      webPreferences: {
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        webSecurity: true,
      },
    });
  });

  it("makes the page click-through and applies a show/hide frame", () => {
    const window = {
      loadFile: vi.fn().mockResolvedValue(undefined),
      setIgnoreMouseEvents: vi.fn(),
      setAlwaysOnTop: vi.fn(),
      setVisibleOnAllWorkspaces: vi.fn(),
      setContentProtection: vi.fn(),
      setBounds: vi.fn(),
      showInactive: vi.fn(),
      hide: vi.fn(),
      isDestroyed: () => false,
      webContents: { send: vi.fn(), setWindowOpenHandler: vi.fn(), on: vi.fn() },
      on: vi.fn(),
    };
    const overlay = new OverlayWindow(() => window as never, "/app/dist/renderer/index.html");

    overlay.ready();
    overlay.apply({
      kind: "show",
      sequence: 1,
      observedAtMs: 1,
      bounds: { x: -1912, y: 8, width: 144, height: 96 },
      motion: "idle",
      facesRight: true,
      glyph: "hidden",
      phaseMs: 0,
    });
    overlay.apply({ kind: "hide", sequence: 2, observedAtMs: 2, reason: "stale-cursor" });

    expect(window.setIgnoreMouseEvents).toHaveBeenCalledWith(true);
    expect(window.setBounds).toHaveBeenCalledWith({ x: -1912, y: 8, width: 144, height: 96 });
    expect(window.showInactive).toHaveBeenCalledOnce();
    expect(window.hide).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- --run tests/main/overlay-window.test.ts
```

Expected: FAIL with missing overlay module.

- [ ] **Step 3: Implement overlay lifecycle and static copy**

`OverlayWindow` exports `OVERLAY_BROWSER_WINDOW_OPTIONS` and:

```ts
class OverlayWindow {
  constructor(
    factory: (options: BrowserWindowConstructorOptions) => BrowserWindow,
    rendererPath: string,
    onReady?: () => void,
  );
  ready(): void;
  apply(frame: RenderFrame): void;
  destroy(): void;
}
```

The constructor creates one window, rejects `will-navigate`, blocks all
`window.open`, denies all session permission requests, calls
`loadFile(rendererPath)`, and sets ignore-mouse, always-on-top, content
protection, and all-workspaces options. `apply(show)` validates the frame, sets
integer bounds, sends it to the renderer, and calls `showInactive`. `apply(hide)`
sends the hide frame before calling `hide`.

`scripts/copy-static.mjs` creates `dist/renderer` without deleting it, copies
`src/renderer/index.html`, `index.css`, and `assets`, and preserves the
`dist/renderer/index.js` emitted by TypeScript. Legal files are deliberately
added by Task 16 after they exist; this task must not make their absence silent.

- [ ] **Step 4: Verify GREEN and clean static build**

Run:

```bash
npm run check
npm test -- --run tests/main/overlay-window.test.ts
npm run build
test -f dist/renderer/index.html
test -f dist/renderer/assets/cat-idle.svg
```

Expected: 2 overlay tests pass and both build files exist.

- [ ] **Step 5: Commit overlay**

```bash
git add src/main/overlay-window.ts tests/main/overlay-window.test.ts scripts/copy-static.mjs
git commit -m "feat: add secure click-through cat overlay"
```

### Task 12: Implement the tray menu, app composition, and launch-at-login

**Files:**
- Create: `src/main/tray.ts`
- Create: `src/main/index.ts`
- Create: `tests/main/tray.test.ts`
- Create: `tests/main/lifecycle.test.ts`
- Test: `tests/main/tray.test.ts`
- Test: `tests/main/lifecycle.test.ts`

- [ ] **Step 1: Add tray-model and lifecycle RED tests**

Create `tests/main/tray.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildTrayMenuModel } from "../../src/main/tray";
import { defaultSettings } from "../../src/domain/settings";

describe("tray model", () => {
  it("has stable menu order and selected radio values", () => {
    const menu = buildTrayMenuModel("0.1.0", {
      ...defaultSettings("darwin"),
      languageMode: "한",
      followSpeedPercent: 125,
      motionPolicy: "reduced",
    });

    expect(menu.map((item) => item.label)).toEqual([
      "Followmeow 0.1.0",
      "Enable Followmeow",
      "separator",
      "Torso label",
      "Follow speed",
      "Reduce motion",
      "Show over full screen",
      "Launch at login",
      "separator",
      "About Followmeow",
      "Quit",
    ]);
    expect(menu.find((item) => item.label === "Torso label")?.items?.map((item) => item.label)).toEqual([
      "Automatic",
      "Hidden",
      "A",
      "한",
    ]);
    expect(menu.find((item) => item.label === "Torso label")?.items?.find((item) => item.label === "Automatic")?.checked).toBe(false);
    expect(menu.find((item) => item.label === "Torso label")?.items?.find((item) => item.label === "한")?.checked).toBe(true);
    expect(menu.find((item) => item.label === "Follow speed")?.items?.find((item) => item.label === "Playful (125%)")?.checked).toBe(true);
  });
});
```

Create `tests/main/lifecycle.test.ts` with fakes for sampler, controller, tray,
overlay, and quit. The assertions must prove:

1. `enabled: true` starts one sampler after renderer-ready;
2. disabling calls sampler `stop`, emits a `disabled` hide, and saves the new
   settings before tray rebuild;
3. quitting calls controller `quit`, sampler `stop`, overlay `destroy`, and tray
   `destroy` in that order;
4. a rejected settings save leaves the in-memory setting and menu check state
   unchanged.

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- --run tests/main/tray.test.ts tests/main/lifecycle.test.ts
```

Expected: FAIL with missing tray and lifecycle modules.

- [ ] **Step 3: Implement stable menu actions and composition**

Define a serializable menu model and action union:

```ts
export type TrayAction =
  | { type: "toggle-enabled"; value: boolean }
  | { type: "set-language"; value: LanguageMode }
  | { type: "set-speed"; value: 75 | 100 | 125 | 150 }
  | { type: "set-reduced-motion"; value: boolean }
  | { type: "set-full-screen"; value: boolean }
  | { type: "set-launch-at-login"; value: boolean }
  | { type: "about" }
  | { type: "quit" };

export function buildTrayMenuModel(
  version: string,
  settings: AppSettings,
  platform: PlatformName,
): TrayMenuEntry[];
```

Every Electron `MenuItemConstructorOptions.click` maps to exactly one
`TrayAction`; no inline callback reads settings from another source. Ordinary
settings are persisted before menu re-render. Launch-at-login uses a reversible
transaction: call `app.setLoginItemSettings` first; save the setting only after
that succeeds; if saving then fails, restore the previous native login-item
value before reporting failure. On every failure, the handler preserves the
prior in-memory setting and sets a tray tooltip with a sanitized error, never
the user-data path.

Serialize the complete read-modify-save/apply operation through a lifecycle
queue. Re-read `store.value` at transaction execution time, and recheck
`quitting` after every awaited operation so no controller, overlay, or tray
method is called after destruction. The Windows menu omits `Show over full
screen`; the macOS menu retains it.

`index.ts` must:

1. call `app.setAppUserModelId("com.subeom.Followmeow")` on Windows;
2. hide the macOS Dock with `app.dock?.hide()`;
3. load `SettingsStore`;
4. determine reduced motion through
   `systemPreferences.getAnimationSettings().shouldRenderRichAnimation`;
5. create overlay and tray;
6. create `CursorSampler` with `screen.getCursorScreenPoint()` and
   `screen.getAllDisplays()`;
7. increment sampler display generation on `display-added`,
   `display-removed`, and `display-metrics-changed`;
8. listen for `followmeow:renderer-ready` through `ipcMain` and start sampling
   only after the overlay calls `ready()` and `enabled === true`;
9. stop and destroy everything in the reverse initialization order;
10. exit on a missing native tray with code 1 and a sanitized `tray-unavailable`
    local log.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
npm run check
npm test -- --run tests/main/tray.test.ts tests/main/lifecycle.test.ts
```

Expected: the stable menu test and all 4 lifecycle assertions pass.

- [ ] **Step 5: Add launch-at-login tests and commit**

Mock `app.setLoginItemSettings` in the lifecycle test. Assert enabling writes
`{ openAtLogin: true }`, disabling writes false, and a thrown native call does
not change the persisted setting. Then run:

```bash
npm test
git add src/main/tray.ts src/main/index.ts tests/main/tray.test.ts tests/main/lifecycle.test.ts
git commit -m "feat: add Followmeow tray lifecycle"
```

### Task 13: Implement safe automatic A/한 providers

**Files:**
- Create: `src/domain/language.ts`
- Create: `src/main/language-provider.ts`
- Create: `resources/win-input-language.ps1`
- Modify: `src/main/follow-controller.ts`
- Modify: `src/main/index.ts`
- Modify: `src/main/tray.ts`
- Create: `tests/domain/language.test.ts`
- Create: `tests/main/language-provider.test.ts`
- Test: `tests/domain/language.test.ts`
- Test: `tests/main/language-provider.test.ts`

- [ ] **Step 1: Write failing classifier and manual-override tests**

Create `tests/domain/language.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  classifyMacLayout,
  parseMacLayout,
  parseWindowsLayout,
  resolveLanguage,
} from "../../src/domain/language";

describe("language output parsing", () => {
  it("parses only one macOS layout identifier line", () => {
    expect(parseMacLayout("com.apple.keylayout.2SetHangul\n")).toBe("com.apple.keylayout.2SetHangul");
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
    expect(resolveLanguage("automatic", { glyph: "hidden", observedAtMs: 5_500 }, 5_600)).toBe("hidden");
  });

  it.each(["hidden", "A", "한"] as const)("manual %s always wins", (mode) => {
    expect(resolveLanguage(mode, korean, 50_000)).toBe(mode);
  });
});
```

- [ ] **Step 2: Add failing process, timeout, and backoff tests**

Create `tests/main/language-provider.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "../../src/main/language-provider";

describe("language provider", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("invokes macOS defaults directly with no shell", async () => {
    const runner = vi.fn().mockResolvedValue({
      exitCode: 0,
      stdout: "com.apple.keylayout.2SetHangul\n",
      stderr: "",
      timedOut: false,
    });
    const provider = new LanguageProvider("darwin", runner, vi.fn(), vi.fn());

    await provider.poll();

    expect(runner).toHaveBeenCalledWith(
      "/usr/bin/defaults",
      ["read", "com.apple.HIToolbox", "AppleCurrentKeyboardLayoutInputSourceID"],
      1_500,
    );
  });

  it("backs off after a non-zero exit and resets after recovery", async () => {
    const runner = vi
      .fn()
      .mockResolvedValueOnce({ exitCode: 1, stdout: "", stderr: "failed", timedOut: false })
      .mockResolvedValue({ exitCode: 0, stdout: "com.apple.keylayout.ABC\n", stderr: "", timedOut: false });
    const onState = vi.fn();
    const onError = vi.fn();
    const provider = new LanguageProvider("darwin", runner, onState, onError);

    await provider.start();
    expect(runner).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(999);
    expect(runner).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(runner).toHaveBeenCalledTimes(2);
    expect(onState).toHaveBeenLastCalledWith({ glyph: "A", observedAtMs: expect.any(Number) });
    await vi.advanceTimersByTimeAsync(999);
    expect(runner).toHaveBeenCalledTimes(3);
  });

  it("hides on malformed output and timeout without a tight retry", async () => {
    const runner = vi.fn()
      .mockResolvedValueOnce({ exitCode: 0, stdout: "bad", stderr: "", timedOut: false })
      .mockResolvedValueOnce({ exitCode: null, stdout: "", stderr: "", timedOut: true });
    const onState = vi.fn();
    const onError = vi.fn();
    const provider = new LanguageProvider("win32", runner, onState, onError);

    await provider.poll();
    await provider.poll();

    expect(onState).toHaveBeenLastCalledWith({ glyph: "hidden", observedAtMs: expect.any(Number) });
    expect(onError).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 3: Verify RED**

Run:

```bash
npm test -- --run tests/domain/language.test.ts tests/main/language-provider.test.ts
```

Expected: FAIL with missing `language` and `language-provider` modules.

- [ ] **Step 4: Implement exact parsers and freshness resolver**

Create `src/domain/language.ts` with:

```ts
export type LanguageObservation = Readonly<{
  glyph: LanguageGlyph;
  observedAtMs: number;
}>;

export function parseMacLayout(stdout: string): string | null;
export function classifyMacLayout(identifier: string): LanguageGlyph;
export function parseWindowsLayout(stdout: string): LanguageGlyph;
export function resolveLanguage(
  mode: LanguageMode,
  observation: LanguageObservation | null,
  nowMs: number,
): LanguageGlyph;
```

`parseMacLayout` accepts exactly one trimmed, non-empty line and a maximum of
256 bytes. Korean classification is an explicit case-insensitive allowlist for
identifiers containing `2SetHangul`, `Hangul`, or `.Korean.`. Latin is an
explicit allowlist of `ABC`, `US`, `USInternational-PC`, `British`,
`Australian`, `Canadian`, `Colemak`, and `Dvorak` variants under
`com.apple.keylayout`. Everything else is `hidden`.

`parseWindowsLayout` accepts only a JSON object with `layoutId` matching four
hexadecimal digits and a Boolean `imeOpen`. Language ID `0412` returns `한`
only when open and `A` when closed. Approved full English LCIDs (US `0409`,
UK `0809`, Australia `0C09`, Canada `1009`, New Zealand `1409`, and the
explicit remaining English-region list) return `A`; every other full LCID,
including Thai `041E`, Spanish `0C0A`, Chinese, and malformed values, returns
`hidden`.
`resolveLanguage` accepts automatic observations only when `nowMs -
observedAtMs <= 3000`; manual mode always wins.

- [ ] **Step 5: Add the exact Windows read-only script**

Create `resources/win-input-language.ps1`:

```powershell
Set-StrictMode -Version 3.0
$ErrorActionPreference = "Stop"

Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class FollowmeowIme {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, IntPtr processId);
  [DllImport("user32.dll")] public static extern IntPtr GetKeyboardLayout(uint idThread);
  [DllImport("imm32.dll")] public static extern IntPtr ImmGetDefaultIMEWnd(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern IntPtr SendMessageW(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);
}
"@

$window = [FollowmeowIme]::GetForegroundWindow()
if ($window -eq [IntPtr]::Zero) { throw "foreground-window-unavailable" }
$threadId = [FollowmeowIme]::GetWindowThreadProcessId($window, [IntPtr]::Zero)
$layout = [FollowmeowIme]::GetKeyboardLayout($threadId).ToInt64() -band 0xFFFF
$imeWindow = [FollowmeowIme]::ImmGetDefaultIMEWnd($window)
$imeOpen = $false
if ($imeWindow -ne [IntPtr]::Zero) {
  $imeOpen = [FollowmeowIme]::SendMessageW($imeWindow, 0x283, [IntPtr]0x0005, [IntPtr]::Zero).ToInt64() -ne 0
}

@{ layoutId = "{0:X4}" -f $layout; imeOpen = $imeOpen } |
  ConvertTo-Json -Compress |
  Write-Output
```

The script has no key events, text, process enumeration, clipboard, or
synthetic input. It exits non-zero on `GetForegroundWindow`/PInvoke failure.

- [ ] **Step 6: Implement the provider with bounded process and retry**

`src/main/language-provider.ts` exports:

```ts
export type ProcessResult = Readonly<{
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}>;
export type ProcessRunner = (
  command: string,
  args: readonly string[],
  timeoutMs: number,
  signal: AbortSignal,
) => Promise<ProcessResult>;

export class LanguageProvider {
  constructor(
    platform: PlatformName,
    runner: ProcessRunner,
    onState: (observation: LanguageObservation) => void,
    onError: (reason: "provider-exit" | "provider-timeout" | "provider-output") => void,
  );
  start(): Promise<void>;
  poll(): Promise<void>;
  reset(): void;
  stop(): void;
}
```

On macOS run exactly `/usr/bin/defaults` with `read`, `com.apple.HIToolbox`,
and `AppleCurrentKeyboardLayoutInputSourceID`. On Windows run
`powershell.exe` with `-NoLogo`, `-NoProfile`, `-NonInteractive`,
`-ExecutionPolicy`, `Bypass`, `-File`, and the packaged script path. The default
runner uses `child_process.execFile` with `shell: false`, `windowsHide: true`,
and a 1,500 ms timeout; a timeout kills only that child and never a process by
name.

Successful observations schedule the next poll after 1,000 ms. Errors emit one
callback for the unchanged error reason, emit a hidden observation with the
current monotonic time, and schedule 1, 2, 4, 8, 16, then 30 seconds. `reset`
clears timers and returns to the 1,000 ms cadence; `stop` prevents all later
callbacks. Every start/poll captures a generation token and an AbortController.
Stop/reset aborts the active child; obsolete Promise completion cannot emit a
state/error or create a retry timer. A new generation may start after reset
without sharing state with the obsolete poll.

- [ ] **Step 7: Wire provider, manual override, tray, and renderer transition**

Modify `FollowController` to expose
`setAutomaticLanguage(observation: LanguageObservation): void`. It resolves the
glyph from `settings.languageMode` on every frame. In `index.ts`, construct the
provider once, start it only when `languageMode === "automatic"`, stop it for a
manual mode, and call `controller.setAutomaticLanguage` on provider state.
The tray menu's `Torso label` submenu lists and checks `Automatic`, `Hidden`,
`A`, and `한`; switching to `automatic` calls `provider.reset().start()`.
Implement the 96/120/240 ms glyph opacity transition in renderer CSS/logic and
assert it in the view-model tests.

- [ ] **Step 8: Verify GREEN, privacy, and backoff**

Run:

```bash
npm run check
npm test -- --run tests/domain/language.test.ts tests/main/language-provider.test.ts
npm test -- --run tests/main/follow-controller.test.ts tests/main/tray.test.ts tests/security
```

Expected: all language tests pass, provider runner calls never overlap, and
manual A/한/hidden overrides remain valid while the provider is stopped.

- [ ] **Step 9: Commit automatic providers**

```bash
git add src/domain/language.ts src/main/language-provider.ts resources/win-input-language.ps1 src/main/follow-controller.ts src/main/index.ts src/main/tray.ts tests/domain/language.test.ts tests/main/language-provider.test.ts tests/renderer tests/main
git commit -m "feat: add safe automatic A and Han providers"
```

### Task 14: Enforce runtime privacy and process security

**Files:**
- Modify: `src/main/overlay-window.ts`
- Create: `tests/security/static-boundaries.test.ts`
- Create: `tests/security/runtime-events.test.ts`
- Test: `tests/security/static-boundaries.test.ts`
- Test: `tests/security/runtime-events.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Add failing forbidden-capability tests**

Create `tests/security/static-boundaries.test.ts`:

```ts
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)],
  );
}

describe("privacy source boundary", () => {
  it("contains no forbidden privileged or network API", () => {
    const source = files("src").map((path) => readFileSync(path, "utf8")).join("\n");
    expect(source).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|WebSocket|node:http|node:https|clipboard|globalShortcut|robotjs|accessibility|AXUIElement|CGEventTap|keycode|shell\.openExternal/);
  });

  it("allows only the two preload IPC messages", () => {
    const preload = readFileSync("src/preload/index.ts", "utf8");
    expect([...preload.matchAll(/"(followmeow:[^"]+)"/g)].map((match) => match[1]).sort()).toEqual([
      "followmeow:frame",
      "followmeow:renderer-ready",
    ]);
  });
});
```

Create `tests/security/runtime-events.test.ts` using the overlay fake from
Task 11. Assert the following:

- `will-navigate` calls `preventDefault`;
- `setWindowOpenHandler` returns `{ action: "deny" }`;
- permission request handler returns `false`;
- an invalid IPC render frame never reaches `window.webContents.send`;
- `devTools` is false when `app.isPackaged` is true.

- [ ] **Step 2: Verify RED and inspect every failure**

Run:

```bash
npm test -- --run tests/security
```

Expected: at least the runtime navigation, permission, and invalid-frame tests
fail before the missing hardening is added.

- [ ] **Step 3: Implement exact deny-by-default handling**

In `overlay-window.ts`, bind:

```ts
webContents.on("will-navigate", (event) => event.preventDefault());
webContents.setWindowOpenHandler(() => ({ action: "deny" }));
session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
```

Never use `shell.openExternal` for `About`; instead use `shell.openPath` on the
packaged `dist/legal/THIRD_PARTY_NOTICES.md`. All frame ingress passes through
`isRenderFrame`; all console logs are reduced to known enum strings and app
version. DevTools is disabled in packaged builds and left available only for a
developer override while running unpackaged from the local repo.

- [ ] **Step 4: Verify GREEN and package-content safety**

Run:

```bash
npm run check
npm test -- --run tests/security
npm run build
grep -R -nE 'nodeIntegration: true|clipboard|globalShortcut|CGEventTap|fetch\\(' src || true
```

Expected: security tests pass. The final `grep` prints no output; "no matches"
is the required result, not an error to ignore.

- [ ] **Step 5: Commit privacy enforcement**

```bash
git add src/main/overlay-window.ts tests/security package.json
git commit -m "test: enforce Followmeow privacy boundaries"
```

### Task 15: Add icons, Electron Builder configuration, and four-arch CI

**Files:**
- Modify: `package.json`
- Create: `build/icon.icns`
- Create: `build/icon.ico`
- Create: `build/icon.png`
- Create: `scripts/verify-macos-architecture.mjs`
- Create: `scripts/verify-pe-architecture.mjs`
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/release.yml`
- Create: `tests/packaging/config.test.ts`
- Test: `tests/packaging/config.test.ts`

- [ ] **Step 1: Write packaging configuration RED tests**

Create `tests/packaging/config.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("packaging", () => {
  it("defines four separate architecture commands", () => {
    const scripts = JSON.parse(readFileSync("package.json", "utf8")).scripts;
    expect(scripts["package:mac:x64"]).toContain("--mac --x64");
    expect(scripts["package:mac:arm64"]).toContain("--mac --arm64");
    expect(scripts["package:win:x64"]).toContain("--win --x64");
    expect(scripts["package:win:arm64"]).toContain("--win --arm64");
  });

  it("includes app and legal output but excludes source and tests", () => {
    const build = JSON.parse(readFileSync("package.json", "utf8")).build;
    expect(build.appId).toBe("com.subeom.Followmeow");
    expect(build.files).toEqual(expect.arrayContaining(["dist/**/*", "LICENSE", "NOTICE", "THIRD_PARTY_NOTICES.md"]));
    expect(JSON.stringify(build.files)).not.toContain("src/");
    expect(JSON.stringify(build.files)).not.toContain("tests/");
  });
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- --run tests/packaging/config.test.ts
```

Expected: FAIL because Electron Builder `build` configuration is absent.

- [ ] **Step 3: Add Electron Builder and architecture verifiers**

Add to `package.json`:

```json
{
  "build": {
    "appId": "com.subeom.Followmeow",
    "productName": "Followmeow",
    "asar": true,
    "directories": {
      "output": "release"
    },
    "files": [
      "dist/**/*",
      "LICENSE",
      "NOTICE",
      "THIRD_PARTY_NOTICES.md",
      "PRIVACY.md"
    ],
    "mac": {
      "category": "public.app-category.utilities",
      "icon": "build/icon.icns",
      "target": ["zip"]
    },
    "win": {
      "icon": "build/icon.ico",
      "target": ["nsis", "zip"]
    }
  }
}
```

Generate the three icon files from the approved off-white cat silhouette only;
do not use a GitHub mark. `verify-macos-architecture.mjs` searches
`release/mac*/Followmeow.app/Contents/MacOS/Followmeow`, calls `lipo -archs`,
expects `x86_64` for x64 or `arm64` for arm64, and exits 1 on universal/no
match. `verify-pe-architecture.mjs` reads the PE header from the only matching
`release/win-*-unpacked/Followmeow.exe`, expects machine `0x8664` for x64 and
`0xaa64` for arm64, and exits 1 otherwise.

- [ ] **Step 4: Add CI and release workflows**

Create `.github/workflows/ci.yml`:

```yaml
name: CI
on:
  push:
  pull_request:

jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        include:
          - { os: macos-15-intel, platform: mac, arch: x64 }
          - { os: macos-15-intel, platform: mac, arch: arm64 }
          - { os: windows-2022, platform: win, arch: x64 }
          - { os: windows-2022, platform: win, arch: arm64 }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci --ignore-scripts
      - run: npm run check
      - run: npm test
      - run: npm run build
      - run: npm run test:runtime
      - run: npm run package:${{ matrix.platform }}:${{ matrix.arch }}
      - run: npm run verify:${{ matrix.platform }}:${{ matrix.arch }}
      - uses: actions/upload-artifact@v4
        with:
          name: followmeow-${{ matrix.platform }}-${{ matrix.arch }}
          path: release/
```

Create `.github/workflows/release.yml` with the same four-row package matrix on
tags matching `v*`, artifact download in a second job, and
`softprops/action-gh-release@v2` with `release/**/*.zip` and
`release/**/*.exe` only after all matrix jobs pass. Mark
the release as an unsigned build unless an explicit signing job has verified
signatures.

- [ ] **Step 5: Verify local target and commit**

On the current development platform, run the matching two architecture targets.
For macOS:

```bash
npm run package:mac:x64
npm run verify:mac:x64
npm run package:mac:arm64
npm run verify:mac:arm64
```

For Windows:

```powershell
npm run package:win:x64
npm run verify:win:x64
npm run package:win:arm64
npm run verify:win:arm64
```

Expected: the requested Electron artifacts exist and the verifier prints the
expected native architecture. Commit:

```bash
git add package.json build scripts/verify-macos-architecture.mjs scripts/verify-pe-architecture.mjs .github/workflows tests/packaging/config.test.ts
git commit -m "ci: package Followmeow for four architectures"
```

### Task 16: Complete attribution, user docs, and the release gate

**Files:**
- Modify: `scripts/copy-static.mjs`
- Modify: `README.md`
- Create: `PRIVACY.md`
- Create: `NOTICE`
- Create: `THIRD_PARTY_NOTICES.md`
- Create: `docs/release-smoke-checklist.md`
- Create: `tests/docs/license.test.ts`
- Test: `tests/docs/license.test.ts`

- [ ] **Step 1: Add failing documentation/license tests**

Create `tests/docs/license.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("project notices", () => {
  it("keeps GPL and required attribution text", () => {
    const license = readFileSync("LICENSE", "utf8");
    const notices = readFileSync("THIRD_PARTY_NOTICES.md", "utf8");
    const notice = readFileSync("NOTICE", "utf8");
    expect(license).toContain("GNU GENERAL PUBLIC LICENSE");
    expect(notices).toContain("Deskflow");
    expect(notices).toContain("subeomlee-microsoft-korean-input-cursor-indicator");
    expect(notice).toContain("subeomlee");
    expect(notice).toContain("cat-poses.svg");
  });

  it("states the manual language limitation and permission boundary", () => {
    const privacy = readFileSync("PRIVACY.md", "utf8");
    expect(privacy).toContain("automatic");
    expect(privacy).toContain("manual override");
    expect(privacy).toContain("does not read field text or key events");
    expect(privacy).toContain("Accessibility");
    expect(privacy).toContain("no network");
  });
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- --run tests/docs/license.test.ts
```

Expected: FAIL because `PRIVACY.md`, `NOTICE`, and `THIRD_PARTY_NOTICES.md` do
not exist.

- [ ] **Step 3: Write complete user, privacy, and attribution documents**

`README.md` must explain:

1. macOS 13+/Windows 11 and the four supported architectures;
2. install and tray controls;
3. default automatic A/한 with explicit Hidden/A/한 manual override;
4. exact automatic layout/IME inputs and unknown-to-hidden fallback;
5. required local permissions (none);
6. clean build/package commands;
7. GPL-2.0-only license;
8. source, art, Deskflow, and dependency attribution.

`PRIVACY.md` must enumerate the only values read: cursor point, display
rectangles/identity, reduced-motion setting, user settings, and launch-at-login
state. It must say there is no network, no telemetry, no text/field/keycode/
clipboard/accessibility read, no synthetic input, and no coordinate logging.

`THIRD_PARTY_NOTICES.md` must attribute the inspected Deskflow branch, list
the referenced policy/geometry/controller/panel source paths, say no full
Deskflow application was copied, and state GPL compatibility. `NOTICE` must
attribute the original cat art and visual spec to `subeomlee`, identify the
preserved source files and hashes, and say the geometry is not GitHub/Octocat.
Modify `scripts/copy-static.mjs` to create `dist/legal` and copy `LICENSE`,
`NOTICE`, `THIRD_PARTY_NOTICES.md`, and `PRIVACY.md` after all four files pass
the documentation tests.

- [ ] **Step 4: Write the native release checklist and run final commands**

Create `docs/release-smoke-checklist.md` with a checkbox row for every
surface/architecture pair in section 15 of the specification. Each row must
name the exact observed behavior:

- install/unpack and launch;
- native executable architecture;
- multi-display/DPI and negative-origin;
- click-through;
- full-screen policy;
- sleep/resume stale hide and recovery;
- all tray setting persistence;
- no permission prompt/network request;
- install/uninstall as applicable.

Run:

```bash
npm ci
npm run check
npm test
npm run build
git diff --check
```

Expected: 0 exit status for all commands, no generated files tracked, and no
unchecked static tests.

- [ ] **Step 5: Run the four-target gate and commit documentation**

Confirm all four CI matrix jobs are green. Complete the native smoke rows for
macOS x64, macOS arm64, Windows x64, and Windows arm64 with real or native-VM
hardware. Reject release if any row is unrun; cross-packaging is not proof.

Commit:

```bash
git add README.md PRIVACY.md NOTICE THIRD_PARTY_NOTICES.md scripts/copy-static.mjs docs/release-smoke-checklist.md tests/docs/license.test.ts
git commit -m "docs: complete Followmeow release notices"
```

---

## Plan self-review matrix

| Specification area | Implementing tasks |
|---|---|
| Scope and non-goals | Tasks 2-16; privacy boundary in Task 14 |
| UX states and stale behavior | Tasks 2, 4, 5, 10, 11, 13 |
| Animation/follow model | Tasks 3, 5, 10, 13 |
| Platform APIs and fallbacks | Tasks 9, 11, 12, 14 |
| Automatic A/한 providers | Task 13 |
| Settings and tray behavior | Tasks 6, 12, 13 |
| Permissions, privacy, and security | Tasks 8, 11, 13, 14, 16 |
| Approved cat art | Task 7 |
| Electron main/renderer boundary | Tasks 8-12 |
| Unit and integration tests | Tasks 1-16 |
| macOS/Windows x64/arm64 packaging | Task 15 |
| License and attribution | Tasks 7, 15, 16 |
| Acceptance criteria and platform matrix | Task 16 release checklist plus Task 15 CI |

## Placeholder and name-consistency review

- Public names are fixed: `AppSettings`, `CursorSample`, `RenderFrame`,
  `MotionState`, `LanguageGlyph`, `LanguageMode`, `HideReason`, `OVERLAY_SIZE`,
  `STALE_CURSOR_MS`, `FollowController`, `CursorSampler`, `OverlayWindow`, and
  `SettingsStore`.
- Motion names are always `idle`, `walk`, `run`, and `turn`.
- Rendered glyph names are always `hidden`, `A`, and `한`; `automatic` exists
  only in the `LanguageMode` setting and never reaches the renderer as a glyph.
- All coordinates are DIP and all timing is monotonic milliseconds unless
  `SpringFollower.step` explicitly accepts seconds.
- Every package target has a matching command and verifier.
- No task says to decide behavior during implementation; platform uncertainty
  is handled by explicit hide, reduced-motion, or exit behavior.

## Final end-to-end acceptance command

After the implementation tasks are complete, run:

```bash
npm ci
npm run check
npm test
npm run build
```

On each supported operating system, run the two matching architecture package
commands and verifier commands from Task 14. Review
`docs/release-smoke-checklist.md`; implementation is not complete until every
checkbox has evidence from native x64/arm64 hardware or a native VM.

## Release blocker remediation

- [x] Bundle the browser renderer as IIFE and the sandbox preload as
  Electron-external CommonJS; execute both package outputs in VM/jsdom.
- [x] Make FollowController the sole output-sequence owner and reject duplicate
  frames in the renderer.
- [x] Bound language-provider callbacks by generation and AbortController.
- [x] Serialize tray setting transactions and prevent post-quit application.
- [x] Reset follower, heading, and turn state at stale/screen discontinuities.
- [x] Apply 12 DIP facing hysteresis before committing a turn.
- [x] Keep all committed-turn and edge frames cursor-clear; atomically place on
  the new side and hide when the active display has no non-overlapping origin.
- [x] Preserve turn evidence across zero-delta polls and subtract same-heading
  jitter instead of resetting a legitimate opposite-direction candidate.
- [x] Keep reduced motion on the idle baseline and return to walk/run/idle at
  the exact 120 ms turn-expiry boundary.
- [x] Omit the unsupported Windows full-screen tray item.
- [x] Replace broad Windows primary-language families with exact approved LCIDs.
- [x] Run the packaged runtime smoke test in CI and release workflows.
- [x] Rerun all four package/architecture jobs and complete an independent
  release-blocker code review with no remaining blocker.
- [x] Deduplicate idle controller/overlay/renderer visual work and cache
  display topology outside the 16 ms cursor loop.
- [x] Deduplicate unchanged language glyph observations while heartbeating
  freshness at the preserved 1 s cadence.
- [x] Upload exact ZIP/EXE artifacts only and avoid duplicate CI builds.
- [x] Restrict Electron locales to English and Korean; retain Korean runtime
  glyph smoke coverage and record per-platform package-size evidence.
