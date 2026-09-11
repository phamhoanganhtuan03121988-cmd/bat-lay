import { AudioIdea } from '../types';

const DB_NAME = 'bat_lay_db';
const DB_VERSION = 1;
const STORE_NAME = 'ideas';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported on this device.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('favorite', 'favorite', { unique: false });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function getAllIdeas(): Promise<AudioIdea[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      // Sort descending by createdAt (newest first)
      const list = (request.result as AudioIdea[]) || [];
      list.sort((a, b) => b.createdAt - a.createdAt);
      resolve(list);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function getIdeaById(id: string): Promise<AudioIdea | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => {
      resolve(request.result as AudioIdea | undefined);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function saveIdea(idea: AudioIdea): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(idea);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function updateIdea(id: string, updates: Partial<AudioIdea>): Promise<AudioIdea> {
  const existing = await getIdeaById(id);
  if (!existing) {
    throw new Error(`Idea with id ${id} not found.`);
  }

  const updated: AudioIdea = {
    ...existing,
    ...updates,
  };

  await saveIdea(updated);
  return updated;
}

export async function deleteIdea(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function toggleFavorite(id: string): Promise<boolean> {
  const existing = await getIdeaById(id);
  if (!existing) return false;
  const newFav = !existing.favorite;
  await updateIdea(id, { favorite: newFav });
  return newFav;
}
