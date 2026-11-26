# Followmeow privacy

Followmeow has no network client, telemetry, analytics, cloud sync, or
auto-update request.

The app reads only:

- the mouse cursor point and display rectangles/identity;
- system reduced-motion preference;
- the macOS `AppleCurrentKeyboardLayoutInputSourceID` from `/usr/bin/defaults`;
- on Windows, the foreground keyboard layout language ID and IME-open Boolean
  from the packaged PowerShell provider;
- settings selected by the user;
- operating-system launch-at-login state.

Automatic A/한 is based only on the layout and IME signals above. The user can
choose a manual override: Hidden, `A`, or `한`. Malformed, timed-out, unknown,
or stale automatic state hides the glyph.

Followmeow does not read field text or key events. It does not read keycodes,
focused-field contents, application content, Accessibility values, the
clipboard, screenshots, passwords, or protected fields. It does not synthesize
input or move the cursor.

Cursor coordinates and layout observations remain in process memory. They are
not written to disk, logs, crash reports, or telemetry. Logs contain only
sanitized lifecycle/provider reason codes and version information.

The overlay uses no Accessibility, Screen Recording, or Input Monitoring
permission. Windows provider execution is limited to the bundled PowerShell
script. macOS provider execution is limited to `/usr/bin/defaults` with fixed
arguments. Neither process receives user text or a shell command.
