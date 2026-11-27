# Followmeow Design Specification

**Status:** Approved for implementation planning
**Target platforms:** macOS 13 or later and Windows 11, x64 and arm64
**Application stack:** Electron, TypeScript, and JavaScript-only dependencies
**License:** GPL-2.0-only

## 1. Goal

Followmeow is a small desktop companion that renders an original side-profile
cat near the system mouse cursor. The cat follows across displays, clamps to the
visible display bounds, changes between idle, walk, run, and turn poses, and
displays an automatically classified or manually selected `A` or `한` glyph in
its torso. The application is controlled from the system tray and does not
accept mouse or keyboard input.

The product is intentionally extracted from the cursor-adjacent companion work
in the user's Deskflow branch
`subeomlee-microsoft-korean-input-cursor-indicator`. Followmeow does not embed
or fork Deskflow. It carries over the behavioral lessons: screen-aware
positioning, deterministic motion states, stale-state hiding, a fail-closed
policy, and privacy boundaries.

## 2. Scope

The first implementation must deliver all of the following:

1. One transparent, frameless, click-through, always-on-top overlay.
2. Cursor polling from Electron's main process at no more than 60 samples per
   second.
3. Multi-display tracking in Electron screen coordinates.
4. A deterministic spring follower, display clamping, stale-sample policy, and
   display-transition reset.
5. Original side-profile cat artwork with idle, walk, run, and turn poses.
6. A torso glyph mode of automatic, hidden, `A`, or `한`. Automatic mode reads
   only an operating-system layout identifier and, on Windows, the IME open
   bit. Manual modes override the provider.
7. A system tray menu for visibility, glyph, motion, launch-at-login, and quit.
8. Persisted, locally validated settings.
9. macOS and Windows packages for x64 and arm64.
10. Unit tests for policy, geometry, settings, motion, platform language
    classifiers, process parsers, and provider retry/backoff; renderer and main
    integration tests; and a four-target release matrix.
11. GPL-2.0-only licensing plus attribution for Deskflow and the original
    Followmeow cat artwork.

## 3. Non-goals

The first implementation will not:

- infer language from field contents, keycodes, key events, application text,
  clipboard data, or accessibility values;
- request Accessibility, Screen Recording, Input Monitoring, or similar
  permissions;
- read the focused application, focused field, text contents, keycodes,
  clipboard, or accessibility values;
- synthesize mouse, keyboard, or text input, or move the cursor;
- mutate or intercept input in another application;
- connect to a network, upload settings, collect telemetry, or include an
  analytics SDK;
- show notifications, onboarding pages, crash-upload dialogs, a regular
  settings window, or a Dock/taskbar application window;
- recreate GitHub, Octocat, or Deskflow UI geometry;
- provide plugins, custom artwork import, Linux packages, mobile support, or
  native-code adapters.

## 4. User experience states

The renderer has one public state model. It never infers a state from unrelated
DOM or operating-system behavior.

| State | Entry condition | Visible result | Exit condition |
|---|---|---|---|
| `disabled` | `enabled` is false | No overlay window is visible and no cursor polling runs | User enables Followmeow from the tray |
| `waiting` | Enabled, but no valid current sample or the overlay is not ready | No cat is visible | One valid sample and a ready renderer |
| `idle` | Valid sample; pointer speed below the walk threshold for 180 ms | Idle cat pose near the cursor; reduced-motion pose is also idle | Movement crosses the walk threshold |
| `walk` | Valid sample; speed is at least 30 px/s or cursor displacement is at least 3 px | Walk pose near the cursor | Run threshold, turn event, or idle settlement |
| `run` | Valid sample; speed is at least 650 px/s, cursor displacement is at least 48 px, or follower lag is at least 24 px | Run pose near the cursor | Idle settlement, walk movement, or turn event |
| `turn` | A direction change passes the movement threshold and the turn lockout has expired | Short turn pose, at most 120 ms, while maintaining the follower position | 120 ms elapses or the app enters a hidden state |
| `hidden-stale` | A cursor sample fails or the newest sample is older than 250 ms | Cat hides immediately; the glyph is not preserved for stale replay | A fresh sample is accepted |
| `hidden-display` | No display contains the cursor, display topology changes, or the configured full-screen policy suppresses the cat | Cat hides immediately and follower state resets | A current display is resolved |
| `quitting` | App shutdown begins | Polling stops before windows are destroyed | Process exits |

Language glyph state is orthogonal to cursor state. In automatic mode, a fresh
Korean result renders `한`, a fresh known-Latin result renders `A`, and an
unknown, stale, or failed result renders no glyph. Manual `A`, `한`, and hidden
modes bypass the provider result. A failed automatic provider is retried with
exponential backoff, never in a tight loop.

All state transitions are deterministic from the previous state, a cursor
sample, a glyph observation, a monotonic timestamp, and validated settings. A
stale source never leaves an old `A` or `한` glyph visible.

## 5. Architecture

### 5.1 Process boundaries

The main process owns all privileged work:

- Electron application lifecycle;
- `screen.getAllDisplays()` and `screen.getCursorScreenPoint()`;
- the deterministic cursor/follow controller;
- overlay `BrowserWindow` creation and placement;
- the tray and native menu;
- local settings and launch-at-login;
- validation, hide reasons, and lifecycle cleanup.

The isolated renderer:

- receives only validated render frames;
- selects the matching SVG asset and glyph;
- paints a fixed-size transparent canvas;
- exposes no mouse, keyboard, Node, clipboard, storage, or network capability;
- never decides whether data is current or trusted.

`preload.ts` is the only bridge. It uses `contextBridge.exposeInMainWorld` to
publish a narrow, typed `followmeow` API: subscribe to render frames, unsubscribe,
and report renderer readiness. It does not expose `ipcRenderer`, filesystem,
environment variables, or arbitrary `invoke` methods.

### 5.2 Module responsibilities

| Module | Responsibility |
|---|---|
| `src/domain/types.ts` | Shared branded value types and serializable frame/settings contracts |
| `src/domain/geometry.ts` | Display containment, logical overlay bounds, and finite clamping |
| `src/domain/policy.ts` | `show`/`hide` decisions and sanitized hide reasons |
| `src/domain/motion.ts` | Fixed-step spring, heading, motion state, turn lockout, and pose selection |
| `src/domain/language.ts` | Automatic/manual glyph resolution, platform classifiers, parsing, and freshness |
| `src/main/settings-store.ts` | Atomic local JSON load, independent-key validation, and atomic save |
| `src/main/language-provider.ts` | Exact child-process invocation, timeout, and retry/backoff |
| `src/main/cursor-sampler.ts` | Timer-driven cursor/display snapshots and stale-age metadata |
| `src/main/follow-controller.ts` | Frame sampling, policy evaluation, motion update, monotonic output sequencing, and IPC frame production |
| `src/main/overlay-window.ts` | Overlay configuration, bounds updates, IPC frame delivery, and cleanup |
| `src/main/tray.ts` | Native menu binding and checked menu state |
| `src/main/index.ts` | Electron lifecycle wiring and dependency composition |
| `src/preload/index.ts` | Minimal context-isolated renderer bridge, bundled as a self-contained CommonJS preload |
| `src/renderer/index.ts` | Render-frame application and pose/glyph presentation |
| `scripts/bundle-runtime.mjs` | IIFE renderer and Electron-external preload bundling |

There are no native npm addons. Any package with a native runtime addon is
rejected from the dependency graph.

### 5.3 Data flow

```text
Electron screen API
  -> cursor-sampler (16 ms budget)
  -> validated CursorSample
  -> pure policy + geometry + motion controller
  -> validated RenderFrame
  -> preload bridge
  -> isolated renderer
```

The build emits `dist/renderer/index.bundle.js` as a browser IIFE and
`dist/preload/index.bundle.cjs` as a sandbox-compatible CommonJS preload with
Electron external. TypeScript's raw CommonJS renderer output is not loaded by
the browser. `FollowController` owns every output frame sequence; input sampler
sequences are diagnostic metadata only.

Automatic glyph observations travel through a separate, lower-frequency path:

```text
macOS /usr/bin/defaults or packaged Windows PowerShell script
  -> exact process-output parser
  -> platform classifier
  -> freshness/manual-override resolver
  -> validated RenderFrame glyph
```

Tray changes use the opposite path but remain serialized in the main process:

```text
Tray menu -> validated SettingsUpdate -> settings store -> controller reconfigure
```

Renderer events cannot modify settings or privileged behavior.

## 6. Coordinate and follow model

### 6.1 Coordinate contract

All points and rectangles are Electron DIP (device-independent pixel) values.
The pure modules do not read monitor pixels, window scale factors, or native
handles. Tests use negative display origins to cover monitors left/above the
primary display.

For each sample:

1. Read one cursor point and a display snapshot.
2. Reject non-finite values.
3. Find the display whose `bounds` contains the point. A point on a shared edge
   belongs deterministically to the first display in the platform snapshot order.
4. If none contains it, emit a hide frame and reset follower position.
5. Compute a desired follower anchor behind the cursor using the last committed
   heading. A horizontal reversal changes facing and heading only after the
   12 DIP turn threshold is crossed; 1 DIP jitter keeps the current facing.
6. Clamp the complete 144 x 96 DIP overlay bounds inside the selected display
   with an 8 DIP safety margin.
7. Apply the result to the overlay and emit only serializable values.

The follower uses a 34 DIP separation between the cursor and the leading edge
of the cat. It moves behind the cursor, never covers the cursor, except where
physical display clamping makes the requested separation impossible.

### 6.2 Fixed-step spring

Motion updates use a fixed 1/60 second step. A delayed main-process tick may
consume at most four accumulated steps and then discard the remainder. It may
never produce an unbounded catch-up or a visible teleport across displays.

For each step:

```text
acceleration = stiffness * (desired - position) - damping * velocity
velocity += acceleration * deltaSeconds
position += velocity * deltaSeconds
```

Baseline constants are:

| Constant | Value |
|---|---:|
| Stiffness | 110 |
| Damping | 21 |
| Maximum speed | 1,600 DIP/s |
| Cursor-follow scale range | 0.75x to 1.50x |
| Maximum target lead distance | 480 DIP |
| Overlay size | 144 x 96 DIP |
| Screen margin | 8 DIP |

The configured `followSpeedPercent` scales stiffness in the 75%-150% range.
Non-finite controller inputs produce a hide frame. On a display identity
change, the follower initializes at the new desired clamped position rather
than animating across monitors.

### 6.3 Motion state

The following Deskflow-derived thresholds are fixed:

- Walk: cursor speed is at least 30 DIP/s or cursor displacement is at least
  3 DIP.
- Run: cursor speed is at least 650 DIP/s, cursor displacement is at least
  48 DIP, or follower lag is at least 24 DIP.
- Idle: no walk/run condition remains for 180 ms.
- Turn: the prior valid horizontal direction differs from the current direction
  after at least 12 DIP of horizontal displacement. Turn lasts 120 ms and
  cannot retrigger for 160 ms.
- Reduced motion: state is always `idle`; the spring jumps to the clamped
  target with no idle bob, walk cycle, run cycle, rotation, or scale animation.

Rendering phase uses monotonic milliseconds. Fast motion is sampled at up to
60 fps; idle rendering is at most 12 fps to avoid unnecessary work.

## 7. Artwork and renderer

The implementation must adapt only the user-approved cat art supplied in
`/Users/subeomlee/.copilot/session-state/9825e0bd-8139-47fe-b559-07f6b89986e4/files/cat-art/cat-poses.svg`
and `visual-spec.md`. The source direction is immutable:

- original, face-free, side-profile silhouette;
- soft off-white body with simple, readable contrast;
- `A` or `한` drawn in the torso, not in an external badge;
- idle, walk, run, and turn behavior;
- no GitHub/Octocat geometry.

The implementation normalizes that artwork into a runtime set with the exact
filenames:

- `src/renderer/assets/cat-idle.svg`
- `src/renderer/assets/cat-walk-1.svg`
- `src/renderer/assets/cat-walk-2.svg`
- `src/renderer/assets/cat-run-1.svg`
- `src/renderer/assets/cat-run-2.svg`
- `src/renderer/assets/cat-turn.svg`

The approved `cat-poses.svg` and turn plate are retained unchanged at
`artwork/source/cat-poses.svg` and `artwork/source/05-turn.svg`; the visual
specification is retained at `artwork/visual-spec.md`. SHA-256 hashes for all
three inputs are recorded in `artwork/source-manifest.json`. Runtime assets
must remain traceable to those inputs.

The renderer alternates walk/run assets by phase, uses the turn asset during
the `turn` state, and mirrors the image horizontally from the center only when
heading changes. The glyph is renderer text over the artwork's designated
torso position. It is not part of the SVG source, so changing among hidden,
`A`, and `한` does not modify or replace the art.

Automatic glyph changes use the approved 240 ms input-transition behavior: fade
the old glyph for 96 ms, hold a body-only soft state from 96-120 ms, then reveal
the new glyph by 240 ms. A glyph switch never moves the cat's contact points or
changes its scale.

## 8. Overlay and platform APIs

### 8.1 Electron overlay

The overlay is created once after `app.whenReady()`:

- transparent and frameless;
- fixed 144 x 96 DIP bounds;
- `resizable: false`, `movable: false`, `fullscreenable: false`,
  `minimizable: false`, `maximizable: false`, and `closable: false`;
- `focusable: false`;
- `skipTaskbar: true`;
- always on top;
- excluded from screenshot-capture APIs where Electron exposes such a setting
  without requesting a permission;
- fully click-through with `setIgnoreMouseEvents(true)`;
- renderer pointer events disabled by CSS.

On macOS it participates on all workspaces where Electron permits that and
appears on full-screen spaces only when the `showOverFullScreen` setting is
enabled. On Windows it remains a tool-free topmost window, uses
`skipTaskbar: true`, and does not claim ownership of the desktop or taskbar.

### 8.2 API fallback matrix

| Capability | macOS | Windows | If unavailable |
|---|---|---|---|
| Cursor point and display bounds | Electron `screen` | Electron `screen` | Hide immediately; retry on the next scheduled sample |
| Always-on-top/click-through | Electron `BrowserWindow` APIs | Electron `BrowserWindow` APIs | Fail app-level readiness and show a tray error item; do not continue with a partially interactive overlay |
| All workspaces/full-screen visibility | `setVisibleOnAllWorkspaces` and `setFullScreenable(false)` | Not required | Continue on the current workspace; if full-screen visibility cannot be guaranteed, hide over full-screen windows by policy |
| Reduced motion | `systemPreferences.getAnimationSettings()` plus renderer media query | Same | Default to reduced motion and no continuous idle animation |
| Launch at login | `app.setLoginItemSettings()` | `app.setLoginItemSettings()` | Keep setting unchecked and record a sanitized local warning |
| Input-layout source | `/usr/bin/defaults read com.apple.HIToolbox AppleCurrentKeyboardLayoutInputSourceID` | Packaged PowerShell script using public `user32`/`imm32` layout and IME status calls | Hide the automatic glyph, keep manual override available, and use bounded backoff |
| Native tray | Electron `Tray` | Electron `Tray` | Write a sanitized fatal lifecycle error and exit; do not run as an uncontrollable background app |

The only permitted external process is the exact read-only language-layout
provider: macOS executes `/usr/bin/defaults` directly with arguments, and
Windows executes the packaged PowerShell file with `-NoProfile`,
`-NonInteractive`, and a timeout. No shell interpolation, arbitrary script,
text capture, synthetic input, or background service is permitted.

## 9. Settings

Settings live at `app.getPath("userData")/settings.json`. The file is not
uploaded, shared, or readable by the renderer. A write is performed with a
temporary file in the same directory followed by an atomic rename. If a write
fails, the in-memory setting remains unchanged and the tray exposes an error
state; it must not report success.

| Setting | Type/range | Default | Surface |
|---|---:|---:|---|
| `enabled` | boolean | `true` | Tray `Enable Followmeow` |
| `languageMode` | `automatic`, `hidden`, `A`, `한` | `automatic` | Tray `Torso label` submenu |
| `followSpeedPercent` | integer 75-150 | `100` | Tray `Follow speed` submenu |
| `showOverFullScreen` | boolean | `true` on macOS; `false` on Windows | macOS tray `Show over full screen`; omitted on Windows |
| `launchAtLogin` | boolean | `false` | Tray `Launch at login` |
| `motionPolicy` | `system`, `reduced` | `system` | Validated settings file; tray `Reduce motion` toggle |

The settings schema is strict. Unknown root keys are discarded with a warning;
invalid known keys fall back independently to their defaults. A missing file
uses all defaults. A syntactically invalid file is backed up once as
`settings.invalid.json`, replaced with validated defaults, and reported through
the tray, not silently accepted.

## 10. Tray behavior

Followmeow is a tray-only application. On macOS it is hidden from the Dock. On
Windows it never creates a taskbar task for the overlay.

The menu order and labels are stable:

1. `Followmeow` (disabled information row and version)
2. `Enable Followmeow`
3. separator
4. `Torso label` submenu: `Automatic`, `Hidden`, `A`, `한`
5. `Follow speed` submenu: `Calm (75%)`, `Normal (100%)`, `Playful (125%)`,
   `Quick (150%)`
6. `Reduce motion`
7. `Show over full screen` (macOS only; omitted on Windows)
8. `Launch at login`
9. separator
10. `About Followmeow` (opens the locally packaged notices document)
11. `Quit`

Checkbox and radio state comes from the last successfully persisted settings
snapshot. A failed setting write leaves the previous checkmark. A click never
closes another app, reveals protected data, or requires a window to gain focus.
The tray icon has normal and disabled variants.

## 11. Security and privacy

### 11.1 Collection boundary

Followmeow collects no text or user activity. It reads only:

- cursor position in DIP coordinates;
- display rectangles and display identity;
- system reduced-motion preference;
- on macOS, the `AppleCurrentKeyboardLayoutInputSourceID` string returned by
  `/usr/bin/defaults`;
- on Windows, the foreground layout language ID and IME-open Boolean returned
  by the packaged PowerShell provider;
- settings selected by the user;
- local operating-system launch-at-login state.

Coordinates and layout observations exist only in process memory. They are not
written to logs, settings, crash reports, or telemetry. Logs contain only
sanitized hide/provider reason enums, versions, and lifecycle errors without
path values, cursor coordinates, or raw layout strings.

### 11.2 Renderer hardening

The overlay `webPreferences` are:

```text
contextIsolation: true
sandbox: true
nodeIntegration: false
nodeIntegrationInWorker: false
webSecurity: true
devTools: false in packaged builds
```

The renderer has a strict same-origin content security policy:

```text
default-src 'self';
script-src 'self';
style-src 'self';
img-src 'self' data:;
connect-src 'none';
object-src 'none';
frame-src 'none';
base-uri 'none';
form-action 'none'
```

The main process rejects `will-navigate`, blocks `window.open`, denies all
permission requests, and ignores messages that fail runtime validation. There
is no code path for `eval`, inline script, remote content, arbitrary IPC
channels, or external protocol handling.

### 11.3 Fail-closed rules

- A malformed or old cursor sample hides the cat.
- Missing screen topology hides the cat.
- Overlay capability failure keeps the overlay hidden and does not fall back to
  an interactive window.
- An invalid renderer message is ignored and reported by sanitized reason.
- A failed settings load/writes never keeps stale tray UI as if persistence
  succeeded.
- Automatic provider timeout, malformed output, non-zero exit, or stale state
  renders no glyph. A manual `A`, `한`, or hidden selection remains valid.
- A provider failure is reported once for an unchanged error state, then retried
  after 1, 2, 4, 8, 16, and 30 second intervals. Recovery resets the backoff.
- Stop/reset aborts the active child and advances a generation token. A late
  callback from an obsolete generation cannot emit state/error or schedule a
  timer.
- Settings tray transactions are serialized. Each transaction re-reads the
  latest stored snapshot and cannot apply to destroyed runtime objects after
  quit.

## 12. Packaging and releases

`electron-builder` produces four separate release targets:

| Target | Electron architecture | Artifact |
|---|---|---|
| macOS x64 | `x64` | ZIP for Intel Macs |
| macOS arm64 | `arm64` | ZIP for Apple silicon |
| Windows x64 | `x64` | NSIS installer and ZIP |
| Windows arm64 | `arm64` | NSIS installer and ZIP |

Artifacts use normal Electron native architecture selection; the package's
JavaScript and renderer assets are architecture-independent. Universal
artifacts are intentionally not used because they obscure whether each target
was separately produced and verified. The Windows PowerShell provider is copied
as an `extraResource` outside `app.asar`.

GitHub Actions has an operating-system/architecture matrix for all four targets.
Every job installs with `npm ci`, runs type checking and unit/integration tests,
builds, packages the target, verifies executable/framework architecture, and
uploads named artifacts. A tag-triggered release job gathers all artifacts and
publishes only after all four target jobs pass.

The release workflow may not claim signing/notarization unless signing
credentials are configured and verification succeeds. Unsigned local and
release builds are labeled as unsigned in the release notes. Auto-update is out
of scope; update checks therefore make no network requests.

## 13. License and attribution

The application is licensed as `GPL-2.0-only`, matching the repository
`LICENSE`. The project must contain:

- `THIRD_PARTY_NOTICES.md` attributing the Deskflow project and the inspected
  branch/path files that informed the behavior;
- `NOTICE` attributing the original cat art and visual direction to
  `subeomlee`, with the approved source inputs;
- package metadata naming the repository, license, author, and source;
- rendered About content naming Followmeow, version, GPL-2.0-only, Deskflow
  attribution, and a local link to notices;
- preserved SPDX headers in newly authored source files.

Followmeow does not represent itself as part of Deskflow. No bundled file may
carry Deskflow branding, and no copied design may recreate GitHub/Octocat
geometry. Dependency license text is generated by the normal release process
and included in distributed artifacts.

## 14. Acceptance criteria

Implementation is complete only when all criteria are true:

1. On all four supported targets, the application installs or unpacks, starts,
   creates a tray item, and shows a cat after a valid cursor sample.
2. The overlay remains transparent, frameless, click-through, and always on
   top. Clicking through the cat affects the underlying application normally.
3. The complete overlay remains within the display on every edge and corner,
   including displays left of or above the primary display.
4. Idle, walk, run, and turn are deterministic under fixed sample sequences;
   the turn state cannot flicker indefinitely.
5. A cursor/display sample older than 250 ms or a failed sample hides the
   overlay immediately. A fresh sample restores it without stale position or
   glyph data.
6. Changing displays resets motion and does not animate the cat through the
   gap between monitors.
7. `Automatic`, `Hidden`, `A`, and `한` choices render the resolved torso state.
   Automatic mode uses only a verified provider result; malformed, stale, or
   unknown output hides the glyph. Manual modes always override it.
8. Invalid JSON and out-of-range settings recover as specified, and a failed
   settings save is not shown as successful.
9. Reduced motion disables continuous idle animation, walk/run cycling,
   rotation, scale motion, and spring catch-up.
10. No Accessibility, Screen Recording, Input Monitoring, or equivalent
    permission prompt appears.
11. Static and runtime checks find no network request, telemetry SDK,
    `Accessibility` value read, clipboard access, key-event read, text-field
    read, synthetic input call, or native addon. The only external processes are
    the exact macOS `defaults` command and the packaged Windows PowerShell file.
12. Quitting from the tray stops polling, removes the tray and overlay, and
    restores no changed cursor or keyboard state.
13. `npm ci`, `npm run check`, `npm test`, `npm run build`, and
    `npm run test:runtime` pass from a clean checkout. The runtime test executes
    the renderer/preload package output in VM/jsdom. Each packaging command
    creates an artifact for the requested architecture.
14. GPL/attribution files are present in source and packaged artifacts.
15. A manual smoke run records all rows of the matrix in section 15 as passed.

## 15. Required platform test matrix

| Test surface | macOS x64 | macOS arm64 | Windows x64 | Windows arm64 |
|---|---|---|---|---|
| Clean install/unpack and launch | Launch on Intel Mac; tray icon appears; no permission prompt | Launch on Apple silicon; tray icon appears; no permission prompt | Launch on Windows 11 x64; tray icon appears; no permission prompt | Launch on Windows 11 arm64; tray icon appears; no permission prompt |
| Architecture | Packaged app contains x86_64 Electron executable and passes `file` check | Packaged app contains arm64 Electron executable and passes `file` check | Packaged executable/installer reports x64 | Packaged executable/installer reports arm64 |
| Cursor and corners | Pass all unit geometry cases plus physical top/bottom/left/right corners | Same | Same | Same |
| Multi-display/DPI | Mixed-DPI two-display smoke test including negative-origin display | Same | Same | Same |
| Click-through | Underlying browser button receives click through cat | Same | Same | Same |
| Full-screen | Cat appears in full-screen policy mode on supported workspace; hides if capability is unavailable | Same | No tray control; native borderless/full-screen observation only | Same |
| Sleep/resume | Cat hides on stale after resume, then recovers without stale position | Same | Same | Same |
| Tray/settings | Enable, glyph, speed, reduced motion, launch-at-login, and quit persist | Same | Same | Same |
| Automatic A/한 | `/usr/bin/defaults` parser follows 2SetHangul/known-Latin layouts; provider failure hides the glyph and backs off | Same | Foreground layout/IME state parser follows Korean-open, Korean-closed, Latin, unknown, and malformed output | Same |
| Privacy | Runtime request log is empty and OS permission list has no added requirement | Same | Same | Same |
| Packaging | ZIP unpacks and launches; uninstaller not required on macOS | Same | NSIS installs, launches, and uninstalls | Same |

Automated GitHub Actions jobs must cover clean build, type checking, tests,
the packaged renderer/preload runtime smoke test, packaging, architecture
inspection, and artifact upload for every row. Physical or native VM smoke
coverage is mandatory before a release because emulation or cross-packaging
alone cannot prove input layering, DPI behavior, or full-screen behavior.

## 16. Material implementation risks

1. **Arm64 release runtime:** Electron Builder can cross-package JavaScript
   bundles, but cross-packaging does not prove native layering behavior.
   Mitigation: native arm64 runtime smoke tests and executable architecture
   checks are release gates.
2. **macOS full-screen spaces:** Electron's all-workspaces/full-screen behavior
   depends on window levels. Mitigation: isolate the policy, test on a real Mac,
   and hide rather than expose a partially supported state.
3. **Windows arm64 behavior:** Electron Windows x64 paths must not be reused in
   an ARM64 artifact. Mitigation: inspect PE architecture and test on Windows 11
   arm64 before release.
4. **Automatic input-language classification:** macOS layout naming and Windows
   IME state are OS signals rather than field text, but malformed or uncommon
   layout identifiers can be ambiguous. Mitigation: explicit Korean and Latin
   allowlists, unknown-to-hidden behavior, manual override, process timeouts,
   parser tests, and bounded provider backoff.
5. **Original artwork fidelity:** The runtime pose set is derived from external
   approved source files. Mitigation: preserve source bytes, record SHA-256
   hashes, and add structure/snapshot tests for each normalized pose.
