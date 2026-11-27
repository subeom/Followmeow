# Followmeow app icon

`followmeow-metaphysical-icon.png` is the approved, original 1024 x 1024 RGBA
application icon for Followmeow. It uses a luminous face-free cat silhouette
with an orbital form and restrained steel-blue/dusty-mauve accents.

The file is copied byte-for-byte to `build/icon.png` and is licensed with the
project under GPL-2.0-only. It contains no GitHub/Octocat geometry, text,
watermark, or third-party artwork.

SHA-256:
`41d6270158ed148695f525256af8ae4e6091a8a5445305bd6e17262d7ee2eda4`

`build/icon.png` is an exact copy. `scripts/verify-packaged-icons.mjs` verifies
that electron-builder derives a 1024px ICNS representation for macOS and embeds
the generated ICO PNG in the packaged Windows executable.
