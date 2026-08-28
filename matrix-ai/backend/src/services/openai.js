import OpenAI from 'openai';
import { config, hasOpenAIKey } from '../config/index.js';

let client = null;

export function getOpenAI() {
  if (!client && hasOpenAIKey()) client = new OpenAI({ apiKey: config.openai.apiKey, timeout: 60000, maxRetries: 1 });
  return client;
}

export async function embed(texts) {
  const openai = getOpenAI();
  if (!openai) return null;
  const BATCH = 64;
  const out = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH);
    console.log(`[embed] OpenAI batch ${i / BATCH + 1}/${Math.ceil(texts.length / BATCH)} (${batch.length} items)`);
    const res = await openai.embeddings.create({
      model: config.openai.embedModel,
      input: batch,
    });
    out.push(...res.data.map((d) => d.embedding));
  }
  return out;
}
