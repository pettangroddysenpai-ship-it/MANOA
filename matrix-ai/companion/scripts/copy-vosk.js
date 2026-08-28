// Copie le moteur Vosk (WASM + worker inline) depuis node_modules vers resources/
const fs = require('node:fs');
const path = require('node:path');

const src = path.join(__dirname, '..', 'node_modules', 'vosk-browser', 'dist', 'vosk.js');
const dest = path.join(__dirname, '..', 'resources', 'vosk.js');

if (!fs.existsSync(src)) {
  console.error('vosk.js introuvable dans node_modules. Lancez "npm install" d\x27abord.');
  process.exit(1);
}
fs.copyFileSync(src, dest);
console.log('vosk.js copie vers resources/vosk.js (' + (fs.statSync(dest).size / 1024 / 1024).toFixed(1) + ' Mo)');
