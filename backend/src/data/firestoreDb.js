import fs from 'node:fs';
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { config } from '../config/index.js';

let firestore = null;
let available = false;

export function initFirestore() {
  if (firestore) return firestore;
  const { serviceAccountPath, databaseURL } = config.firebase;
  if (!serviceAccountPath || !fs.existsSync(serviceAccountPath)) {
    console.log('[db] No Firebase credentials found -> using local JSON store');
    return null;
  }
  try {
    const cred = serviceAccountPath.endsWith('.json') ? cert(serviceAccountPath) : applicationDefault();
    const app = initializeApp({ credential: cred, databaseURL });
    firestore = getFirestore(app);
    available = true;
    console.log('[db] Connected to Firebase Firestore');
  } catch (err) {
    console.warn('[db] Firebase init failed, falling back to local JSON store:', err.message);
    firestore = null;
  }
  return firestore;
}

const col = (name) => firestore.collection(name);

export const firestoreDb = {
  kind: 'firestore',
  isAvailable: () => available,

  async getUser(id) {
    const snap = await col('users').doc(id).get();
    return snap.exists ? snap.data() : null;
  },
  async createUser(id, data) {
    const doc = { xp: 0, level: 1, streak: 0, badges: [], createdAt: new Date().toISOString(), ...data };
    await col('users').doc(id).set(doc);
    return doc;
  },
  async updateUser(id, patch) {
    await col('users').doc(id).update(patch);
    const snap = await col('users').doc(id).get();
    return snap.exists ? snap.data() : null;
  },

  async saveChat(chat) {
    const ref = await col('chats').add(chat);
    return { id: ref.id, ...chat };
  },
  async getChats(limit = 100) {
    const snap = await col('chats').orderBy('createdAt', 'desc').limit(limit).get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },

  async getProgress(userId) {
    const snap = await col('progress').where('userId', '==', userId).get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },
  async saveProgress(userId, roadmap) {
    await col('progress').doc(`${userId}__${roadmap.id}`).set({ userId, savedAt: new Date().toISOString(), ...roadmap });
    return roadmap;
  },

  async addDocument(doc) {
    const ref = await col('documents').add(doc);
    return { id: ref.id, ...doc };
  },
  async listDocuments() {
    const snap = await col('documents').get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },

  async getStats() {
    const [users, chats, docs] = await Promise.all([
      col('users').get(),
      col('chats').get(),
      col('documents').get(),
    ]);
    const today = new Date().toISOString().slice(0, 10);
    let chatsToday = 0;
    let xpTotal = 0;
    chats.docs.forEach((d) => {
      if ((d.data().createdAt || '').slice(0, 10) === today) chatsToday += 1;
    });
    users.docs.forEach((d) => {
      xpTotal += d.data().xp || 0;
    });
    return {
      chatsTotal: chats.size,
      chatsToday,
      users: users.size,
      documents: docs.size,
      progressRoadmaps: 0,
      xpTotal,
    };
  },
};
