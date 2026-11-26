import { open, readdir } from "node:fs/promises";
import { join } from "node:path";

const requested = process.argv[2];
if (requested !== "x64" && requested !== "arm64") {
  throw new Error("usage: node scripts/verify-pe-architecture.mjs <x64|arm64>");
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
      entry.name === "Followmeow.exe" &&
      /win(?:-arm64)?-unpacked/.test(path)
    ) {
      results.push(path);
    }
  }
  return results;
}

const expectedMachine = requested === "x64" ? 0x8664 : 0xaa64;
const directoryMarker =
  requested === "arm64" ? "/win-arm64-unpacked/" : "/win-unpacked/";
const executables = (await files("release")).filter((path) =>
  path.replaceAll("\\", "/").includes(directoryMarker),
);
if (executables.length !== 1) {
  throw new Error(`expected one PE executable, found ${executables.length}`);
}

const executable = executables[0];
const handle = await open(executable, "r");
const header = Buffer.alloc(4 * 1024);
try {
  const { bytesRead } = await handle.read(header, 0, header.length, 0);
  if (bytesRead < 0x40) {
    throw new Error("PE header is truncated");
  }
} finally {
  await handle.close();
}
if (header.subarray(0, 2).toString("ascii") !== "MZ") {
  throw new Error("missing MZ header");
}
const peOffset = header.readUInt32LE(0x3c);
if (peOffset + 8 > header.length) {
  throw new Error("PE signature offset exceeds the inspected header");
}
if (header.subarray(peOffset, peOffset + 4).toString("hex") !== "50450000") {
  throw new Error("missing PE signature");
}
const machine = header.readUInt16LE(peOffset + 4);
if (machine !== expectedMachine) {
  throw new Error(
    `PE machine 0x${machine.toString(16)} does not match ${requested}`,
  );
}
console.log(`${executable}: ${requested}`);
