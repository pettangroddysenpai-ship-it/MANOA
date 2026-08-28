import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.env') });

export const config = {
  port: Number(process.env.PORT || 4000),
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    embedModel: process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small',
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    embedModel: process.env.GEMINI_EMBED_MODEL || 'gemini-embedding-001',
  },
  ollama: {
    url: process.env.OLLAMA_URL || 'http://127.0.0.1:11434',
    model: process.env.OLLAMA_MODEL || 'qwen3:4b',
    embedModel: process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text',
    maxTokens: Number(process.env.OLLAMA_MAX_TOKENS || 2048),
  },
  youtube: {
    apiKey: process.env.YOUTUBE_API_KEY || '',
    maxResults: Number(process.env.YOUTUBE_MAX_RESULTS || 3),
  },
  firebase: {
    serviceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS || '',
    databaseURL: process.env.FIREBASE_DATABASE_URL || '',
  },
  adminPassword: process.env.ADMIN_PASSWORD || 'manoa-admin',
  paths: {
    root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'),
    knowledge: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../knowledge'),
    uploads: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../uploads'),
    data: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data'),
  },
};

export const hasOpenAIKey = () => Boolean(config.openai.apiKey && !config.openai.apiKey.includes('your-openai-api-key'));
export const hasGeminiKey = () => Boolean(config.gemini.apiKey);
export const hasYoutubeKey = () => Boolean(config.youtube.apiKey);
