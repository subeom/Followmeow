import { mkdir, writeFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";

const WIDTH = 32;
const HEIGHT = 32;

const rgba = (hex, alpha = 255) => [
  Number.parseInt(hex.slice(1, 3), 16),
  Number.parseInt(hex.slice(3, 5), 16),
  Number.parseInt(hex.slice(5, 7), 16),
  alpha,
];
const OUTLINE = rgba("#A7ACB3");
const FUR = rgba("#FAF8F1");

function canvas() {
  return Buffer.alloc(WIDTH * HEIGHT * 4);
}

function pixel(buffer, x, y, color) {
  const px = Math.round(x);
  const py = Math.round(y);
  if (px < 0 || py < 0 || px >= WIDTH || py >= HEIGHT) {
    return;
  }
  const index = (py * WIDTH + px) * 4;
  buffer.set(color, index);
}

function ellipse(buffer, cx, cy, radiusX, radiusY, color) {
  for (let y = Math.floor(cy - radiusY); y <= Math.ceil(cy + radiusY); y += 1) {
    for (let x = Math.floor(cx - radiusX); x <= Math.ceil(cx + radiusX); x += 1) {
      if (((x - cx) / radiusX) ** 2 + ((y - cy) / radiusY) ** 2 <= 1) {
        pixel(buffer, x, y, color);
      }
    }
  }
}

function line(buffer, x0, y0, x1, y1, thickness, color) {
  const length = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let step = 0; step <= length; step += 1) {
    const x = x0 + ((x1 - x0) * step) / length;
    const y = y0 + ((y1 - y0) * step) / length;
    ellipse(buffer, x, y, thickness, thickness, color);
  }
}

function triangle(buffer, a, b, c, color) {
  const points = [a, b, c];
  const minY = Math.floor(Math.min(...points.map((point) => point[1])));
  const maxY = Math.ceil(Math.max(...points.map((point) => point[1])));
  const crosses = (aPoint, bPoint, point) =>
    (point[0] - bPoint[0]) * (aPoint[1] - bPoint[1]) -
    (aPoint[0] - bPoint[0]) * (point[1] - bPoint[1]);
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = 5; x <= 31; x += 1) {
      const p = [x, y];
      const values = [
        crosses(a, b, p),
        crosses(b, c, p),
        crosses(c, a, p),
      ];
      if (
        !values.some((value) => value < 0) ||
        !values.some((value) => value > 0)
      ) {
        pixel(buffer, x, y, color);
      }
    }
  }
}

function cat(disabled) {
  const buffer = canvas();
  line(buffer, 11, 21, 5, 18, 2, OUTLINE);
  line(buffer, 5, 18, 5, 14, 2, OUTLINE);
  line(buffer, 5, 14, 8, 15, 1.5, FUR);
  ellipse(buffer, 16, 19, 9, 6.5, OUTLINE);
  ellipse(buffer, 16, 18.5, 8, 5.2, FUR);
  ellipse(buffer, 26, 13.5, 4.7, 4.7, OUTLINE);
  ellipse(buffer, 26, 14, 3.7, 3.7, FUR);
  triangle(buffer, [23, 11], [24, 6], [26, 11], FUR);
  triangle(buffer, [27, 11], [30, 7], [30, 13], FUR);
  line(buffer, 12, 23, 11, 28, 1.8, OUTLINE);
  line(buffer, 21, 22, 21, 28, 1.8, OUTLINE);
  line(buffer, 10, 28, 14, 28, 1, OUTLINE);
  line(buffer, 20, 28, 24, 28, 1, OUTLINE);
  if (disabled) {
    for (let index = 3; index < buffer.length; index += 4) {
      buffer[index] = Math.round(buffer[index] * 0.45);
    }
  }
  return buffer;
}

function chunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const payload = Buffer.concat([name, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(payload));
  return Buffer.concat([length, payload, crc]);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function png(buffer) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(WIDTH, 0);
  header.writeUInt32BE(HEIGHT, 4);
  header[8] = 8;
  header[9] = 6;
  const scanlines = Buffer.alloc((WIDTH * 4 + 1) * HEIGHT);
  for (let y = 0; y < HEIGHT; y += 1) {
    const target = y * (WIDTH * 4 + 1);
    scanlines[target] = 0;
    buffer.copy(scanlines, target + 1, y * WIDTH * 4, (y + 1) * WIDTH * 4);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(scanlines)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

await mkdir("src/main/assets", { recursive: true });
await Promise.all([
  writeFile("src/main/assets/tray.png", png(cat(false))),
  writeFile("src/main/assets/tray-disabled.png", png(cat(true))),
]);
