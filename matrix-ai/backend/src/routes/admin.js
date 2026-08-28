import { Router } from 'express';
import { getDb } from '../data/index.js';
import { getKnowledgeStats } from '../services/knowledgeBase.js';
import { config } from '../config/index.js';

const router = Router();

router.use((req, res, next) => {
  const token = req.header('x-admin-token');
  if (token !== config.adminPassword) return res.status(401).json({ error: 'Non autorise' });
  next();
});

router.get('/stats', async (_req, res) => {
  try {
    const db = getDb();
    const [stats, kb] = await Promise.all([db.getStats(), getKnowledgeStats()]);
    res.json({ ...stats, knowledge: kb, db: dbIsFirestoreLabel() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/chats', async (_req, res) => {
  try {
    const db = getDb();
    res.json(await db.getChats(200));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function dbIsFirestoreLabel() {
  return getDb().kind === 'firestore' ? 'firestore' : 'local';
}

export default router;
