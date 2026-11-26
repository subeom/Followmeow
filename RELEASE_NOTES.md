# Followmeow 0.1.0

This build packages the first tray-only Followmeow implementation for macOS
x64/arm64 and Windows x64/arm64.

- Transparent, click-through cursor-following cat overlay
- Original idle, walk, run, and turn artwork
- Automatic A/한 classification with explicit manual override
- Local settings, tray controls, launch-at-login, and reduced motion
- GPL-2.0-only source and dependency/Deskflow attribution

Release artifacts are unsigned and not notarized unless a configured signing
job explicitly verifies signatures. Packaged architecture is checked from the
Mach-O or PE header. Native macOS/Windows arm64 runtime behavior still requires
the physical/native-VM smoke checklist in
`docs/release-smoke-checklist.md`.
