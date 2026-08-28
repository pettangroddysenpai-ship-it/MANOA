import { initFirestore, firestoreDb } from './firestoreDb.js';
import { localStore } from './localStore.js';

let backend = null;

export function getDb() {
  if (backend) return backend;
  backend = initFirestore() ? firestoreDb : localStore;
  return backend;
}

export function dbIsFirestore() {
  return getDb() === firestoreDb;
}
