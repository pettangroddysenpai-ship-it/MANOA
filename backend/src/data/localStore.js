import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config/index.js';

const dbFile = path.join(config.paths.data, 'localdb.json');

const empty = () => ({
  users: {},
  chats: [],
  progress: {},
  documents: [],
  feedback: [],
});

let cache = null;

function load() {
  if (cache) return cache;
  if (fs.existsSync(dbFile)) {
    try {
      cache = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
    } catch {
      cache = empty();
    }
  } else {
    cache = empty();
  }
  return cache;
}

function save() {
  if (!fs.existsSync(config.paths.data)) fs.mkdirSync(config.paths.data, { recursive: true });
  fs.writeFileSync(dbFile, JSON.stringify(cache, null, 2), 'utf8');
}

export const localStore = {
  load,
  save,

  async getUser(id) {
    return load().users[id] || null;
  },
  async createUser({ id, name }) {
    const user = {
      id,
      name,
      xp: 0,
      level: 1,
      streak: 0,
      badges: [],
      createdAt: new Date().toISOString(),
    };
    load().users[id] = user;
    save();
    return user;
  },
  async updateUser(id, patch) {
    const user = load().users[id];
    if (!user) return null;
    Object.assign(user, patch);
    save();
    return user;
  },

  async saveChat(chat) {
    load().chats.push(chat);
    save();
    return chat;
  },
  async getChats(limit = 100) {
    return load().chats.slice(-limit).reverse();
  },

  async getProgress(userId) {
    return load().progress[userId] || [];
  },
  async saveProgress(userId, roadmap) {
    const list = load().progress[userId] || [];
    const idx = list.findIndex((p) => p.id === roadmap.id);
    if (idx >= 0) list[idx] = roadmap;
    else list.push(roadmap);
    load().progress[userId] = list;
    save();
    return roadmap;
  },

  async addDocument(doc) {
    load().documents.push(doc);
    save();
    return doc;
  },
  async listDocuments() {
    return load().documents;
  },

  async getStats() {
    const db = load();
    const today = new Date().toISOString().slice(0, 10);
    const chatsToday = db.chats.filter((c) => (c.createdAt || '').slice(0, 10) === today).length;
    const xpTotal = Object.values(db.users).reduce((sum, u) => sum + (u.xp || 0), 0);
    return {
      chatsTotal: db.chats.length,
      chatsToday,
      users: Object.keys(db.users).length,
      documents: db.documents.length,
      progressRoadmaps: Object.values(db.progress).flat().length,
      xpTotal,
    };
  },
};
