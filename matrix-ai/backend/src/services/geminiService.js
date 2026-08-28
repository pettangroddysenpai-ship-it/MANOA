import { config, hasGeminiKey } from '../config/index.js';

const MODEL = 'gemini-2.5-flash';
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export function getGemini() {
  return hasGeminiKey()
    ? { apiKey: config.gemini.apiKey, model: config.gemini.model || MODEL, embedModel: config.gemini.embedModel }
    : null;
}

export async function geminiGenerate({ system, context = '', question, json = false }) {
  const g = getGemini();
  if (!g) return null;

  const parts = [];
  if (context) parts.push({ text: `Contexte documentaire:\n${context}` });
  parts.push({ text: question });

  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      temperature: 0.4,
      ...(json ? { responseMimeType: 'application/json' } : {}),
    },
  };
  if (system) body.systemInstruction = { parts: [{ text: system }] };

  const res = await fetch(`${BASE}/${g.model}:generateContent?key=${g.apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Gemini ${res.status}: ${detail.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  if (json) {
    try {
      return JSON.parse(text.replace(/```json|```/g, '').trim());
    } catch {
      return null;
    }
  }
  return text.trim();
}

export async function geminiEmbed(texts) {
  const g = getGemini();
  if (!g) return null;
  const BATCH = 64;
  const out = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH);
    console.log(`[embed] Gemini batch ${i / BATCH + 1}/${Math.ceil(texts.length / BATCH)} (${batch.length} items)`);
    const res = await fetch(`${BASE}/${g.embedModel}:batchEmbedContents?key=${g.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: batch.map((text) => ({ model: `models/${g.embedModel}`, content: { parts: [{ text }] } })),
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Gemini embed ${res.status}: ${detail.slice(0, 200)}`);
    }
    const data = await res.json();
    const vectors = (data.embeddings || []).map((e) => e.values);
    if (vectors.length !== batch.length) {
      throw new Error('Gemini embed: nombre de resultats inattendu');
    }
    out.push(...vectors);
  }
  return out;
}
