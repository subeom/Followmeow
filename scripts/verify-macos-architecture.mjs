// SPDX-FileCopyrightText: 2026 subeomlee
// SPDX-License-Identifier: GPL-2.0-only

import { open, readdir } from "node:fs/promises";
import { join } from "node:path";

const requested = process.argv[2];
if (requested !== "x64" && requested !== "arm64") {
  throw new Error("usage: node scripts/verify-macos-architecture.mjs <x64|arm64>");
}

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      results.push(...await files(path));
    } else if (
      entry.isFile() &&
      path.endsWith("Followmeow.app/Contents/MacOS/Followmeow")
    ) {
      results.push(path);
    }
  }
  return results;
}

const executables = (await files("release")).filter((path) => {
  const normalized = path.replaceAll("\\", "/");
  return (
  requested === "arm64"
      ? normalized.includes("/mac-arm64/")
      : normalized.includes("/mac/")
  );
});
if (executables.length !== 1) {
  throw new Error(`expected one macOS executable, found ${executables.length}`);
}

const executable = executables[0];
const handle = await open(executable, "r");
const header = Buffer.alloc(8);
try {
  const { bytesRead } = await handle.read(header, 0, header.length, 0);
  if (bytesRead !== header.length) {
    throw new Error("Mach-O header is truncated");
  }
} finally {
  await handle.close();
}
const magic = header.subarray(0, 4).toString("hex");
const cpuType =
  magic === "cffaedfe"
    ? header.readUInt32LE(4)
    : magic === "feedfacf"
      ? header.readUInt32BE(4)
      : 0;
const architecture =
  cpuType === 0x01000007
    ? "x64"
    : cpuType === 0x0100000c
      ? "arm64"
      : `unknown-cpu-${cpuType.toString(16)}`;
if (architecture !== requested) {
  throw new Error(
    `Mach-O architecture ${architecture} does not match requested ${requested}`,
  );
}
console.log(`${executable}: ${architecture}`);
