import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { config, hasOpenAIKey, hasGeminiKey } from '../config/index.js';
import { embed } from './openai.js';
import { geminiEmbed } from './geminiService.js';

const indexFile = path.join(config.paths.data, 'knowledge_index.json');
const kbDir = config.paths.knowledge;

export function extractTextFromHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

export async function extractPdfText(buffer) {
  try {
    const data = await pdfParse(buffer);
    return (data.text || '').trim();
  } catch (err) {
    console.warn('[kb] PDF parse failed:', err.message);
    return '';
  }
}

export function chunkText(text, size = 600, overlap = 80) {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= size) return cleaned ? [cleaned] : [];
  const chunks = [];
  let i = 0;
  while (i < cleaned.length) {
    chunks.push(cleaned.slice(i, i + size));
    i += size - overlap;
  }
  return chunks;
}

function listDocFiles() {
  return fs.readdirSync(kbDir).filter((f) => /\.(html?|pdf|txt|md)$/i.test(f));
}

function cosine(a, b) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

function keywordScore(query, text) {
  const q = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const t = text.toLowerCase();
  return q.reduce((sum, w) => sum + (t.includes(w) ? 1 : 0), 0) / Math.max(q.length, 1);
}

function loadCachedIndex() {
  if (fs.existsSync(indexFile)) {
    try {
      return JSON.parse(fs.readFileSync(indexFile, 'utf8'));
    } catch {
      return null;
    }
  }
  return null;
}

function saveIndex(index) {
  if (!fs.existsSync(config.paths.data)) fs.mkdirSync(config.paths.data, { recursive: true });
  fs.writeFileSync(indexFile, JSON.stringify(index), 'utf8');
}

async function extractFileText(file) {
  const filePath = path.join(kbDir, file);
  const ext = path.extname(file).toLowerCase();
  if (ext === '.pdf') {
    return extractPdfText(fs.readFileSync(filePath));
  }
  if (ext === '.txt' || ext === '.md') {
    return fs.readFileSync(filePath, 'utf8').trim();
  }
  return extractTextFromHtml(fs.readFileSync(filePath, 'utf8'));
}

async function buildChunks() {
  const files = listDocFiles();
  const chunks = [];
  for (const file of files) {
    const text = await extractFileText(file);
    if (!text) {
      console.warn(`[kb] Aucun texte extrait de ${file}`);
      continue;
    }
    const title = file.replace(/\.\w+$/i, '').replace(/[-_]+/g, ' ');
    chunkText(text).forEach((content, i) => {
      chunks.push({ id: crypto.randomUUID(), file, title, index: i, content });
    });
  }
  return chunks;
}

let indexPromise = null;

export async function getKnowledgeIndex() {
  if (indexPromise) return indexPromise;
  indexPromise = (async () => {
    let cached = loadCachedIndex();
    if (cached && cached.version === 2 && cached.chunks.length > 0 && (cached.embedded || !canEmbedNow())) {
      return cached;
    }
    if (cached && cached.version !== 2) cached = null;

    const chunks = await buildChunks();
    const index = { version: 2, embedded: false, embedder: null, chunks };

    if (hasOpenAIKey()) {
      try {
        const vectors = await embed(chunks.map((c) => c.content.slice(0, 8000)));
        index.chunks = chunks.map((c, i) => ({ ...c, vector: vectors[i] }));
        index.embedded = true;
        index.embedder = 'openai';
      } catch (err) {
        console.warn('[kb] OpenAI embedding failed, trying Gemini:', err.message);
      }
    }
    if (!index.embedded && hasGeminiKey()) {
      try {
        const vectors = await geminiEmbed(chunks.map((c) => c.content.slice(0, 8000)));
        index.chunks = chunks.map((c, i) => ({ ...c, vector: vectors[i] }));
        index.embedded = true;
        index.embedder = 'gemini';
      } catch (err) {
        console.warn('[kb] Gemini embedding failed, using keyword search:', err.message);
      }
    }
    saveIndex(index);
    return index;
  })();
  return indexPromise;
}

function canEmbedNow() {
  return hasOpenAIKey() || hasGeminiKey();
}

async function embedQuery(query, embedder) {
  if (embedder === 'gemini') return (await geminiEmbed([query]))?.[0];
  return (await embed([query]))?.[0];
}

export async function searchKnowledge(query, topK = 5) {
  const index = await getKnowledgeIndex();
  const scored = [];

  if (index.embedded) {
    const qv = await embedQuery(query, index.embedder);
    if (qv) {
      for (const c of index.chunks) scored.push({ ...c, score: cosine(qv, c.vector) });
      scored.sort((a, b) => b.score - a.score);
      return { results: scored.slice(0, topK), embedded: true, embedder: index.embedder };
    }
  }

  for (const c of index.chunks) scored.push({ ...c, score: keywordScore(query, c.content) });
  scored.sort((a, b) => b.score - a.score);
  const nonZero = scored.filter((s) => s.score > 0);
  return { results: (nonZero.length ? nonZero : scored.slice(0, 1)).slice(0, topK), embedded: false };
}

export async function getKnowledgeStats() {
  const index = await getKnowledgeIndex();
  return {
    documents: index.chunks ? new Set(index.chunks.map((c) => c.file)).size : 0,
    chunks: index.chunks.length,
    embedded: index.embedded,
  };
}
