// Service Ollama : LLM local (100 % hors ligne) + embeddings.
// L'API est documentee ici : https://github.com/ollama/ollama/blob/main/docs/api.md
import { config } from '../config/index.js';

let cachedTags = null;
let tagsAt = 0;

function available() {
  return Boolean(config.ollama && config.ollama.url);
}

async function listModels() {
  if (!available()) return null;
  if (cachedTags && Date.now() - tagsAt < 10000) return cachedTags;
  try {
    const res = await fetch(`${config.ollama.url}/api/tags`, {
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) {
      cachedTags = null;
      return null;
    }
    const data = await res.json();
    cachedTags = Array.isArray(data.models) ? data.models : [];
    tagsAt = Date.now();
    return cachedTags;
  } catch {
    cachedTags = null;
    return null;
  }
}

function findTag(tags, wanted) {
  if (!tags || tags.length === 0) return null;
  if (!wanted) return tags[0].name;
  const exact = tags.find((t) => t.name === wanted);
  if (exact) return exact.name;
  const prefix = tags.find((t) => t.name.startsWith(`${wanted.split(':')[0]}:`));
  if (prefix) return prefix.name;
  return null;
}

// Modele de chat a utiliser (celui configure, sinon le premier dispo)
export async function ollamaChatModel() {
  const tags = await listModels();
  return findTag(tags, config.ollama.model);
}

// Modele d'embedding a utiliser
export async function ollamaEmbedModel() {
  const tags = await listModels();
  return findTag(tags, config.ollama.embedModel);
}

// Vrai si Ollama tourne et qu'au moins un modele est present
export async function ollamaEnabled() {
  return Boolean(await ollamaChatModel());
}

export async function ollamaGenerate({ system, context = '', question, json = false }) {
  const model = await ollamaChatModel();
  if (!model) return null;

  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  if (context) messages.push({ role: 'system', content: `Contexte documentaire:\n${context}` });
  messages.push({ role: 'user', content: question });

  const body = {
    model,
    messages,
    stream: false,
    options: { temperature: 0.4, num_predict: config.ollama.maxTokens },
    ...(json ? { format: 'json' } : {}),
  };

  const res = await fetch(`${config.ollama.url}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Ollama ${res.status}: ${detail.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = data?.message?.content || '';
  if (json) {
    try {
      return JSON.parse(text.replace(/```json|```/g, '').trim());
    } catch {
      return null;
    }
  }
  return text.trim() || null;
}

export async function ollamaEmbed(texts) {
  const model = await ollamaEmbedModel();
  if (!model) return null;
  const BATCH = 64;
  const out = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH);
    console.log(`[embed] Ollama batch ${i / BATCH + 1}/${Math.ceil(texts.length / BATCH)} (${batch.length} items)`);
    const res = await fetch(`${config.ollama.url}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, input: batch }),
      signal: AbortSignal.timeout(120000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Ollama embed ${res.status}: ${detail.slice(0, 200)}`);
    }
    const data = await res.json();
    const vectors = data?.embeddings || [];
    if (vectors.length !== batch.length) {
      throw new Error('Ollama embed: nombre de resultats inattendu');
    }
    out.push(...vectors);
  }
  return out;
}
