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

/**
 * V2 Version Management: Save a new snapshot version of the song project
 * Never overwrites the original recorded audio or original metadata.
 */
export async function createIdeaVersion(
  id: string,
  params: {
    name?: string;
    lyrics?: string;
    sections?: import('../types').SongSection[];
    development?: import('../types').SongDevelopment;
    creativeControls?: { keepMelodyPct: number; keepLyricPct: number };
    note?: string;
  }
): Promise<{ idea: import('../types').AudioIdea; newVersion: import('../types').ProjectVersion }> {
  const idea = await getIdeaById(id);
  if (!idea) {
    throw new Error(`Idea with id ${id} not found.`);
  }

  const existingVersions = idea.versions || [];
  const versionNumber = existingVersions.length + 1;
  const versionName = params.name || `Phiên bản V${versionNumber}`;
  const versionId = `ver_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  const newVersion: import('../types').ProjectVersion = {
    id: versionId,
    name: versionName,
    createdAt: Date.now(),
    savedAt: Date.now(),
    lyrics: params.lyrics ?? idea.lyrics ?? idea.developedLyric ?? idea.originalLyric ?? '',
    sections: params.sections ?? idea.songDevelopment?.sections,
    development: params.development ?? idea.songDevelopment,
    creativeControls: params.creativeControls ?? idea.creativeControls,
    note: params.note,
  };

  const updatedVersions = [...existingVersions, newVersion];

  const updatedIdea = await updateIdea(id, {
    versions: updatedVersions,
    activeVersionId: versionId,
    lyrics: newVersion.lyrics,
    songDevelopment: newVersion.development,
    creativeControls: newVersion.creativeControls,
    status: (idea.status === 'draft' ? 'in_progress' : idea.status) as import('../types').ProjectStatus,
    updatedAt: Date.now(),
  });

  return { idea: updatedIdea, newVersion };
}

/**
 * V2 Version Management: Switch to an existing snapshot version
 */
export async function switchIdeaVersion(id: string, versionId: string): Promise<import('../types').AudioIdea> {
  const idea = await getIdeaById(id);
  if (!idea) {
    throw new Error(`Idea with id ${id} not found.`);
  }

  if (versionId === 'original') {
    // Switch to original state
    return await updateIdea(id, {
      activeVersionId: 'original',
      lyrics: idea.originalLyric || idea.transcript || '',
      updatedAt: Date.now(),
    });
  }

  const targetVersion = (idea.versions || []).find((v) => v.id === versionId);
  if (!targetVersion) {
    throw new Error(`Version ${versionId} not found.`);
  }

  return await updateIdea(id, {
    activeVersionId: versionId,
    lyrics: targetVersion.lyrics,
    songDevelopment: targetVersion.development,
    creativeControls: targetVersion.creativeControls,
    updatedAt: Date.now(),
  });
}

