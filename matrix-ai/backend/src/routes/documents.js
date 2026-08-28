import { Router } from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import { getDb } from '../data/index.js';
import { extractTextFromHtml, extractPdfText, chunkText } from '../services/knowledgeBase.js';
import { config } from '../config/index.js';

const router = Router();

const upload = multer({ dest: config.paths.uploads });

router.get('/', async (_req, res) => {
  try {
    const db = getDb();
    res.json(await db.listDocuments());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const db = getDb();
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier' });
    const file = req.file;
    let text = '';
    const ext = path.extname(file.originalname).toLowerCase();

    if (ext === '.html' || ext === '.htm') {
      text = extractTextFromHtml(fs.readFileSync(file.path, 'utf8'));
    } else if (ext === '.txt' || ext === '.md') {
      text = fs.readFileSync(file.path, 'utf8');
    } else if (ext === '.pdf') {
      text = await extractPdfText(fs.readFileSync(file.path));
    } else {
      return res.status(400).json({ error: 'Format non supporte (utilisez .txt, .md, .html ou .pdf)' });
    }
    if (!text.trim()) {
      return res.status(400).json({ error: 'Aucun texte extrait de ce fichier' });
    }

    const doc = await db.addDocument({
      title: path.basename(file.originalname),
      type: ext.replace('.', '') || 'html',
      chunkCount: chunkText(text).length,
      size: file.size,
      uploadDate: new Date().toISOString(),
    });
    fs.unlinkSync(file.path);
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
