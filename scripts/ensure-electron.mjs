// SPDX-FileCopyrightText: 2026 subeomlee
// SPDX-License-Identifier: GPL-2.0-only

import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

const require = createRequire(import.meta.url);
const { downloadArtifact } = require("@electron/get");
const run = promisify(execFile);
const electronRoot = dirname(require.resolve("electron/package.json"));
const packageJson = JSON.parse(
  await readFile(join(electronRoot, "package.json"), "utf8"),
);
const platformPath =
  process.platform === "darwin"
    ? "Electron.app/Contents/MacOS/Electron"
    : process.platform === "win32"
      ? "electron.exe"
      : process.platform === "linux"
        ? "electron"
        : null;
if (platformPath === null) {
  throw new Error(`unsupported Electron platform: ${process.platform}`);
}

const executable = join(electronRoot, "dist", platformPath);
try {
  await access(executable);
  process.exit(0);
} catch (error) {
  if (
    typeof error !== "object" ||
    error === null ||
    !("code" in error) ||
    error.code !== "ENOENT"
  ) {
    throw error;
  }
}

const checksums = JSON.parse(
  await readFile(join(electronRoot, "checksums.json"), "utf8"),
);
const zipPath = await downloadArtifact({
  version: packageJson.version,
  artifactName: "electron",
  platform: process.platform,
  arch: process.arch,
  checksums,
});
const dist = join(electronRoot, "dist");
await mkdir(dist, { recursive: true });
await run("tar", ["-xf", zipPath, "-C", dist], {
  windowsHide: true,
});
await writeFile(join(electronRoot, "path.txt"), platformPath);
