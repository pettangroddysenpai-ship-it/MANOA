const {
  app,
  Tray,
  Menu,
  BrowserWindow,
  ipcMain,
  shell,
  nativeImage,
  session,
  screen,
} = require('electron');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const extractZip = require('extract-zip');
const tar = require('tar');
const { createStaticServer } = require('./static-server');

const cfg = require('./config');

// ---------------------------------------------------------------------------
// Chemins
// ---------------------------------------------------------------------------
const isPackaged = app.isPackaged;
const ROOT = __dirname;
const webRoot = path.join(ROOT, 'resources');
const modelsDir = path.join(app.getPath('userData'), 'models');

let mascotImg;
for (const candidate of [
  path.join(webRoot, 'icons', 'tray.png'),
  path.join(ROOT, '..', 'MANOA.jpeg'),
  path.join(ROOT, '..', 'frontend', 'public', 'manoa.jpg'),
  path.join(ROOT, '..', '..', 'MANOA.jpeg'),
]) {
  if (fs.existsSync(candidate)) {
    try {
      const img = nativeImage.createFromPath(candidate);
      if (!img.isEmpty()) {
        mascotImg = img.resize({ width: 32, height: 32 });
        break;
      }
    } catch {
      /* ignore */
    }
  }
}

// Dossier du backend / frontend (dev = repo, installe = resources)
const devBackendDir = path.join(ROOT, '..', 'backend');
const devFrontendDir = path.join(ROOT, '..', 'frontend');
const packedBackendDir = path.join(process.resourcesPath, 'backend');
const packedFrontendDir = path.join(process.resourcesPath, 'frontend');

const userDataDir = app.getPath('userData');
const backendLog = path.join(userDataDir, 'backend.log');
const frontendLog = path.join(userDataDir, 'frontend.log');
const companionLog = path.join(userDataDir, 'companion.log');

const children = new Set();

// ---------------------------------------------------------------------------
// Logs
// ---------------------------------------------------------------------------
function log(msg) {
  const line = `[${new Date().toLocaleTimeString()}] ${msg}\n`;
  try {
    fs.appendFileSync(companionLog, line);
  } catch {
    /* ignore */
  }
  console.log(line.trimEnd());
}

// ---------------------------------------------------------------------------
// Etat
// ---------------------------------------------------------------------------
let tray = null;
let server = null;
let serverPort = 0;
let win = null;
let orbWin = null;
let listening = true;
let lastWake = 0;
let backendUp = false;
let frontendUp = false;

const appUrl = () =>
  isPackaged
    ? `http://127.0.0.1:${serverPort}`
    : `http://localhost:${cfg.frontendPort}`;

// ---------------------------------------------------------------------------
// Helpers reseau
// ---------------------------------------------------------------------------
function isUp(url, timeoutMs = 1200) {
  return fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
    .then((r) => r.ok || r.status < 500)
    .catch(() => false);
}

async function waitFor(url, timeoutMs, label) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isUp(url, 1500)) return true;
    await new Promise((r) => setTimeout(r, 600));
  }
  log(`Timeout en attendant ${label} (${url})`);
  return false;
}

async function downloadFile(url, dest, onProgress) {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status} pour ${url}`);
  const total = Number(res.headers.get('content-length')) || 0;
  let received = 0;
  const stream = Readable.fromWeb(res.body);
  stream.on('data', (chunk) => {
    received += chunk.length;
    if (onProgress && total) onProgress(received, total);
  });
  await pipeline(stream, fs.createWriteStream(dest));
}

// ---------------------------------------------------------------------------
// Modele Vosk : zip -> tar.gz (cached)
// ---------------------------------------------------------------------------
async function ensureModel() {
  const tarGz = path.join(modelsDir, `${cfg.modelName}.tar.gz`);
  if (fs.existsSync(tarGz) && fs.statSync(tarGz).size > 1_000_000) {
    log(`Modele deja pret : ${tarGz}`);
    return tarGz;
  }

  await fsp.mkdir(modelsDir, { recursive: true });
  const zipPath = path.join(modelsDir, `${cfg.modelName}.zip`);
  const tmp = path.join(modelsDir, `.tmp-${Date.now()}`);
  setTrayTooltip('MANOA : telechargement du modele vocal...');

  try {
    log(`Telechargement du modele ${cfg.modelName}...`);
    await downloadFile(cfg.modelUrl, zipPath, (got, total) => {
      const pct = Math.round((got / total) * 100);
      if (got % Math.max(1, Math.round(total / 20)) < 1024 * 1024 || pct === 100) {
        setTrayTooltip(`MANOA : modele ${pct}%...`);
      }
    });
    log('Modele telecharge. Extraction...');
    await extractZip(zipPath, { dir: tmp });
    const entries = await fsp.readdir(tmp);
    const modelFolder = entries.length === 1
      ? path.join(tmp, entries[0])
      : tmp;

    log('Creation du tar.gz pour vosk-browser...');
    await tar.c(
      { gzip: true, file: tarGz, cwd: modelFolder, portable: true },
      ['.'],
    );

    await fsp.rm(tmp, { recursive: true, force: true });
    await fsp.rm(zipPath, { force: true });
    log(`Modele pret : ${tarGz}`);
    return tarGz;
  } catch (err) {
    await fsp.rm(tmp, { recursive: true, force: true }).catch(() => {});
    await fsp.rm(zipPath, { force: true }).catch(() => {});
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Serveur statique local (page d'eveil + modele + frontend installe + proxy API)
// ---------------------------------------------------------------------------
function makeStaticServer() {
  return createStaticServer({
    modelsDir,
    isPackaged,
    packedFrontendDir,
    webRoot,
    backendPort: cfg.backendPort,
    log,
  });
}

// ---------------------------------------------------------------------------
// Fenetre cachee (audio + Vosk WASM + TTS)
// ---------------------------------------------------------------------------
function createWakeWindow() {
  win = new BrowserWindow({
    show: false,
    width: 420,
    height: 260,
    backgroundColor: '#0a0f1e',
    webPreferences: {
      preload: path.join(ROOT, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      spellcheck: false,
    },
  });
  win.webContents.on('render-process-gone', (_e, _d, reason) => {
    log(`Le processus de la fenetre d'eveil est mort (${reason}). Relance...`);
    setTimeout(createWakeWindow, 3000);
  });
  win.loadURL(`http://127.0.0.1:${serverPort}/wake.html?model=${cfg.modelName}`);
  win.webContents.setBackgroundThrottling(false);
}

// ---------------------------------------------------------------------------
// Compagnon flottant (orbe circulaire en bas a droite du bureau)
// ---------------------------------------------------------------------------
const ORB_SIZE = 112; // taille de la fenetre (l'image visible fait 72px)
const ORB_MARGIN = 24;

function notifyOrb(channel, payload) {
  if (orbWin && !orbWin.isDestroyed()) {
    orbWin.webContents.send(channel, payload);
  }
}

function createOrbWindow() {
  if (orbWin && !orbWin.isDestroyed()) return;
  const wa = screen.getPrimaryDisplay().workArea;
  orbWin = new BrowserWindow({
    x: wa.x + wa.width - ORB_SIZE - ORB_MARGIN,
    y: wa.y + wa.height - ORB_SIZE - ORB_MARGIN,
    width: ORB_SIZE,
    height: ORB_SIZE,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    skipTaskbar: true,
    hasShadow: false,
    alwaysOnTop: true,
    focusable: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(ROOT, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });
  orbWin.setAlwaysOnTop(true, 'floating');
  orbWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  orbWin.webContents.on('render-process-gone', (_e, _d, reason) => {
    log(`Le processus de l'orbe est mort (${reason}). Relance...`);
    try {
      orbWin.destroy();
    } catch {
      /* ignore */
    }
    orbWin = null;
    setTimeout(createOrbWindow, 3000);
  });
  orbWin.on('closed', () => {
    orbWin = null;
  });
  orbWin.loadURL(`http://127.0.0.1:${serverPort}/orb.html`);
  orbWin.webContents.setBackgroundThrottling(false);
  log(`Orbe affichee (${wa.x + wa.width - ORB_SIZE - ORB_MARGIN}, ${wa.y + wa.height - ORB_SIZE - ORB_MARGIN})`);
}

// ---------------------------------------------------------------------------
// Tray
// ---------------------------------------------------------------------------
function setTrayTooltip(text) {
  if (tray && !tray.isDestroyed()) tray.setToolTip(text);
}

function makeTrayIcon() {
  const ico = path.join(webRoot, 'icons', 'tray.ico');
  if (fs.existsSync(ico)) {
    const img = nativeImage.createFromPath(ico);
    if (!img.isEmpty()) return img;
  }
  if (mascotImg) return mascotImg;
  return nativeImage.createEmpty();
}

function buildTrayMenu() {
  return Menu.buildFromTemplate([
    {
      label: 'Ouvrir MANOA',
      click: () => openApp(),
    },
    {
      label: 'Démarrer l’application',
      click: () => ensureAppRunning().then(() => shell.openExternal(appUrl())),
    },
    { type: 'separator' },
    {
      label: 'Écoute vocale (réveil par mot-cle)',
      type: 'checkbox',
      checked: listening,
      click: (item) => setListening(item.checked),
    },
    {
      label: 'Lancer au démarrage de Windows',
      type: 'checkbox',
      checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => {
        app.setLoginItemSettings({ openAtLogin: item.checked });
      },
    },
    { type: 'separator' },
    {
      label: 'Quitter',
      click: () => app.quit(),
    },
  ]);
}

function setListening(on) {
  listening = on;
  if (win && !win.isDestroyed()) {
    win.webContents.send('set-enabled', on);
  }
  notifyOrb('orb-listening', on);
  setTrayTooltip(listening ? 'MANOA vous écoute' : 'MANOA en sourdine');
}

function createTray() {
  tray = new Tray(makeTrayIcon());
  tray.setToolTip('MANOA vous écoute');
  tray.setContextMenu(buildTrayMenu());
  tray.on('click', () => openApp());
  tray.on('double-click', () => openApp());
}

// ---------------------------------------------------------------------------
// Demarrage des services du projet
// ---------------------------------------------------------------------------
function spawnLogged(cmd, args, cwd, logFile) {
  let fd;
  try {
    fd = fs.openSync(logFile, 'a');
  } catch (err) {
    log(`Impossible d'ouvrir ${logFile}: ${err.message}`);
    return null;
  }
  let closed = false;
  const closeFd = () => {
    if (!closed) {
      closed = true;
      try {
        fs.closeSync(fd);
      } catch {
        /* ignore */
      }
    }
  };
  const child = spawn(cmd, args, {
    cwd,
    windowsHide: true,
    stdio: ['ignore', fd, fd],
  });
  child.on('error', (err) => {
    log(`Echec lancement de ${cmd} ${args[0]} : ${err.message}`);
    closeFd();
  });
  child.on('exit', (code) => {
    log(`${cmd} ${args[0]} -> code ${code}`);
    closeFd();
  });
  children.add(child);
  return child;
}

function nodeBinary() {
  if (isPackaged) {
    const bundled = path.join(process.resourcesPath, 'node', 'node.exe');
    if (fs.existsSync(bundled)) return bundled;
  }
  return 'node';
}

async function ensureBackend() {
  if (await isUp(`http://127.0.0.1:${cfg.backendPort}/api/health`)) {
    log('Backend deja demarre');
    return true;
  }
  const backendDir = isPackaged ? packedBackendDir : devBackendDir;
  if (!fs.existsSync(backendDir) || !fs.existsSync(path.join(backendDir, 'src', 'server.js'))) {
    log(`Backend introuvable dans ${backendDir}`);
    return false;
  }
  log('Demarrage du backend...');
  spawnLogged(nodeBinary(), ['src/server.js'], backendDir, backendLog);
  return waitFor(`http://127.0.0.1:${cfg.backendPort}/api/health`, 30000, 'backend');
}

async function ensureFrontend() {
  if (isPackaged) return true; // servi par notre serveur statique
  if (await isUp(`http://localhost:${cfg.frontendPort}`)) {
    log('Frontend deja demarre');
    return true;
  }
  if (!fs.existsSync(path.join(devFrontendDir, 'package.json'))) {
    log(`Frontend introuvable dans ${devFrontendDir}`);
    return false;
  }
  log('Demarrage du frontend (vite)...');
  spawnLogged(
    'cmd.exe',
    ['/d', '/s', '/c', `npm run dev -- --port ${cfg.frontendPort}`],
    devFrontendDir,
    frontendLog,
  );
  return waitFor(`http://localhost:${cfg.frontendPort}`, 45000, 'frontend');
}

async function ensureAppRunning() {
  backendUp = await ensureBackend();
  frontendUp = await ensureFrontend();
  return backendUp && frontendUp;
}

// ---------------------------------------------------------------------------
// Action "ouvrir MANOA"
// ---------------------------------------------------------------------------
async function openApp() {
  const now = Date.now();
  if (now - lastWake < 1500) return; // debounce clic + voix
  lastWake = now;

  try {
    showBalloon('Je vous écoute', "Ouverture de l'application...");
    await ensureAppRunning();
  } catch (err) {
    log(`Echec demarrage: ${err.message}`);
  }
  shell.openExternal(appUrl()).catch((e) => log(`openExternal: ${e.message}`));
}

function showBalloon(title, content) {
  try {
    tray.displayBalloon({ iconType: 'info', title, content });
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// IPC
// ---------------------------------------------------------------------------
ipcMain.on('wake-word', (_e, word) => {
  log(`Mot d'eveil detecte : ${word || '?'}`);
  notifyOrb('orb-wake', word);
  openApp();
});

ipcMain.on('open-app', () => {
  openApp();
});

ipcMain.on('error', (_e, msg) => {
  log(`Erreur renderer : ${msg}`);
  showBalloon('MANOA', 'Une erreur est survenue (voir les logs).');
});

ipcMain.on('log', (_e, msg) => {
  if (msg) log(`[renderer] ${msg}`);
});

ipcMain.on('model-status', (_e, msg) => {
  log(`[modele] ${msg}`);
  setTrayTooltip(`MANOA : ${msg}`);
  notifyOrb('orb-status', `MANOA : ${msg}`);
});

ipcMain.on('listening', (_e, on) => {
  listening = on;
  notifyOrb('orb-listening', on);
});

// ---------------------------------------------------------------------------
// Demarrage
// ---------------------------------------------------------------------------
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => openApp());

  app.on('before-quit', () => {
    for (const child of children) {
      try {
        child.kill();
      } catch {
        /* ignore */
      }
    }
  });

  app.whenReady().then(async () => {
    // Autoriser l'acces micro dans la fenetre cachee
    session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => {
      cb(permission === 'media');
    });
    session.defaultSession.setPermissionCheckHandler((_wc, permission) => {
      return permission === 'media';
    });
    session.defaultSession.setDevicePermissionHandler(() => true);

    createTray();

    // Demarrage du serveur local
    server = makeStaticServer();
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    serverPort = server.address().port;
    log(`Serveur local pret sur http://127.0.0.1:${serverPort}`);

    // Compagnon flottant (orbe) tout de suite
    createOrbWindow();

    // Modele Vosk en arriere-plan
    ensureModel()
      .then(() => {
        log('Modele pret, demarrage de l\'ecoute...');
        setTrayTooltip('MANOA vous écoute');
        createWakeWindow();
      })
      .catch((err) => {
        log(`Echec du modele Vosk : ${err.message}`);
        setTrayTooltip('MANOA : modele vocal indisponible');
        showBalloon(
          'MANOA',
          'Impossible de préparer le modèle vocal. Lancez l’application pour chatter.',
        );
        createWakeWindow(); // la page affichera l'erreur elle-meme
      });

    // Demarrer le backend au lancement (pour que l'app soit prete)
    ensureBackend().then((ok) => {
      log(ok ? 'Backend pret au lancement' : 'Backend non demarre au lancement');
    });
  });
}

// ---------------------------------------------------------------------------
// Gestion de l'arret
// ---------------------------------------------------------------------------
app.on('window-all-closed', () => {
  // l'application reste en tray : on ne quitte pas
});
