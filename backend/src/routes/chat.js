import { Router } from 'express';
import { getDb } from '../data/index.js';
import { answerQuestion, generateRoadmapOnly } from '../services/aiService.js';
import { registerChatActivity } from '../services/gamification.js';
import { getKnowledgeStats } from '../services/knowledgeBase.js';

const router = Router();

function sessionUser(req) {
  const u = req.header('x-user-id') || 'guest';
  const name = req.header('x-user-name') || 'Visiteur';
  return { id: u, name };
}

router.post('/chat', async (req, res) => {
  try {
    const { question } = req.body || {};
    if (!question || !String(question).trim()) {
      return res.status(400).json({ error: 'Question vide' });
    }
    const user = sessionUser(req);
    const db = getDb();
    const answer = await answerQuestion(String(question));

    let saved;
    if (db.saveChat) {
      saved = await db.saveChat({
        userId: user.id,
        userName: user.name,
        question: String(question),
        answer: answer.text,
        type: answer.type,
        sources: answer.sources || [],
        providers: answer.providers || [],
        createdAt: new Date().toISOString(),
      });
    }
    await registerChatActivity(db, user.id);

    res.json({ ...answer, chatId: saved?.id || null });
  } catch (err) {
    console.error('[chat] error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/roadmap', async (req, res) => {
  try {
    const { question } = req.body || {};
    if (!question || !String(question).trim()) {
      return res.status(400).json({ error: 'Question vide' });
    }
    const { roadmap, providers, videos } = await generateRoadmapOnly(String(question));
    res.json({ roadmap, providers, videos });
  } catch (err) {
    console.error('[roadmap] error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/knowledge/stats', async (_req, res) => {
  try {
    res.json(await getKnowledgeStats());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
