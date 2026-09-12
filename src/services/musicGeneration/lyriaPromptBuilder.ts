/**
 * BẮT LẤY V3.1 — Lyria Prompt Builder
 * 
 * Nhiệm vụ:
 * Chuyển Music Blueprint thành một prompt tối ưu, an toàn, súc tích dành riêng cho Lyria.
 * 
 * Cấu trúc 2 phần rõ ràng:
 * A. MUSIC DIRECTION
 * B. LYRICS
 * 
 * Quy tắc an toàn & chính sách:
 * - Không gửi raw DSP numbers hay JSON nội bộ
 * - Không đưa tên nghệ sĩ, album, reference track
 * - Không yêu cầu copy exactly hay bắt chước nghệ sĩ
 * - Giữ nguyên lời tiếng Việt trong phần LYRICS
 * - Musical direction dùng tiếng Anh súc tích, chính xác cho Lyria
 */

import { MusicBlueprint, SongSection } from '../../types';

export interface PromptBuilderOptions {
  keepMelodyPct?: number;
  keepLyricPct?: number;
  isClip?: boolean; // true = 30-second clip preview
}

/**
 * Filter out artist names, band names, famous song references, and prohibited keywords
 * that might trigger policy reason blocks in Lyria.
 */
function sanitizeMusicalText(text: string): string {
  if (!text) return '';

  let cleaned = text;

  // Remove common artist/style patterns like "in the style of X", "inspired by X", "like Son Tung", etc.
  cleaned = cleaned.replace(/\b(?:in the style of|inspired by|sounding like|similar to|cover of|remix of)\s+[^,.;\n]+/gi, '');
  cleaned = cleaned.replace(/\b(?:phong cách của|giống như|ảnh hưởng từ|hát giống|cover lại)\s+[^,.;\n]+/gi, '');

  // Remove specific common artist and celebrity references if inadvertently included
  const forbiddenArtistPatterns = [
    /\b(?:Sơn Tùng|Son Tung|M-TP|Đen Vâu|Den Vau|Vũ|Hoàng Thùy Linh|Mỹ Tâm|Hà Anh Tuấn|Jack|K-ICM|Bích Phương|Chi Pu|Soobin|Erik|Đức Phúc)\b/gi,
    /\b(?:Taylor Swift|Ed Sheeran|Billie Eilish|Adele|Bruno Mars|The Weeknd|Drake|BTS|Blackpink|Justin Bieber|Coldplay|Imagine Dragons)\b/gi,
  ];

  for (const pattern of forbiddenArtistPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }

  // Remove policy-triggering keywords
  cleaned = cleaned.replace(/\b(?:explicit|copyright|trademark|unreleased|leak)\b/gi, '');

  // Clean redundant whitespace and empty punctuation
  cleaned = cleaned.replace(/\s+,/g, ',').replace(/,\s*,+/g, ',').replace(/\s{2,}/g, ' ').trim();

  return cleaned;
}

/**
 * Convert creative controls into natural musical directions
 */
function getMelodyDirectionFromPct(pct: number): string {
  if (pct >= 90) {
    return 'Preserve the original melodic contour and phrasing as closely as possible.';
  }
  if (pct >= 70) {
    return 'Stay strongly aligned with the original melodic contour and phrasing, while allowing natural musical development.';
  }
  if (pct >= 40) {
    return 'Balance original melodic motifs with creative musical expansion and expressive variations.';
  }
  return 'Use the original idea only as thematic inspiration and freely develop a new melody.';
}

function getLyricDirectionFromPct(pct: number): string {
  if (pct >= 90) {
    return 'Preserve the original lyric phrasing with full fidelity.';
  }
  if (pct >= 60) {
    return 'Maintain the core emotional lyric lines while completing missing song sections.';
  }
  return 'Adapt and expand lyrics freely based on the thematic emotional core.';
}

/**
 * Extract clean, structured lyrics from blueprint
 */
function extractCleanLyrics(blueprint: MusicBlueprint): string {
  // If song_structure is an array of SongSection objects with content
  if (Array.isArray(blueprint.song_structure) && blueprint.song_structure.length > 0) {
    const firstItem = blueprint.song_structure[0];
    if (typeof firstItem === 'object' && firstItem !== null && 'type' in firstItem) {
      const sections = blueprint.song_structure as SongSection[];
      const formattedSections = sections
        .filter((s) => s.content && s.content.trim().length > 0)
        .map((s) => {
          const typeTag = s.type ? `[${s.type}]` : `[${s.title || 'Section'}]`;
          return `${typeTag}\n${s.content.trim()}`;
        });

      if (formattedSections.length > 0) {
        return formattedSections.join('\n\n');
      }
    }
  }

  // Fallback to blueprint.lyrics string
  const rawLyrics = blueprint.lyrics || '';
  if (!rawLyrics.trim()) {
    return '[Verse]\nLời ca êm đềm theo từng giai điệu lắng sâu\n\n[Chorus]\nBắt lấy những rung động trong tim này';
  }

  // Ensure sections are cleanly separated
  let cleanedLyrics = rawLyrics
    .replace(/\r\n/g, '\n')
    .replace(/^\{.*\}$/s, '') // Strip accidentally pasted JSON
    .trim();

  // If lyrics do not contain tags like [Verse] or [Chorus], add minimal structure
  if (!cleanedLyrics.includes('[')) {
    const lines = cleanedLyrics.split('\n').filter((l) => l.trim().length > 0);
    if (lines.length > 4) {
      const half = Math.ceil(lines.length / 2);
      cleanedLyrics = `[Verse]\n${lines.slice(0, half).join('\n')}\n\n[Chorus]\n${lines.slice(half).join('\n')}`;
    } else {
      cleanedLyrics = `[Verse]\n${cleanedLyrics}`;
    }
  }

  return cleanedLyrics;
}

/**
 * Main Builder Function:
 * Converts MusicBlueprint into a clean, two-part prompt optimized for Lyria
 */
export function buildLyriaPrompt(
  blueprint: MusicBlueprint,
  options: PromptBuilderOptions = {}
): string {
  const keepMelody = options.keepMelodyPct ?? 80;
  const keepLyric = options.keepLyricPct ?? 70;
  const isClip = options.isClip ?? false;

  // 1. Sanitize base parameters
  const genre = sanitizeMusicalText(blueprint.genre) || 'Vietnamese pop ballad';
  const mood = sanitizeMusicalText(blueprint.mood) || 'emotional and heartfelt';
  const bpm = typeof blueprint.tempo_bpm === 'number' && blueprint.tempo_bpm > 0 ? blueprint.tempo_bpm : 68;
  const key = sanitizeMusicalText(blueprint.key) || 'G minor';
  const vocalStyle = sanitizeMusicalText(blueprint.vocal_style) || 'Expressive, warm Vietnamese singing voice with clear enunciation';
  const instrumentation = sanitizeMusicalText(blueprint.instrumentation) || 'Acoustic piano, acoustic guitar, delicate strings, subtle percussion';
  const production = sanitizeMusicalText(blueprint.production_direction) || 'Intimate acoustic ambiance with warm natural reverb and dynamic buildup';

  // 2. Build Music Direction lines
  const directionLines: string[] = [
    `${genre}.`,
    `${bpm} BPM.`,
    `Key: ${key}.`,
    `Mood: ${mood}.`,
    `Vocal: ${vocalStyle}.`,
    `Instruments: ${instrumentation}.`,
    `Production & Arrangement: ${production}.`,
    getMelodyDirectionFromPct(keepMelody),
    getLyricDirectionFromPct(keepLyric),
  ];

  if (isClip) {
    directionLines.push(
      'Format: 30-second preview clip focusing on the opening intro, intimate verse, and dynamic rise into the emotional melody hook.'
    );
  } else {
    directionLines.push(
      'Format: Full complete song with balanced progression across intro, verse, pre-chorus, chorus, bridge, and emotional outro.'
    );
  }

  // 3. Extract Clean Lyrics
  const lyricsBody = extractCleanLyrics(blueprint);

  // 4. Combine into clean 2-section prompt
  const fullPrompt = `MUSIC DIRECTION:
${directionLines.join('\n')}

LYRICS:
${lyricsBody}`;

  return fullPrompt.trim();
}
