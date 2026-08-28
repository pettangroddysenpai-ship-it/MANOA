import { Router } from 'express';
import multer from 'multer';
import fs from 'node:fs';
import { getOpenAI } from '../services/openai.js';
import { config } from '../config/index.js';
import { hasOpenAIKey } from '../config/index.js';

const router = Router();

const upload = multer({
  dest: config.paths.uploads,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/mp3'];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(webm|ogg|mp3|wav|mp4|m4a)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Format audio non supporte'));
    }
  },
});

router.post('/', upload.single('audio'), async (req, res) => {
  let tmpPath = null;
  try {
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier audio recu' });

    tmpPath = req.file.path;

    if (!hasOpenAIKey()) {
      return res.status(503).json({ error: ' transcription vocale indisponible (cle OpenAI manquante)' });
    }

    const openai = getOpenAI();
    const fileStream = fs.createReadStream(tmpPath);

    const transcription = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file: fileStream,
      language: 'fr',
    });

    res.json({ text: transcription.text || '' });
  } catch (err) {
    console.error('[voice] transcription failed:', err.message);
    res.status(500).json({ error: 'Echec de la transcription vocale' });
  } finally {
    if (tmpPath) {
      try { fs.unlinkSync(tmpPath); } catch {}
    }
  }
});

export default router;
