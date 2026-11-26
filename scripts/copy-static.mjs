// SPDX-FileCopyrightText: 2026 subeomlee
// SPDX-License-Identifier: GPL-2.0-only

import { cp, copyFile, mkdir } from "node:fs/promises";

await mkdir("dist/renderer", { recursive: true });
await mkdir("dist/legal", { recursive: true });
await Promise.all([
  copyFile("src/renderer/index.html", "dist/renderer/index.html"),
  copyFile("src/renderer/index.css", "dist/renderer/index.css"),
  cp("src/renderer/assets", "dist/renderer/assets", {
    recursive: true,
    force: true,
  }),
  cp("src/main/assets", "dist/main/assets", {
    recursive: true,
    force: true,
  }),
  copyFile("LICENSE", "dist/legal/LICENSE"),
  copyFile("NOTICE", "dist/legal/NOTICE"),
  copyFile("PRIVACY.md", "dist/legal/PRIVACY.md"),
  copyFile("THIRD_PARTY_NOTICES.md", "dist/legal/THIRD_PARTY_NOTICES.md"),
]);
