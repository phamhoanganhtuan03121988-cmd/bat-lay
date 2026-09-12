/**
 * BẮT LẤY V3.2 — Lyria Prompt Builder
 * 
 * Nhiệm vụ:
 * Chuyển Music Blueprint thành một prompt tối ưu, sạch sẽ, an toàn dành riêng cho Lyria.
 * 
 * Cấu trúc 2 phần phân tách hoàn toàn:
 * MUSIC DIRECTION:
 * ...
 * 
 * LYRICS:
 * [Verse 1]
 * ...
 * [Chorus]
 * ...
 * 
 * Quy tắc an toàn (Tuân thủ nghiêm ngặt V3.2):
 * 1. Tuyệt đối KHÔNG đưa metadata nội bộ: keepMelodyPct, keepLyricPct, DSP counts, pitch Hz, IDs.
 * 2. Tuyệt đối KHÔNG yêu cầu Lyria "copy", "reproduce", "preserve exactly" giai điệu bản thu gốc.
 *    Thay bằng ngôn ngữ âm nhạc cấp cao:
 *    - "The song should feel emotionally similar to the captured idea, with a gentle melodic character and restrained phrasing."
 *    - "Use the captured melodic character as creative inspiration."
 * 3. Không có tên ca sĩ, nghệ sĩ, bài hát cụ thể, reference tracks.
 * 4. Lyrics tách hoàn toàn, không có commentary, không có "complete missing song sections" hay ghi chú lẫn vào.
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
export function sanitizeMusicalText(text: string): string {
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
  cleaned = cleaned.replace(/\b(?:explicit|copyright|trademark|unreleased|leak|stolen|pirate)\b/gi, '');

  // Remove any prompt injection or instruction strings
  cleaned = cleaned.replace(/\b(?:ignore previous instructions|system prompt|developer mode)\b/gi, '');

  // Clean redundant whitespace and empty punctuation
  cleaned = cleaned.replace(/\s+,/g, ',').replace(/,\s*,+/g, ',').replace(/\s{2,}/g, ' ').trim();

  return cleaned;
}

/**
 * Extract clean, structured lyrics without any commentaries or descriptions
 */
export function extractCleanLyrics(lyricsOrBlueprint: string | MusicBlueprint): string {
  let rawLyrics = '';
  let songSections: SongSection[] | undefined;

  if (typeof lyricsOrBlueprint === 'string') {
    rawLyrics = lyricsOrBlueprint;
  } else {
    rawLyrics = lyricsOrBlueprint.lyrics || '';
    if (Array.isArray(lyricsOrBlueprint.song_structure) && lyricsOrBlueprint.song_structure.length > 0) {
      const first = lyricsOrBlueprint.song_structure[0];
      if (typeof first === 'object' && first !== null && 'type' in first) {
        songSections = lyricsOrBlueprint.song_structure as SongSection[];
      }
    }
  }

  // If structured sections exist
  if (songSections && songSections.length > 0) {
    const formatted = songSections
      .filter((s) => s.content && s.content.trim().length > 0)
      .map((s) => {
        const typeName = s.type ? s.type.trim() : (s.title ? s.title.trim() : 'Verse');
        const cleanContent = s.content
          .replace(/\r\n/g, '\n')
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0 && !line.startsWith('//') && !line.startsWith('#'))
          .join('\n');
        return `[${typeName}]\n${cleanContent}`;
      });

    if (formatted.length > 0) {
      return formatted.join('\n\n');
    }
  }

  // Fallback to raw string parsing
  let text = rawLyrics
    .replace(/\r\n/g, '\n')
    .replace(/^\{.*\}$/s, '') // Strip any JSON accidentally included
    .trim();

  if (!text) {
    return `[Verse 1]
Gió khẽ lay từng nỗi nhớ đong đầy
Lắng nghe thời gian chầm chậm trôi qua đây

[Chorus]
Bắt lấy những rung động sâu thẳm trong lòng
Tìm lại bình yên sau những tháng năm trông chờ`;
  }

  // Remove lines that look like internal metadata or commentary
  const lines = text.split('\n').filter((l) => {
    const trimmed = l.trim();
    if (!trimmed) return false;
    if (trimmed.startsWith('//') || trimmed.startsWith('#')) return false;
    if (trimmed.toLowerCase().includes('keepmelody') || trimmed.toLowerCase().includes('keeplyric')) return false;
    if (trimmed.toLowerCase().includes('music blueprint') || trimmed.toLowerCase().includes('bpm')) return false;
    if (trimmed.toLowerCase().includes('complete missing')) return false;
    return true;
  });

  // If section tags like [Verse] are missing, format them neatly
  const hasSectionTags = lines.some((l) => l.trim().startsWith('[') && l.trim().endsWith(']'));
  if (!hasSectionTags) {
    if (lines.length > 4) {
      const half = Math.ceil(lines.length / 2);
      return `[Verse 1]\n${lines.slice(0, half).join('\n')}\n\n[Chorus]\n${lines.slice(half).join('\n')}`;
    } else {
      return `[Verse 1]\n${lines.join('\n')}`;
    }
  }

  return lines.join('\n');
}

/**
 * Main Production Prompt Builder:
 * Converts MusicBlueprint into a high-level, safe, two-part prompt
 */
export function buildLyriaPrompt(
  blueprint: MusicBlueprint,
  options: PromptBuilderOptions = {}
): string {
  const isClip = options.isClip ?? false;

  // 1. Sanitize base parameters
  const genre = sanitizeMusicalText(blueprint.genre) || 'Vietnamese pop ballad';
  const mood = sanitizeMusicalText(blueprint.mood) || 'emotional and heartfelt';
  const bpm = typeof blueprint.tempo_bpm === 'number' && blueprint.tempo_bpm > 0 ? blueprint.tempo_bpm : 68;
  const key = sanitizeMusicalText(blueprint.key) || 'G minor';
  const vocalStyle = sanitizeMusicalText(blueprint.vocal_style) || 'Expressive, warm Vietnamese singing voice with clear enunciation';
  const instrumentation = sanitizeMusicalText(blueprint.instrumentation) || 'Acoustic piano, acoustic guitar, delicate strings, subtle percussion';
  const production = sanitizeMusicalText(blueprint.production_direction) || 'Intimate acoustic ambiance with warm natural reverb and dynamic buildup';

  // 2. High-level musical description (NO internal percentages, NO "copy/reproduce original melody")
  const directionLines: string[] = [
    `Style: ${genre}.`,
    `Tempo: ${bpm} BPM.`,
    `Musical Key: ${key}.`,
    `Mood: ${mood}.`,
    `Vocals: ${vocalStyle}.`,
    `Instrumentation: ${instrumentation}.`,
    `Production & Arrangement: ${production}.`,
    'Musical phrasing: The song should feel emotionally similar to the captured idea, with a gentle descending melodic character and restrained phrasing.',
    'Creative approach: Use the captured melodic character as creative inspiration.',
  ];

  if (isClip) {
    directionLines.push(
      'Structure: 30-second preview clip focusing on the intro and emotional chorus hook.'
    );
  } else {
    directionLines.push(
      'Structure: Full song with natural acoustic progression across verse, chorus, bridge, and outro.'
    );
  }

  // 3. Extract Clean Lyrics without commentary
  const lyricsBody = extractCleanLyrics(blueprint);

  // 4. Combine into clean 2-section prompt strictly separated
  const fullPrompt = `MUSIC DIRECTION:
${directionLines.join('\n')}

LYRICS:
${lyricsBody}`;

  return fullPrompt.trim();
}
