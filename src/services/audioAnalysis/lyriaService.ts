/**
 * BẮT LẤY V3.1 — Lyria Music Generation Service
 * 
 * Pipeline:
 * Original recording
 *   → Web Audio DSP
 *   → Gemini 3.6 Flash (Music Blueprint)
 *   → Lyria Prompt Builder (src/services/musicGeneration/lyriaPromptBuilder.ts)
 *   → Lyria Clip Preview (lyria-3-clip-preview, 30s, $0.04)
 *   → Người dùng nghe thử
 *   → Nếu thích: Lyria 3.5 Full Song (lyria-3.5, $0.08)
 * 
 * Đảm bảo:
 * - Không retry tự động trong bất kỳ trường hợp nào
 * - Phân loại lỗi chính xác (Policy reason, Billing, Auth, Network)
 * - Lưu generation record vào IndexedDB để debug prompt nguyên văn
 * - Không ghi đè bản thu gốc
 */

import {
  AudioIdea,
  MusicBlueprint,
  GeneratedSong,
  GenerationRecord,
  GenerationType,
  LYRIA_CLIP_ESTIMATED_COST,
  LYRIA_FULL_ESTIMATED_COST,
} from '../../types';
import { getStoredApiKey } from './apiKeyStorage';
import { buildLyriaPrompt } from '../musicGeneration/lyriaPromptBuilder';
import { saveGenerationRecord } from '../../lib/db';

export { LYRIA_CLIP_ESTIMATED_COST, LYRIA_FULL_ESTIMATED_COST };

export class LyriaApiError extends Error {
  errorCode: 'POLICY_BLOCKED' | 'BILLING' | 'AUTH' | 'NETWORK' | 'UNKNOWN';
  userMessage: string;
  rawErrorDetails: string;

  constructor(
    errorCode: 'POLICY_BLOCKED' | 'BILLING' | 'AUTH' | 'NETWORK' | 'UNKNOWN',
    userMessage: string,
    rawErrorDetails: string
  ) {
    super(userMessage);
    this.name = 'LyriaApiError';
    this.errorCode = errorCode;
    this.userMessage = userMessage;
    this.rawErrorDetails = rawErrorDetails;
  }
}

/**
 * Helper to safely convert Base64 to Blob without quality loss
 */
function base64ToBlob(base64Data: string, mimeType: string = 'audio/mp3'): Blob {
  const cleanBase64 = base64Data.replace(/[\r\n\s]/g, '');
  const byteCharacters = atob(cleanBase64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

/**
 * Step 1: Generate a clean, musical Music Blueprint using Gemini 3.6 Flash
 */
export async function createMusicBlueprint(idea: AudioIdea): Promise<MusicBlueprint> {
  const apiKey = getStoredApiKey();
  if (!apiKey) {
    throw new LyriaApiError(
      'AUTH',
      'API key không hợp lệ hoặc không có quyền sử dụng model.',
      'No API key found in localStorage'
    );
  }

  const keepMelody = idea.keepMelodyPct ?? 80;
  const keepLyric = idea.keepLyricPct ?? 70;
  const currentLyrics =
    idea.lyrics || idea.developedLyric || idea.originalLyric || idea.transcript || '';
  const sectionsSummary =
    idea.songSections && idea.songSections.length > 0
      ? idea.songSections
          .map(
            (s) => `[${s.type} - ${s.title}]: ${s.content} (Hợp âm: ${s.chords || 'chưa có'})`
          )
          .join('\n')
      : 'Cấu trúc tiêu chuẩn: [Intro], [Verse 1], [Chorus], [Bridge], [Outro].';

  const prompt = `
Bạn là Giám đốc Âm nhạc và Nhà sản xuất trong ứng dụng sáng tác "BẮT LẤY".
Nhiệm vụ: Chuyển hóa ý tưởng bài hát hiện tại thành một BẢN THIẾT KẾ ÂM NHẠC (MUSIC BLUEPRINT) dạng JSON.

QUY TẮC AN TOÀN VÀ BẢN QUYỀN (BẮT BUỘC):
- TUYỆT ĐỐI KHÔNG đưa tên ca sĩ, nghệ sĩ, ban nhạc hoặc tên bài hát có sẵn vào bất kỳ trường nào.
- KHÔNG dùng cụm từ như "phong cách Sơn Tùng", "giống Taylor Swift", "in the style of...".
- Chỉ mô tả đặc tính âm nhạc thuần túy: thể loại, nhịp điệu BPM, giọng điệu, nhạc cụ, không gian âm thanh, và ca từ.

DỮ LIỆU ĐẦU VÀO CỦA DỰ ÁN:
- Tên dự án: "${idea.title}"
- Thể loại dự kiến: ${idea.genreSuggestions?.map((g) => g.name).join(', ') || 'Pop Ballad'}
- Cảm xúc: ${idea.emotion || 'Chân thành, sâu lắng'}
- Nhịp độ (BPM): ${idea.bpm || 68}
- Giọng điệu (Key): ${idea.musicalKey || 'G Minor'}
- Ca từ hiện tại:
${currentLyrics}

- Phân đoạn cấu trúc hiện tại:
${sectionsSummary}

- Câu Hook: "${idea.hookSuggestion || 'Chưa có'}"
- Hợp âm: "${idea.harmonyChords || 'Am - F - C - G'}"
- Định hướng phối khí: "${idea.arrangementDirection || 'Acoustic piano, strings và gentle drums'}"

THIẾT LẬP BẢO TOÀN:
- Giữ giai điệu: ${keepMelody}%
- Giữ ca từ: ${keepLyric}%

HÃY TRẢ VỀ DUY NHẤT MỘT ĐỐI TƯỢNG JSON HỢP LỆ (KHÔNG KÈM TEXT NGOÀI):
{
  "title": "${idea.title}",
  "language": "Vietnamese",
  "genre": "Tên thể loại âm nhạc thuần túy (ví dụ: Vietnamese Melancholic Pop Ballad)",
  "mood": "Mô tả tâm trạng",
  "tempo_bpm": ${idea.bpm || 68},
  "key": "${idea.musicalKey || 'G Minor'}",
  "duration_target": "about 2 minutes",
  "vocal_style": "Đặc tính giọng hát (ví dụ: Warm, intimate Vietnamese vocal with clear emotional phrasing)",
  "lyrics": "Toàn bộ ca từ tiếng Việt hoàn chỉnh có đánh dấu rõ các phần [Intro], [Verse], [Chorus], [Bridge], [Outro]",
  "song_structure": [
    { "id": "s1", "type": "Intro", "title": "Mở đầu", "content": "...", "chords": "..." },
    { "id": "s2", "type": "Verse 1", "title": "Khổ 1", "content": "...", "chords": "..." },
    { "id": "s3", "type": "Chorus", "title": "Điệp khúc", "content": "...", "chords": "..." }
  ],
  "melody_direction": "Chỉ dẫn đường nét giai điệu",
  "harmony": "Tiến trình hợp âm",
  "instrumentation": "Nhạc cụ phối khí (ví dụ: Soft grand piano, acoustic guitar, delicate string quartet, subtle percussion)",
  "production_direction": "Định hướng không gian phối khí, dynamic và cao trào"
}
`;

  let rawJson = '';

  try {
    const genUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent`;
    const response = await fetch(genUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => null);
      const errMsg = errJson?.error?.message || `HTTP ${response.status}`;
      classifyAndThrowError(response.status, errMsg);
    }

    const genData = await response.json();
    rawJson = genData.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } catch (err: unknown) {
    if (err instanceof LyriaApiError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
      throw new LyriaApiError(
        'NETWORK',
        'Không thể kết nối tới Gemini API. Hãy kiểm tra kết nối và thử lại.',
        msg
      );
    }
    throw new LyriaApiError('UNKNOWN', `Lỗi phân tích Music Blueprint: ${msg}`, msg);
  }

  let blueprint: MusicBlueprint;
  try {
    const cleaned = rawJson.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    blueprint = {
      title: parsed.title || idea.title,
      language: parsed.language || 'Vietnamese',
      genre: parsed.genre || (idea.genreSuggestions?.[0]?.name ?? 'Vietnamese Pop Ballad'),
      mood: parsed.mood || idea.emotion || 'Chân thành, lắng đọng',
      tempo_bpm: typeof parsed.tempo_bpm === 'number' ? parsed.tempo_bpm : (idea.bpm || 68),
      key: parsed.key || idea.musicalKey || 'G Minor',
      duration_target: parsed.duration_target || 'about 2 minutes',
      vocal_style: parsed.vocal_style || 'Intimate, expressive Vietnamese vocal',
      lyrics: parsed.lyrics || currentLyrics,
      song_structure: parsed.song_structure || idea.songSections || [],
      melody_direction: parsed.melody_direction || idea.melodyDescription || '',
      harmony: parsed.harmony || idea.harmonyChords || 'Am - F - C - G',
      instrumentation:
        parsed.instrumentation || 'Acoustic piano, acoustic guitar, warm strings, gentle percussion',
      production_direction: parsed.production_direction || idea.arrangementDirection || '',
      lyria_prompt: '', // Sẽ được sinh bởi LyriaPromptBuilder bên dưới
    };
  } catch (parseErr) {
    console.warn('Could not parse Gemini JSON blueprint, constructing standard fallback:', parseErr);
    blueprint = {
      title: idea.title,
      language: 'Vietnamese',
      genre: idea.genreSuggestions?.[0]?.name ?? 'Vietnamese Pop Ballad',
      mood: idea.emotion || 'Chân thành, sâu lắng',
      tempo_bpm: idea.bpm || 68,
      key: idea.musicalKey || 'G Minor',
      duration_target: 'about 2 minutes',
      vocal_style: 'Warm, expressive Vietnamese vocal',
      lyrics: currentLyrics,
      song_structure: idea.songSections || [],
      melody_direction: idea.melodyDescription || '',
      harmony: idea.harmonyChords || 'Am - F - C - G',
      instrumentation: 'Soft grand piano, acoustic guitar, string ensemble',
      production_direction: idea.arrangementDirection || 'Warm modern acoustic ballad',
      lyria_prompt: '',
    };
  }

  // Sử dụng LyriaPromptBuilder để gắn prompt sạch
  blueprint.lyria_prompt = buildLyriaPrompt(blueprint, {
    keepMelodyPct: keepMelody,
    keepLyricPct: keepLyric,
    isClip: false,
  });

  return blueprint;
}

/**
 * Step 2: Main audio generation with Lyria
 * Supports:
 * - generationType = 'clip' (model: lyria-3-clip-preview, 30s, cost: $0.04)
 * - generationType = 'full' (model: lyria-3.5, full song, cost: $0.08)
 * 
 * Lưu ý: Tuyệt đối KHÔNG tự động retry!
 */
export async function generateLyriaAudio(options: {
  idea: AudioIdea;
  blueprint: MusicBlueprint;
  generationType: GenerationType;
  versionName?: string;
}): Promise<GeneratedSong> {
  const { idea, blueprint, generationType } = options;
  const apiKey = getStoredApiKey();

  if (!apiKey) {
    throw new LyriaApiError(
      'AUTH',
      'API key không hợp lệ hoặc không có quyền sử dụng model.',
      'Missing API key'
    );
  }

  const isClip = generationType === 'clip';
  const modelId = isClip ? 'lyria-3-clip-preview' : 'lyria-3.5';
  const estimatedCost = isClip ? LYRIA_CLIP_ESTIMATED_COST : LYRIA_FULL_ESTIMATED_COST;

  // Xây dựng prompt chuẩn sạch qua LyriaPromptBuilder
  const cleanPrompt = buildLyriaPrompt(blueprint, {
    keepMelodyPct: idea.keepMelodyPct ?? 80,
    keepLyricPct: idea.keepLyricPct ?? 70,
    isClip,
  });

  const recordId = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const defaultVersionName =
    options.versionName ||
    (isClip
      ? `Clip 30s #${(idea.generatedSongs?.filter((s) => s.generationType === 'clip').length || 0) + 1}`
      : `Demo ${((idea.generatedSongs?.filter((s) => s.generationType !== 'clip').length || 0) + 1)
          .toString()
          .padStart(2, '0')}`);

  let audioBase64: string | null = null;
  let mimeType = 'audio/mp3';
  let rawErrorText = '';

  const interactionsUrl = 'https://generativelanguage.googleapis.com/v1beta/interactions';

  try {
    const response = await fetch(interactionsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        model: modelId,
        input: [
          {
            type: 'text',
            text: cleanPrompt,
          },
        ],
        response_format: {
          type: 'audio',
        },
      }),
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => null);
      const errObj = Array.isArray(errJson) ? errJson[0]?.error : errJson?.error;
      const errMsg =
        errObj?.message ||
        `HTTP ${response.status} ${response.statusText}`;
      rawErrorText = JSON.stringify(errJson || errMsg);

      // Phân loại và throw lỗi, KHÔNG tự động retry
      classifyAndThrowError(response.status, errMsg, rawErrorText);
    }

    const data = await response.json();

    // Parse audio an toàn theo yêu cầu 12: iterate toàn bộ response parts/steps
    if (data.output_audio?.data) {
      audioBase64 = data.output_audio.data;
      if (data.output_audio.mime_type) mimeType = data.output_audio.mime_type;
    }

    if (!audioBase64 && Array.isArray(data.steps)) {
      for (const step of data.steps) {
        if (step.type === 'model_output' && Array.isArray(step.content)) {
          for (const item of step.content) {
            if (item.type === 'audio' && item.data) {
              audioBase64 = item.data;
              if (item.mime_type) mimeType = item.mime_type;
              break;
            }
            if (item.inlineData?.data) {
              audioBase64 = item.inlineData.data;
              if (item.inlineData.mimeType) mimeType = item.inlineData.mimeType;
              break;
            }
          }
        }
        if (audioBase64) break;
      }
    }

    // Nếu không có audio trong response của interactions
    if (!audioBase64) {
      rawErrorText = `Interactions response did not contain audio data. Keys: ${Object.keys(data).join(', ')}`;
      throw new LyriaApiError(
        'UNKNOWN',
        'Mô hình chưa trả về dữ liệu âm thanh. Music Blueprint đã được lưu an toàn.',
        rawErrorText
      );
    }

    // Tạo generation record thành công và lưu IndexedDB
    const successRecord: GenerationRecord = {
      id: recordId,
      projectId: idea.id,
      model: modelId,
      prompt: cleanPrompt,
      generationType,
      estimatedCost,
      createdAt: Date.now(),
      status: 'success',
    };
    await saveGenerationRecord(successRecord);

    // Chuyển Base64 sang Blob
    const audioBlob = base64ToBlob(audioBase64, mimeType);

    const generatedSong: GeneratedSong = {
      id: `demo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      projectId: idea.id,
      versionName: defaultVersionName,
      createdAt: Date.now(),
      model: modelId,
      mimeType,
      audioBlob,
      blueprint: {
        ...blueprint,
        lyria_prompt: cleanPrompt,
      },
      lyriaPrompt: cleanPrompt,
      generationType,
      estimatedCost,
    };

    return generatedSong;
  } catch (err: unknown) {
    let apiError: LyriaApiError;

    if (err instanceof LyriaApiError) {
      apiError = err;
    } else {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
        apiError = new LyriaApiError(
          'NETWORK',
          'Không thể kết nối tới Gemini API. Hãy kiểm tra kết nối và thử lại.',
          msg
        );
      } else {
        apiError = new LyriaApiError('UNKNOWN', `Lỗi tạo nhạc từ Lyria: ${msg}`, msg);
      }
    }

    // Lưu generation record thất bại vào IndexedDB để debug prompt (Yêu cầu 10)
    const failureRecord: GenerationRecord = {
      id: recordId,
      projectId: idea.id,
      model: modelId,
      prompt: cleanPrompt,
      generationType,
      estimatedCost,
      createdAt: Date.now(),
      status: apiError.errorCode === 'POLICY_BLOCKED' ? 'blocked' : 'error',
      errorCode: apiError.errorCode,
      errorMessage: apiError.rawErrorDetails || apiError.message,
    };
    await saveGenerationRecord(failureRecord);

    // Ném lỗi ra cho UI xử lý (KHÔNG TỰ ĐỘNG RETRY)
    throw apiError;
  }
}

/**
 * Convenience method: Lyria Clip Preview (30 giây)
 */
export async function generateLyriaClip(
  idea: AudioIdea,
  blueprint: MusicBlueprint,
  versionName?: string
): Promise<GeneratedSong> {
  return generateLyriaAudio({
    idea,
    blueprint,
    generationType: 'clip',
    versionName,
  });
}

/**
 * Convenience method: Lyria Full Song (Bài đầy đủ)
 */
export async function generateLyriaFullSong(
  idea: AudioIdea,
  blueprint: MusicBlueprint,
  versionName?: string
): Promise<GeneratedSong> {
  return generateLyriaAudio({
    idea,
    blueprint,
    generationType: 'full',
    versionName,
  });
}

/**
 * Backward-compatible wrapper for V3 callLyria35
 */
export async function callLyria35(
  blueprint: MusicBlueprint,
  projectId: string,
  versionName: string = 'Demo 01'
): Promise<GeneratedSong> {
  // Mock-safe container idea wrapper
  const ideaWrapper: AudioIdea = {
    id: projectId,
    title: blueprint.title,
    createdAt: Date.now(),
    duration: 120,
    audioBlob: new Blob(),
    waveformData: [],
    favorite: false,
    analysisStatus: 'completed',
    keepMelodyPct: 80,
    keepLyricPct: 70,
  };

  return generateLyriaFullSong(ideaWrapper, blueprint, versionName);
}

/**
 * Error Classifier adhering strictly to Section 9:
 * 
 * 1. Policy/Safety:
 * "LYRIA KHÔNG THỂ TẠO BẢN NHẠC"
 * "Prompt âm nhạc này đã bị hệ thống an toàn của Lyria từ chối. Bản thu gốc và Music Blueprint của bạn vẫn được giữ nguyên."
 * 
 * 2. Billing:
 * "Chưa thể tạo nhạc vì project chưa có quyền sử dụng Lyria."
 * 
 * 3. Auth:
 * "API key không hợp lệ hoặc không có quyền sử dụng model."
 * 
 * 4. Network:
 * "Không thể kết nối tới Gemini API. Hãy kiểm tra kết nối và thử lại."
 */
function classifyAndThrowError(status: number, message: string, fullDetails: string = ''): never {
  const combined = `${message} ${fullDetails}`.toLowerCase();

  // 1. Policy / Content blocked reason (QUAN TRỌNG: Không coi đây là lỗi billing!)
  if (
    combined.includes('policy reason') ||
    combined.includes('request blocked') ||
    combined.includes('safety') ||
    combined.includes('blocked for an unspecified policy') ||
    combined.includes('content policy') ||
    combined.includes('violat') ||
    combined.includes('prohibited')
  ) {
    throw new LyriaApiError(
      'POLICY_BLOCKED',
      'Prompt âm nhạc này đã bị hệ thống an toàn của Lyria từ chối. Bản thu gốc và Music Blueprint của bạn vẫn được giữ nguyên.',
      message || fullDetails
    );
  }

  // 2. Auth error (401 hoặc invalid API key)
  if (
    status === 401 ||
    combined.includes('api_key_invalid') ||
    combined.includes('invalid api key') ||
    combined.includes('unauthenticated')
  ) {
    throw new LyriaApiError(
      'AUTH',
      'API key không hợp lệ hoặc không có quyền sử dụng model.',
      message || fullDetails
    );
  }

  // 3. Billing error (403 hoặc billing specific)
  if (
    status === 403 ||
    combined.includes('billing') ||
    combined.includes('credit') ||
    combined.includes('enable billing') ||
    combined.includes('pay-as-you-go') ||
    combined.includes('tier')
  ) {
    throw new LyriaApiError(
      'BILLING',
      'Chưa thể tạo nhạc vì project chưa có quyền sử dụng Lyria.',
      message || fullDetails
    );
  }

  // 4. Rate limit (429)
  if (status === 429 || combined.includes('quota') || combined.includes('rate limit')) {
    throw new LyriaApiError(
      'BILLING',
      'Đã vượt quá hạn mức sử dụng (Quota Exceeded) của Gemini / Lyria API. Vui lòng thử lại sau.',
      message || fullDetails
    );
  }

  // 5. Server errors (500+)
  if (status >= 500) {
    throw new LyriaApiError(
      'NETWORK',
      `Máy chủ âm nhạc Lyria của Google đang bận (HTTP ${status}). Vui lòng thử lại sau.`,
      message || fullDetails
    );
  }

  // Generic fallback
  throw new LyriaApiError(
    'UNKNOWN',
    `Lỗi tạo bài hát từ Lyria: ${message}`,
    message || fullDetails
  );
}
