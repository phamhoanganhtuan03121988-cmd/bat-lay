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

function createSilentWavBlob(durationSec: number = 3): Blob {
  const sampleRate = 44100;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const numSamples = sampleRate * durationSec;
  const dataSize = numSamples * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF chunk descriptor
  for (let i = 0; i < 4; i++) view.setUint8(i, 'RIFF'.charCodeAt(i));
  view.setUint32(4, 36 + dataSize, true);
  for (let i = 0; i < 4; i++) view.setUint8(8 + i, 'WAVE'.charCodeAt(i));

  // fmt sub-chunk
  for (let i = 0; i < 4; i++) view.setUint8(12 + i, 'fmt '.charCodeAt(i));
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data sub-chunk
  for (let i = 0; i < 4; i++) view.setUint8(36 + i, 'data'.charCodeAt(i));
  view.setUint32(40, dataSize, true);

  return new Blob([buffer], { type: 'audio/wav' });
}

export function buildSampleIdea(): AudioIdea {
  const sampleLyrics = `[Verse]
Walking through the quiet night
I hear a distant sound

[Chorus]
Stay with me tonight
Don't let this moment fade`;

  return {
    id: 'sample_night_walk',
    title: 'Walking Through The Night',
    createdAt: Date.now(),
    duration: 6,
    audioBlob: createSilentWavBlob(6),
    context: 'Buổi tối',
    waveformData: [0.15, 0.35, 0.55, 0.48, 0.65, 0.78, 0.42, 0.28, 0.45, 0.62, 0.38, 0.18],
    status: 'in_progress',
    transcript: 'Walking through the quiet night, I hear a distant sound. Stay with me tonight.',
    originalLyric: 'Walking through the quiet night\nI hear a distant sound',
    lyrics: sampleLyrics,
    developedLyric: sampleLyrics,
    emotion: 'Melancholic, deep and intimate',
    bpm: 68,
    musicalKey: 'G# minor',
    melodyDescription: 'Giai điệu pop ballad chậm rãi, da diết với quãng âm trầm lắng',
    suggestedGenres: ['Vietnamese Pop Ballad', 'Indie Acoustic', 'Ambient Ballad'],
    genreSuggestions: [
      { name: 'Vietnamese Pop Ballad', reason: 'Phù hợp với nhịp điệu chậm và cảm xúc lắng đọng' },
      { name: 'Indie Acoustic', reason: 'Tối ưu cho tiếng piano và guitar mộc' },
    ],
    inputType: 'singing_with_lyrics',
    hasSpeech: true,
    analyzedWith: 'hybrid',
    favorite: true,
    analysisStatus: 'completed',
    keepMelodyPct: 80,
    keepLyricPct: 85,
    songSections: [
      {
        id: 'sec_verse_1',
        type: 'Verse 1',
        title: 'Lời 1 (Verse)',
        content: 'Walking through the quiet night\nI hear a distant sound',
        chords: 'G#m - E - B - F#',
        notes: 'Tiếng piano mở đầu nhẹ nhàng, âm điệu trầm',
      },
      {
        id: 'sec_chorus_1',
        type: 'Chorus',
        title: 'Điệp khúc (Chorus)',
        content: "Stay with me tonight\nDon't let this moment fade",
        chords: 'E - B - F# - G#m',
        notes: 'Giọng hát đẩy cao cảm xúc, hòa âm đàn dây ngân vang',
      },
    ],
    musicBlueprint: {
      title: 'Walking Through The Night',
      language: 'English',
      genre: 'Pop Ballad',
      mood: 'Melancholic, intimate and heartfelt',
      tempo_bpm: 68,
      key: 'G# minor',
      duration_target: '30-second preview / Full song',
      vocal_style: 'Warm, expressive male vocals with gentle emotional phrasing',
      lyrics: sampleLyrics,
      song_structure: ['Intro', 'Verse', 'Chorus', 'Outro'],
      melody_direction: 'Gentle descending melodic contour with restrained phrasing',
      harmony: 'G#m - E - B - F#',
      instrumentation: 'Acoustic piano, soft acoustic guitar, delicate strings, subtle ambient pad',
      production_direction: 'Intimate acoustic ambiance with warm natural reverb and dynamic buildup',
      lyria_prompt: `MUSIC DIRECTION:
Style: Pop Ballad.
Tempo: 68 BPM.
Musical Key: G# minor.
Mood: Melancholic, intimate and heartfelt.
Vocals: Warm, expressive male vocals with gentle emotional phrasing.
Instrumentation: Acoustic piano, soft acoustic guitar, delicate strings, subtle ambient pad.
Production & Arrangement: Intimate acoustic ambiance with warm natural reverb and dynamic buildup.
Musical phrasing: The song should feel emotionally similar to the captured idea, with a gentle melodic character and restrained phrasing.
Creative approach: Use the captured melodic character as creative inspiration.
Structure: 30-second preview clip focusing on the intro and emotional chorus hook.

LYRICS:
[Verse]
Walking through the quiet night
I hear a distant sound

[Chorus]
Stay with me tonight
Don't let this moment fade`,
    },
  };
}

export async function createSampleProject(): Promise<AudioIdea> {
  const sample = buildSampleIdea();
  await saveIdea(sample);
  return sample;
}

export async function getAllIdeas(): Promise<AudioIdea[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = async () => {
      // Sort descending by createdAt (newest first)
      const list = (request.result as AudioIdea[]) || [];
      if (list.length === 0) {
        // Seed default sample idea for immediate testing
        try {
          const sample = buildSampleIdea();
          await saveIdea(sample);
          resolve([sample]);
          return;
        } catch (e) {
          console.warn('Could not seed initial sample idea:', e);
        }
      }
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

/**
 * V3 Lyria Demo Generation: Save a newly synthesized demo song
 * Appends to generatedSongs array, preserves all past versions and original recording.
 */
export async function saveGeneratedSong(
  projectId: string,
  song: import('../types').GeneratedSong
): Promise<import('../types').AudioIdea> {
  const idea = await getIdeaById(projectId);
  if (!idea) {
    throw new Error(`Idea with id ${projectId} not found.`);
  }

  const existingDemos = idea.generatedSongs || [];
  const updatedDemos = [...existingDemos, song];

  return await updateIdea(projectId, {
    generatedSongs: updatedDemos,
    activeGeneratedSongId: song.id,
    musicBlueprint: song.blueprint,
    demoStatus: 'completed',
    demoError: null,
    updatedAt: Date.now(),
  });
}

/**
 * V3 Lyria Demo Generation: Switch active demo song
 */
export async function switchGeneratedSong(
  projectId: string,
  songId: string
): Promise<import('../types').AudioIdea> {
  const idea = await getIdeaById(projectId);
  if (!idea) {
    throw new Error(`Idea with id ${projectId} not found.`);
  }

  return await updateIdea(projectId, {
    activeGeneratedSongId: songId,
    updatedAt: Date.now(),
  });
}

/**
 * V3.1 Lyria Debug Logging: Save a generation record to IndexedDB
 * Logs verbatim prompt, model, status, error for transparency without storing API keys.
 */
export async function saveGenerationRecord(
  record: import('../types').GenerationRecord
): Promise<void> {
  try {
    const idea = await getIdeaById(record.projectId);
    if (!idea) return;

    const existingRecords = idea.generationRecords || [];
    const updatedRecords = [...existingRecords, record];

    await updateIdea(record.projectId, {
      generationRecords: updatedRecords,
      updatedAt: Date.now(),
    });
  } catch (err) {
    console.warn('Failed to save generation record to idea:', err);
  }
}

/**
 * Get generation records for debugging
 */
export async function getGenerationRecords(
  projectId: string
): Promise<import('../types').GenerationRecord[]> {
  const idea = await getIdeaById(projectId);
  return idea?.generationRecords || [];
}



