import express from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import { getDb, dbIsFirestore } from './data/index.js';
import chatRoutes from './routes/chat.js';
import progressRoutes from './routes/progress.js';
import adminRoutes from './routes/admin.js';
import documentRoutes from './routes/documents.js';
import voiceRoutes from './routes/voice.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', db: dbIsFirestore() ? 'firestore' : 'local' });
});

app.use('/api', chatRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/voice', voiceRoutes);

app.use((err, _req, res, _next) => {
  console.error('[server] unhandled error:', err);
  res.status(500).json({ error: 'Erreur interne' });
});

const db = getDb();

app.listen(config.port, () => {
  console.log(`\n  MANOA backend ready`);
  console.log(`  -> http://localhost:${config.port}/api/health`);
  console.log(`  -> database: ${dbIsFirestore() ? 'Firebase Firestore' : 'local JSON (fallback)'}\n`);
});
