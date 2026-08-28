// Genere l'image circulaire du compagnon flottant (resources/orb.png)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Jimp from 'jimp';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');

const sources = [
  path.join(root, '..', '..', 'MANOA.jpeg'),
  path.join(root, '..', 'frontend', 'public', 'manoa.jpg'),
  path.join(root, '..', 'MANOA.jpeg'),
  path.join(root, 'resources', 'icons', 'icon-256.png'),
];

const src = sources.find((p) => fs.existsSync(p));
if (!src) {
  console.error('Image de la mascotte introuvable (MANOA.jpeg).');
  process.exit(1);
}

const SIZE = 256;

async function main() {
  const base = await Jimp.read(src);
  const w = base.bitmap.width;
  const h = base.bitmap.height;
  const scale = Math.max(SIZE / w, SIZE / h);
  const cw = Math.round(w * scale);
  const ch = Math.round(h * scale);
  const img = base.clone().resize(cw, ch).crop(
    Math.round((cw - SIZE) / 2),
    Math.round((ch - SIZE) / 2),
    SIZE,
    SIZE,
  );

  const mask = await Jimp.create(SIZE, SIZE, 0x00000000);
  const circle = await Jimp.create(SIZE, SIZE, 0xffffffff);
  circle.scan(0, 0, SIZE, SIZE, function (x, y) {
    const dx = x - SIZE / 2;
    const dy = y - SIZE / 2;
    const outside = dx * dx + dy * dy > (SIZE / 2) * (SIZE / 2);
    if (outside) this.setPixelColor(0x00000000, x, y);
  });
  mask.composite(circle, 0, 0);

  img.mask(mask, 0, 0);
  const out = path.join(root, 'resources', 'orb.png');
  await img.quality(92).writeAsync(out);
  console.log('orb.png genere ->', out, `(${(fs.statSync(out).size / 1024).toFixed(1)} Ko)`);
}

main().catch((e) => {
  console.error('Echec generation orb :', e);
  process.exit(1);
});
