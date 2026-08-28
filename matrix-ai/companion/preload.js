const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('manoa', {
  // le renderer a detecte un mot d'eveil
  wake: (word) => ipcRenderer.send('wake-word', word),
  error: (msg) => ipcRenderer.send('error', msg),
  log: (msg) => ipcRenderer.send('log', msg),
  modelStatus: (msg) => ipcRenderer.send('model-status', msg),
  listening: (on) => ipcRenderer.send('listening', on),

  // commandes recues du main (tray)
  onSetEnabled: (cb) =>
    ipcRenderer.on('set-enabled', (_e, value) => cb(value)),
  onSpeak: (cb) => ipcRenderer.on('speak', (_e, text) => cb(text)),

  // compagnon flottant (orbe)
  openApp: () => ipcRenderer.send('open-app'),
  onListening: (cb) => ipcRenderer.on('orb-listening', (_e, value) => cb(value)),
  onWake: (cb) => ipcRenderer.on('orb-wake', (_e, word) => cb(word)),
  onStatus: (cb) => ipcRenderer.on('orb-status', (_e, msg) => cb(msg)),
});
