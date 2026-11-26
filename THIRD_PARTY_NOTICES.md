# Third-party notices

## Deskflow

Followmeow was extracted as a standalone application after observing behavior
from the user's Deskflow branch
`subeomlee-microsoft-korean-input-cursor-indicator`.

Reference paths that informed the independently implemented design:

- `src/lib/gui/input/InputIndicatorGeometry.cpp`
- `src/lib/gui/input/InputIndicatorPolicy.cpp`
- `src/lib/gui/input/MacInputIndicatorController.mm`
- `src/lib/gui/input/MacInputIndicatorCatArtwork.h`
- `src/lib/gui/input/MacInputIndicatorPanel.h`

Followmeow reimplements the product behavior in TypeScript and does not embed or
copy the Deskflow application. No Deskflow branding is included. The source
project is:

https://github.com/subeom/deskflow/tree/subeomlee-microsoft-korean-input-cursor-indicator

Deskflow is GPL-2.0-only WITH LicenseRef-OpenSSL-Exception. Followmeow remains
GPL-2.0-only compatible and includes its full repository license.

## Original Followmeow artwork

The preserved cat source and visual specification are credited in `NOTICE`.
The source artwork was adapted into runtime SVG poses without copying GitHub or
Octocat geometry.

## Electron toolchain

Distributed applications contain Electron, Chromium, Node.js, and their
component licenses as supplied by the Electron distribution. Dependency source
and license metadata remain available through `package-lock.json` and the
included Electron license files.
