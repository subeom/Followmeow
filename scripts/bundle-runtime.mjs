// SPDX-FileCopyrightText: 2026 subeomlee
// SPDX-License-Identifier: GPL-2.0-only

import { build } from "esbuild";
import { mkdir } from "node:fs/promises";

await Promise.all([
  mkdir("dist/renderer", { recursive: true }),
  mkdir("dist/preload", { recursive: true }),
]);

await Promise.all([
  build({
    entryPoints: ["src/renderer/index.ts"],
    outfile: "dist/renderer/index.bundle.js",
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["chrome124"],
    charset: "utf8",
    legalComments: "inline",
  }),
  build({
    entryPoints: ["src/preload/index.ts"],
    outfile: "dist/preload/index.bundle.cjs",
    bundle: true,
    format: "cjs",
    platform: "node",
    target: ["node22"],
    external: ["electron"],
    charset: "utf8",
    legalComments: "inline",
  }),
]);
