import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { getDb } from '../data/index.js';
import { completeRoadmapStep, awardXp } from '../services/gamification.js';

const router = Router();

function userId(req) {
  return req.header('x-user-id') || 'guest';
}

router.get('/user/:id', async (req, res) => {
  try {
    const db = getDb();
    let user = await db.getUser(req.params.id);
    if (!user) user = await db.createUser({ id: req.params.id, name: req.header('x-user-name') || 'Visiteur' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/user', async (req, res) => {
  try {
    const db = getDb();
    const { name } = req.body || {};
    const id = randomUUID();
    const user = await db.createUser({ id, name: name || 'Visiteur' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:userId', async (req, res) => {
  try {
    const db = getDb();
    const list = await db.getProgress(req.params.userId);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/save', async (req, res) => {
  try {
    const db = getDb();
    const uid = userId(req);
    const { roadmap } = req.body || {};
    if (!roadmap?.steps) return res.status(400).json({ error: 'roadmap invalide' });
    const entry = {
      id: randomUUID(),
      userId: uid,
      title: roadmap.title || 'Feuille de route',
      question: req.body.question || '',
      steps: roadmap.steps.map((s) => ({
        title: s.title,
        description: s.description,
        commands: s.commands || [],
        type: s.type || 'info',
        scene: s.scene || 'inspection',
        app: s.app || '',
        quiz: s.quiz || null,
        completed: false,
      })),
      completed: false,
      createdAt: new Date().toISOString(),
    };
    await db.saveProgress(uid, entry);
    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:userId/complete', async (req, res) => {
  try {
    const db = getDb();
    const { progressId, stepIndex } = req.body || {};
    const result = await completeRoadmapStep(db, req.params.userId, progressId, Number(stepIndex));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:userId/xp', async (req, res) => {
  try {
    const db = getDb();
    const { amount } = req.body || {};
    const user = await awardXp(db, req.params.userId, Number(amount) || 10);
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
