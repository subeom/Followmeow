// SPDX-FileCopyrightText: 2026 subeomlee
// SPDX-License-Identifier: GPL-2.0-only

import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile, readdir, stat } from "node:fs/promises";
import { promisify } from "node:util";
import { join } from "node:path";

const run = promisify(execFile);
const platform = process.argv[2];
const expectedSourceHash =
  "41d6270158ed148695f525256af8ae4e6091a8a5445305bd6e17262d7ee2eda4";
const source = await readFile("build/icon.png");
const sourceHash = createHash("sha256").update(source).digest("hex");
if (sourceHash !== expectedSourceHash) {
  throw new Error(`unexpected icon source hash: ${sourceHash}`);
}

function pngDimensions(buffer) {
  if (buffer.length < 24 || buffer.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
    return null;
  }
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function pngsInIcns(buffer) {
  if (buffer.subarray(0, 4).toString("ascii") !== "icns") {
    throw new Error("invalid ICNS signature");
  }
  const result = [];
  let offset = 8;
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset + 4);
    if (length < 8 || offset + length > buffer.length) {
      throw new Error("invalid ICNS chunk length");
    }
    const data = buffer.subarray(offset + 8, offset + length);
    const dimensions = pngDimensions(data);
    if (dimensions) {
      result.push({ dimensions, data });
    }
    offset += length;
  }
  return result;
}

function pngsInIco(buffer) {
  if (buffer.length < 6 || buffer.readUInt16LE(0) !== 0 || buffer.readUInt16LE(2) !== 1) {
    throw new Error("invalid ICO signature");
  }
  const count = buffer.readUInt16LE(4);
  const result = [];
  for (let index = 0; index < count; index += 1) {
    const entry = 6 + index * 16;
    const length = buffer.readUInt32LE(entry + 8);
    const offset = buffer.readUInt32LE(entry + 12);
    if (offset + length > buffer.length) {
      throw new Error("invalid ICO entry range");
    }
    const data = buffer.subarray(offset, offset + length);
    const dimensions = pngDimensions(data);
    if (dimensions) {
      result.push({ dimensions, data });
    }
  }
  return result;
}

async function appIconFiles() {
  const results = [];
  const root = await readdir("release", { withFileTypes: true });
  for (const entry of root) {
    if (
      entry.isDirectory() &&
      (entry.name === "mac" || entry.name === "mac-arm64")
    ) {
      const path = join(
        "release",
        entry.name,
        "Followmeow.app",
        "Contents",
        "Resources",
        "icon.icns",
      );
      try {
        if ((await stat(path)).isFile()) {
          results.push(path);
        }
      } catch (error) {
        if (error?.code !== "ENOENT") {
          throw error;
        }
      }
    }
  }
  return results;
}

if (platform === "mac") {
  const generated = await readFile("release/.icon-icns/icon.icns");
  const frames = pngsInIcns(generated);
  const largest = Math.max(
    0,
    ...frames.map(({ dimensions }) => dimensions.width),
  );
  if (largest < 1024) {
    throw new Error(`generated ICNS largest PNG is only ${largest}px`);
  }
  const packagedIcons = await appIconFiles();
  if (packagedIcons.length < 1) {
    throw new Error("no packaged mac icon found");
  }
  for (const packagedIcon of packagedIcons) {
    const packaged = await readFile(packagedIcon);
    if (!packaged.equals(generated)) {
      throw new Error(`${packagedIcon} differs from generated icon.icns`);
    }
    const plistPath = join(packagedIcon, "..", "..", "Info.plist");
    const { stdout } = await run("plutil", [
      "-extract",
      "CFBundleIconFile",
      "raw",
      "-o",
      "-",
      plistPath,
    ]);
    if (stdout.trim() !== "icon.icns") {
      throw new Error(`unexpected CFBundleIconFile: ${stdout.trim()}`);
    }
  }
  console.log(
    `${packagedIcons.length} packaged icon file(s): ${largest}px source-derived ICNS`,
  );
} else if (platform === "win") {
  const generated = await readFile("release/.icon-ico/icon.ico");
  const frames = pngsInIco(generated);
  const largest = frames.reduce(
    (current, frame) =>
      frame.dimensions.width > current.dimensions.width ? frame : current,
    frames[0],
  );
  if (!largest || largest.dimensions.width !== 256) {
    throw new Error("generated ICO must contain its 256px PNG representation");
  }
  const executablePaths = [
    "release/win-unpacked/Followmeow.exe",
    "release/win-arm64-unpacked/Followmeow.exe",
  ];
  let checked = 0;
  for (const executablePath of executablePaths) {
    try {
      const executable = await readFile(executablePath);
      if (executable.indexOf(largest.data) < 0) {
        throw new Error(`${executablePath} does not embed the generated icon PNG`);
      }
      checked += 1;
    } catch (error) {
      if (error?.code !== "ENOENT") {
        throw error;
      }
    }
  }
  if (checked < 1) {
    throw new Error("no packaged Windows executable found");
  }
  console.log(`release Windows executable: embedded ${largest.dimensions.width}px icon`);
} else {
  throw new Error("usage: node scripts/verify-packaged-icons.mjs <mac|win>");
}
