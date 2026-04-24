import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const SOURCE = "public/icons/vyou-mark.svg";
const TARGETS = [
  { size: 192, out: "public/icons/icon-192.png" },
  { size: 512, out: "public/icons/icon-512.png" },
  { size: 180, out: "public/icons/apple-touch-icon.png" },
  { size: 512, out: "public/icons/icon-512-maskable.png", padding: 48 },
];

for (const { size, out, padding = 0 } of TARGETS) {
  await mkdir(dirname(out), { recursive: true });
  const inner = size - padding * 2;
  let img = sharp(SOURCE).resize(inner, inner);
  if (padding > 0) {
    img = img.extend({
      top: padding,
      bottom: padding,
      left: padding,
      right: padding,
      background: { r: 15, g: 17, b: 21, alpha: 1 },
    });
  }
  await img.png({ compressionLevel: 9 }).toFile(out);
  console.log(`wrote ${out} (${size}x${size})`);
}
