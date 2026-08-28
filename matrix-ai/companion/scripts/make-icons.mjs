// Genere les icones MANOA (png multiples + tray.ico + icon.ico electron-builder)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Jimp from 'jimp';
import pngToIco from 'png-to-ico';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');

const sources = [
  path.join(root, '..', '..', 'MANOA.jpeg'),
  path.join(root, '..', 'frontend', 'public', 'manoa.jpg'),
  path.join(root, '..', 'MANOA.jpeg'),
];

const src = sources.find((p) => fs.existsSync(p));
if (!src) {
  console.error('Image du mascotte introuvable (MANOA.jpeg).');
  process.exit(1);
}

const iconsDir = path.join(root, 'resources', 'icons');
const buildDir = path.join(root, 'build');
fs.mkdirSync(iconsDir, { recursive: true });
fs.mkdirSync(buildDir, { recursive: true });

const SIZES = [16, 24, 32, 48, 64, 128, 256, 512];

function coverScale(imgW, imgH, size) {
  const scale = Math.max(size / imgW, size / imgH);
  return { w: Math.round(imgW * scale), h: Math.round(imgH * scale) };
}

async function main() {
  const base = await Jimp.read(src);
  const baseW = base.bitmap.width;
  const baseH = base.bitmap.height;

  const pngFiles = [];
  for (const size of SIZES) {
    const { w, h } = coverScale(baseW, baseH, size);
    const img = base.clone().resize(w, h);
    const x = Math.round((w - size) / 2);
    const y = Math.round((h - size) / 2);
    img.crop(x, y, size, size);
    const out = path.join(iconsDir, `icon-${size}.png`);
    await img.quality(92).writeAsync(out);
    pngFiles.push({ size, out });
    console.log('icone', size, 'px ->', out);
  }

  fs.copyFileSync(path.join(iconsDir, 'icon-32.png'), path.join(iconsDir, 'tray.png'));

  const ico = await pngToIco(
    [16, 24, 32, 48, 64, 128, 256].map(
      (s) => fs.readFileSync(path.join(iconsDir, `icon-${s}.png`)),
    ),
  );
  fs.writeFileSync(path.join(iconsDir, 'tray.ico'), ico);
  fs.writeFileSync(path.join(buildDir, 'icon.ico'), ico);
  console.log('tray.ico + build/icon.ico generes');
}

main().catch((e) => {
  console.error('Echec generation icones :', e);
  process.exit(1);
});
