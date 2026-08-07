import OpenAI from 'openai';
import { config, hasOpenAIKey } from '../config/index.js';

let client = null;

export function getOpenAI() {
  if (!client && hasOpenAIKey()) client = new OpenAI({ apiKey: config.openai.apiKey });
  return client;
}

export async function embed(texts) {
  const openai = getOpenAI();
  if (!openai) return null;
  const res = await openai.embeddings.create({
    model: config.openai.embedModel,
    input: texts,
  });
  return res.data.map((d) => d.embedding);
}
