const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.tar.gz': 'application/gzip',
  '.gz': 'application/gzip',
  '.map': 'application/json',
};

function sendFile(res, filePath, contentType) {
  fs.stat(filePath, (err, st) => {
    if (err || st.isDirectory()) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': contentType || MIME[path.extname(filePath)] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': 'no-cache',
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

function proxyApi(req, res, backendPort) {
  const target = `http://127.0.0.1:${backendPort}${req.url}`;
  const headers = { ...req.headers, host: `127.0.0.1:${backendPort}` };
  const proxy = http.request(target, { method: req.method, headers }, (up) => {
    res.writeHead(up.statusCode || 502, up.headers);
    up.pipe(res);
  });
  proxy.on('error', () => {
    res.writeHead(502);
    res.end('{"error":"Backend indisponible"}');
  });
  req.pipe(proxy);
}

const LOCAL_ASSETS = new Set([
  '/wake.html',
  '/vosk.js',
  '/recognizer-processor.js',
  '/orb.html',
  '/orb.js',
  '/orb.png',
]);

function serveFrom(webRoot, res, urlPath, contentType) {
  const rel = urlPath.replace(/^\/+/, '');
  const f = path.join(webRoot, path.normalize(rel));
  if (!f.startsWith(webRoot)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  sendFile(res, f, contentType);
}

function createStaticServer(opts) {
  const {
    modelsDir,
    isPackaged,
    packedFrontendDir,
    webRoot,
    backendPort,
    log = () => {},
  } = opts;

  return http.createServer((req, res) => {
    let p;
    try {
      p = decodeURIComponent(new URL(req.url, 'http://local').pathname);
    } catch (e) {
      res.writeHead(400);
      res.end('Bad request');
      return;
    }

    try {
      // Modele Vosk (page d'eveil) - toujours depuis userData
      if (p.startsWith('/models/')) {
        const file = path.join(modelsDir, path.basename(p));
        sendFile(res, file, 'application/gzip');
        return;
      }

      // Assets de la page d'eveil / de l'orbe - toujours depuis resources (aussi en mode installe)
      if (LOCAL_ASSETS.has(p)) {
        serveFrom(webRoot, res, p);
        return;
      }

      if (isPackaged) {
        if (p.startsWith('/api/')) {
          proxyApi(req, res, backendPort);
          return;
        }
        let f = path.join(packedFrontendDir, p === '/' ? 'index.html' : p);
        fs.stat(f, (err, st) => {
          if (err || st.isDirectory()) {
            sendFile(res, path.join(packedFrontendDir, 'index.html'));
          } else {
            sendFile(res, f);
          }
        });
        return;
      }

      // Dev : '/' = page d'eveil, sinon fichiers statiques de resources
      serveFrom(webRoot, res, p === '/' ? 'wake.html' : p);
    } catch (e) {
      log(`Erreur serveur: ${e.message}`);
      res.writeHead(500);
      res.end('Internal error');
    }
  });
}

module.exports = { createStaticServer, sendFile, MIME };
