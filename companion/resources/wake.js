// Fenetre cachee MANOA : detection de mot d'eveil (Vosk WASM) + reponse vocale.
// Utilise vosk-browser (https://github.com/ccoreilly/vosk-browser).

const $dot = document.getElementById('dot');
const $sub = document.getElementById('sub');

const COOLDOWN_MS = 9000;
const WAKE_RE = /\b(manoa|mana|mano|matrice|matris|matrix(?:\s+ai)?)\b|\bman\b/;

let ctx = null;
let stream = null;
let sourceNode = null;
let processor = null;
let channel = null;
let model = null;
let rec = null;
let enabled = true;
let cooldownUntil = 0;
let frenchVoice = null;

function status(state, text) {
  $dot.className = `dot ${state}`;
  $sub.textContent = text;
  manoa.log(text);
}

function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchWakeWord(text) {
  const t = normalize(text);
  if (!t) return null;
  const m = t.match(WAKE_RE);
  return m ? m[0] : null;
}

function pickVoice() {
  const voices = window.speechSynthesis ? speechSynthesis.getVoices() : [];
  return (
    voices.find((v) => v.lang && v.lang.toLowerCase().startsWith('fr')) ||
    voices[0] ||
    null
  );
}

function speak(text) {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) {
      resolve();
      return;
    }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'fr-FR';
    u.rate = 1.0;
    const v = frenchVoice || pickVoice();
    if (v) u.voice = v;
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        resolve();
      }
    };
    u.onend = finish;
    u.onerror = finish;
    speechSynthesis.speak(u);
    setTimeout(finish, 9000);
  });
}

function setMic(on) {
  if (!ctx || !stream) return;
  if (on) {
    if (!sourceNode) {
      sourceNode = ctx.createMediaStreamSource(stream);
      sourceNode.connect(processor);
    }
  } else if (sourceNode) {
    try {
      sourceNode.disconnect();
    } catch {
      /* ignore */
    }
    sourceNode = null;
  }
}

function createRecognizer() {
  if (!model || !processor) return;
  if (rec) {
    try {
      rec.remove();
    } catch {
      /* ignore */
    }
  }
  rec = new model.KaldiRecognizer(16000);
  rec.on('partialresult', (m) => handleText(m && m.result && m.result.partial));
  rec.on('result', (m) => handleText(m && m.result && m.result.text));
  processor.port.postMessage({ action: 'init', recognizerId: rec.id });
}

function handleText(text) {
  if (!text || Date.now() < cooldownUntil) return;
  const word = matchWakeWord(text);
  if (word) triggerWake(word);
}

async function triggerWake(word) {
  cooldownUntil = Date.now() + COOLDOWN_MS;
  setMic(false);
  manoa.listening(false);
  status('ok', 'Réveil détecté : « ' + word + ' »');

  // Notifie le main : il demarre les services et ouvre le navigateur
  manoa.wake(word);

  const greetings = [
    'Oui, je vous écoute.',
    'Oui ? MANOA est là.',
    'Je vous écoute. J’ouvre l’application.',
  ];
  await speak(greetings[Math.floor(Math.random() * greetings.length)]);

  // petite pause puis on re-ecoute sur un reconnaisseur neuf
  setTimeout(() => {
    createRecognizer();
    if (enabled) {
      setMic(true);
      manoa.listening(true);
      status('ok', 'Prêt — dites MANOA, MAN ou MATRIX');
    }
  }, 3500);
}

async function init() {
  if (!('mediaDevices' in navigator)) {
    status('err', 'Micro non disponible dans cet environnement');
    manoa.error('mediaDevices indisponible');
    return;
  }

  const modelName =
    new URLSearchParams(location.search).get('model') || 'vosk-model-small-fr-0.22';

  try {
    status('', 'Chargement du modèle vocal… (première fois : quelques instants)');
    model = await Vosk.createModel(`models/${modelName}.tar.gz`);
    manoa.modelStatus('Modèle vocal chargé');
  } catch (e) {
    status('err', 'Échec du chargement du modèle vocal');
    manoa.modelStatus('Modèle vocal indisponible');
    manoa.error(String((e && e.message) || e));
    return;
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        channelCount: 1,
        sampleRate: 16000,
      },
    });
  } catch (e) {
    status('err', 'Accès au micro refusé');
    manoa.modelStatus('Micro inaccessible');
    manoa.error('getUserMedia : ' + String((e && e.message) || e));
    return;
  }

  channel = new MessageChannel();
  model.registerPort(channel.port1);

  ctx = new AudioContext({ sampleRate: 16000 });
  await ctx.audioWorklet.addModule('recognizer-processor.js');

  processor = new AudioWorkletNode(ctx, 'recognizer-processor', {
    channelCount: 1,
    numberOfInputs: 1,
    numberOfOutputs: 1,
  });
  processor.connect(ctx.destination);
  sourceNode = ctx.createMediaStreamSource(stream);
  sourceNode.connect(processor);

  createRecognizer();
  processor.port.postMessage(
    { action: 'init', recognizerId: rec.id },
    [channel.port2],
  );

  if ('speechSynthesis' in window) {
    speechSynthesis.addEventListener('voiceschanged', () => {
      frenchVoice = pickVoice();
    });
    frenchVoice = pickVoice();
  }

  manoa.listening(true);
  status('ok', 'Prêt — dites MANOA, MAN ou MATRIX');
}

// Commandes du tray (activer/desactiver l'ecoute)
manoa.onSetEnabled((on) => {
  enabled = on;
  setMic(on);
  manoa.listening(on);
  status(on ? 'ok' : 'muted', on ? 'Prêt — dites MANOA, MAN ou MATRIX' : 'En sourdine');
});

window.addEventListener('error', (e) => {
  manoa.error(String((e && e.message) || e));
});

init();
