import { cp, copyFile, mkdir } from "node:fs/promises";

await mkdir("dist/renderer", { recursive: true });
await Promise.all([
  copyFile("src/renderer/index.html", "dist/renderer/index.html"),
  copyFile("src/renderer/index.css", "dist/renderer/index.css"),
  cp("src/renderer/assets", "dist/renderer/assets", {
    recursive: true,
    force: true,
  }),
]);
