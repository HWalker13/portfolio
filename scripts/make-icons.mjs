/*
  Raster icons from public/favicon.svg (the SVG itself is what modern browsers use):
    public/favicon.ico          16, 32, 48 px (for clients that still ask for /favicon.ico)
    public/apple-touch-icon.png 180 px, record on the rug green (iOS fills transparency with black)
  Run: npm run icons
*/
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';

const svg = readFileSync('public/favicon.svg');
const png = (size) => sharp(svg, { density: 72 * (size / 32) * 2 }).resize(size, size).png().toBuffer();

// ICO container holding PNG images (supported by every browser since Vista-era IE).
const sizes = [16, 32, 48];
const images = await Promise.all(sizes.map(png));
const header = Buffer.alloc(6 + 16 * images.length);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(images.length, 4);
let offset = header.length;
images.forEach((img, i) => {
  const e = 6 + i * 16;
  header.writeUInt8(sizes[i] % 256, e); // width
  header.writeUInt8(sizes[i] % 256, e + 1); // height
  header.writeUInt8(0, e + 2); // palette
  header.writeUInt8(0, e + 3); // reserved
  header.writeUInt16LE(1, e + 4); // planes
  header.writeUInt16LE(32, e + 6); // bits per pixel
  header.writeUInt32LE(img.length, e + 8);
  header.writeUInt32LE(offset, e + 12);
  offset += img.length;
});
writeFileSync('public/favicon.ico', Buffer.concat([header, ...images]));

const record = await sharp(svg, { density: 72 * (140 / 32) * 2 }).resize(140, 140).png().toBuffer();
await sharp({ create: { width: 180, height: 180, channels: 4, background: '#2f4a23' } })
  .composite([{ input: record, left: 20, top: 20 }])
  .png()
  .toFile('public/apple-touch-icon.png');

console.log('public/favicon.ico, public/apple-touch-icon.png');
