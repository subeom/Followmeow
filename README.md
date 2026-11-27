# Followmeow

Followmeow is a tray-only cursor companion for macOS 13+ and Windows 11. It
supports x64 and arm64, follows the cursor across displays, stays transparent
and click-through, and presents an original face-free side-profile cat.

## Torso language label

The cat shows `A` or `한` from a read-only operating-system layout/IME provider
by default. Automatic classification reads only a macOS layout identifier or a
Windows layout language ID plus the IME-open state. The tray provides explicit
Automatic, Hidden, `A`, and `한` modes. Unknown, malformed, timed-out, or stale
automatic output hides the glyph. Manual mode always overrides it.

Followmeow does not read text fields, key events, keycodes, clipboard data,
Accessibility values, or application content. It requires no Accessibility or
Screen Recording permission and makes no network request.

## Controls

Use the tray icon to:

- enable or disable the cat;
- choose automatic or manual torso labeling;
- choose follow speed;
- reduce motion;
- control full-screen visibility on macOS only;
- enable launch at login;
- open the packaged notices;
- quit.

## Development

```bash
npm ci
npm run check
npm test
npm run build
npm run test:runtime
npm start
```

Package and verify one architecture:

```bash
npm run package:mac:x64
npm run verify:mac:x64
```

Equivalent `mac:arm64`, `win:x64`, and `win:arm64` scripts create and inspect
the other native targets. Architecture verifiers read the Mach-O or PE header
instead of trusting a target string.

## Attribution and license

Followmeow is GPL-2.0-only. It is not part of Deskflow and does not copy the
Deskflow application. See `NOTICE`, `THIRD_PARTY_NOTICES.md`, and `PRIVACY.md`
for original artwork provenance, Deskflow behavior attribution, and privacy
details.
