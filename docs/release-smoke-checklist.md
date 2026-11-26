# Followmeow native release smoke checklist

Record each result with the operating-system build, installer/archive SHA-256,
hardware or VM, date, and tester. A release is blocked while any required row is
unchecked. Successful cross-packaging is package evidence only:
**cross-packaging is not native runtime proof**.

## macOS x64

- [ ] Install/unpack on an Intel Mac and launch from Finder.
- [ ] Confirm the tray item appears and no permission prompt is shown.
- [ ] Confirm the packaged executable Mach-O header reports x64.
- [ ] Confirm every cursor corner and negative-origin/mixed-DPI display layout.
- [ ] Confirm a click through the cat reaches the underlying application.
- [ ] Confirm full-screen/workspace behavior and the fallback hide policy.
- [ ] Confirm sleep/resume hides stale state and then recovers.
- [ ] Confirm automatic 2SetHangul/known-Latin parsing and all manual overrides.
- [ ] Confirm tray settings and launch-at-login persistence, then quit.
- [ ] Confirm no network request, text/key event, clipboard, or Accessibility read.

## macOS arm64

- [ ] Install/unpack on Apple silicon and launch from Finder.
- [ ] Confirm the tray item appears and no permission prompt is shown.
- [ ] Confirm the packaged executable Mach-O header reports arm64.
- [ ] Confirm every cursor corner and negative-origin/mixed-DPI display layout.
- [ ] Confirm a click through the cat reaches the underlying application.
- [ ] Confirm full-screen/workspace behavior and the fallback hide policy.
- [ ] Confirm sleep/resume hides stale state and then recovers.
- [ ] Confirm automatic 2SetHangul/known-Latin parsing and all manual overrides.
- [ ] Confirm tray settings and launch-at-login persistence, then quit.
- [ ] Confirm no network request, text/key event, clipboard, or Accessibility read.

## Windows x64

- [ ] Install with NSIS on Windows 11 x64 and launch.
- [ ] Confirm the tray item appears and no permission prompt is shown.
- [ ] Confirm the packaged PE header reports x64.
- [ ] Confirm every cursor corner and mixed-DPI display layout.
- [ ] Confirm a click through the cat reaches the underlying application.
- [ ] Confirm borderless/full-screen behavior and the fallback policy.
- [ ] Confirm sleep/resume hides stale state and then recovers.
- [ ] Confirm Korean IME open/closed, Latin, unknown, and manual overrides.
- [ ] Confirm tray settings and launch-at-login persistence.
- [ ] Uninstall and confirm the app is removed.
- [ ] Confirm no network request, text/key event, clipboard, or privileged read.

## Windows arm64

- [ ] Install with NSIS on Windows 11 arm64 and launch.
- [ ] Confirm the tray item appears and no permission prompt is shown.
- [ ] Confirm the packaged PE header reports arm64.
- [ ] Confirm every cursor corner and mixed-DPI display layout.
- [ ] Confirm a click through the cat reaches the underlying application.
- [ ] Confirm borderless/full-screen behavior and the fallback policy.
- [ ] Confirm sleep/resume hides stale state and then recovers.
- [ ] Confirm Korean IME open/closed, Latin, unknown, and manual overrides.
- [ ] Confirm tray settings and launch-at-login persistence.
- [ ] Uninstall and confirm the app is removed.
- [ ] Confirm no network request, text/key event, clipboard, or privileged read.
