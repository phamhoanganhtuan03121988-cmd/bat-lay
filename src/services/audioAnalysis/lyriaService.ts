/**
 * BẮT LẤY V3 — Lyria 3.5 Music Generation Service
 * 
 * Flow:
 * ORIGINAL RECORDING + DSP DATA + CREATIVITY CONTROLS
 *         ↓
 * GEMINI 3.6 FLASH (Tạo Music Blueprint & Lyria Prompt)
 *         ↓
 * LYRIA 3.5 (Tạo Audio Demo qua Gemini Interactions API)
 *         ↓
 * GENERATED SONG (Audio Blob lưu trong IndexedDB, không ghi đè bản gốc)
 */

import { AudioIdea, MusicBlueprint, GeneratedSong, SongSection } from '../../types';
import { getStoredApiKey } from './apiKeyStorage';

export interface GenerateDemoResult {
  song: GeneratedSong;
  blueprint: MusicBlueprint;
}

/**
 * Helper to safely convert Base64 to Blob
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
 * Step 1: Generate a comprehensive Music Blueprint using Gemini 3.6 Flash
 */
export async function createMusicBlueprint(idea: AudioIdea): Promise<MusicBlueprint> {
  const apiKey = getStoredApiKey();
  if (!apiKey) {
    throw new Error('Gemini chưa được kết nối. Vui lòng cấu hình API Key trong mục Cài đặt.');
  }

  const keepMelody = idea.keepMelodyPct ?? 80;
  const keepLyric = idea.keepLyricPct ?? 70;
  const currentLyrics = idea.lyrics || idea.developedLyric || idea.originalLyric || idea.transcript || '';
  const sectionsSummary = idea.songSections && idea.songSections.length > 0
    ? idea.songSections.map((s) => `[${s.type} - ${s.title}]: ${s.content} (Hợp âm: ${s.chords || 'chưa có'})`).join('\n')
    : 'Chưa có phân đoạn cụ thể. Hãy cấu trúc thành [Intro], [Verse 1], [Chorus], [Bridge], [Outro].';

  const prompt = `
Bạn là Giám đốc Âm nhạc và Nhà sản xuất (Music Producer / Arranger) đỉnh cao trong ứng dụng sáng tác "BẮT LẤY".
Nhiệm vụ của bạn là chuyển hóa ý tưởng bài hát hiện tại thành một BẢN THIẾT KẾ ÂM NHẠC (MUSIC BLUEPRINT) chi tiết và một LYRIA PROMPT tối ưu dành riêng cho mô hình tạo nhạc âm thanh AI Lyria 3.5 của Google DeepMind.

DỮ LIỆU ĐẦU VÀO CỦA DỰ ÁN:
- Tên dự án: "${idea.title}"
- Thời lượng thu âm gốc: ${idea.duration.toFixed(1)} giây
- Thể loại gợi ý: ${idea.genreSuggestions?.map(g => g.name).join(', ') || 'Pop Ballad Việt Nam'}
- Tâm trạng / Cảm xúc: ${idea.emotion || 'Chân thành, lắng đọng'}
- Nhịp độ (BPM): ${idea.bpm || 68} BPM
- Giọng điệu (Key): ${idea.musicalKey || 'G Minor'}
- Mô tả đường nét giai điệu: ${idea.melodyDescription || idea.melodyData?.contourDescription || 'Giai điệu uyển chuyển'}
- Ca từ gốc: "${idea.originalLyric || idea.transcript || 'Chưa có lời rõ'}"
- Ca từ phát triển hiện tại:
${currentLyrics}

- Cấu trúc các phân đoạn hiện tại:
${sectionsSummary}

- Câu Hook / Điệp khúc đề xuất: "${idea.hookSuggestion || 'Chưa có'}"
- Hợp âm đề xuất: "${idea.harmonyChords || 'Chưa có'}"
- Định hướng phối khí: "${idea.arrangementDirection || 'Acoustic piano & modern strings'}"

THIẾT LẬP SÁNG TẠO:
- BẢO TOÀN GIAI ĐIỆU GỐC: ${keepMelody}% (Nếu cao >= 70%, bắt buộc bám sát tiết tấu, nốt cao trào và đường nét của bản thu).
- BẢO TOÀN CA TỪ GỐC: ${keepLyric}% (Nếu cao >= 70%, ưu tiên dùng đúng lời hiện có, chỉ bổ sung những đoạn còn khuyết).

HÃY TRẢ VỀ DUY NHẤT MỘT ĐỐI TƯỢNG JSON HỢP LỆ VỚI CÁC TRƯỜNG SAU:
{
  "title": "${idea.title}",
  "language": "Vietnamese",
  "genre": "...",
  "mood": "...",
  "tempo_bpm": ${idea.bpm || 68},
  "key": "${idea.musicalKey || 'G Minor'}",
  "duration_target": "about 2 minutes",
  "vocal_style": "...",
  "lyrics": "Toàn bộ lời bài hát tiếng Việt chuẩn có đánh dấu rõ ràng [Intro], [Verse 1], [Chorus], [Bridge], [Outro]...",
  "song_structure": [
    { "id": "s1", "type": "Intro", "title": "Mở đầu", "content": "...", "chords": "..." },
    { "id": "s2", "type": "Verse 1", "title": "Khổ 1", "content": "...", "chords": "..." },
    { "id": "s3", "type": "Chorus", "title": "Điệp khúc", "content": "...", "chords": "..." }
  ],
  "melody_direction": "Chỉ dẫn cao độ, nốt cao trào, tính luyến láy đặc trưng của giai điệu...",
  "harmony": "Tiến trình hợp âm tổng thể cho từng đoạn...",
  "instrumentation": "Danh sách nhạc cụ chi tiết (ví dụ: Grand Piano, Cello, Acoustic Drum Kit, Ambient Synth Pad, Bass)...",
  "production_direction": "Định hướng phối khí, không gian reverb, độ nén dynamics và cao trào âm nhạc...",
  "lyria_prompt": "Một prompt bằng tiếng Anh cực kỳ chi tiết, súc tích dành riêng cho Lyria 3.5. Prompt này phải mô tả chính xác genre, mood, tempo BPM, musical key, vocal character (expressive Vietnamese singing voice), detailed structure tags [Intro], [Verse], [Chorus] kèm lời tiếng Việt đầy đủ, instrumentation, arrangement flow và dynamics để Lyria tổng hợp bài hát hoàn chỉnh."
}
`;

  // Gọi Gemini 3.6 Flash qua Interactions API hoặc generateContent
  const interactionsUrl = `https://generativelanguage.googleapis.com/v1beta/interactions`;
  let rawJson = '';

  try {
    const response = await fetch(interactionsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        model: 'gemini-3.6-flash',
        input: [{ type: 'text', text: prompt }],
        generation_config: {
          temperature: 0.4,
          response_mime_type: 'application/json',
        },
      }),
    });

    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data.steps)) {
        for (const step of data.steps) {
          if (step.type === 'model_output' && Array.isArray(step.content)) {
            for (const c of step.content) {
              if (c.type === 'text' && c.text) {
                rawJson += c.text;
              }
            }
          }
        }
      }
      if (!rawJson && data.output_text) {
        rawJson = data.output_text;
      }
    } else {
      // Fallback sang generateContent nếu interactions trả về lỗi
      const genUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent`;
      const genResponse = await fetch(genUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.4,
            responseMimeType: 'application/json',
          },
        }),
      });

      if (!genResponse.ok) {
        const errJson = await genResponse.json().catch(() => null);
        const errMsg = errJson?.error?.message || `HTTP ${genResponse.status}`;
        handleLyriaApiError(genResponse.status, errMsg);
      }

      const genData = await genResponse.json();
      rawJson = genData.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('Paid Tier')) {
      throw err;
    }
    console.warn('Interactions error, trying fallback to generateContent:', err);
    // Fallback attempt
    const genUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent`;
    const genResponse = await fetch(genUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!genResponse.ok) {
      const errJson = await genResponse.json().catch(() => null);
      const errMsg = errJson?.error?.message || `HTTP ${genResponse.status}`;
      handleLyriaApiError(genResponse.status, errMsg);
    }

    const genData = await genResponse.json();
    rawJson = genData.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  // Parse JSON blueprint safely
  let blueprint: MusicBlueprint;
  try {
    const cleaned = rawJson.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    blueprint = {
      title: parsed.title || idea.title,
      language: parsed.language || 'Vietnamese',
      genre: parsed.genre || (idea.genreSuggestions?.[0]?.name ?? 'Pop Ballad'),
      mood: parsed.mood || idea.emotion || 'Chân thành',
      tempo_bpm: typeof parsed.tempo_bpm === 'number' ? parsed.tempo_bpm : (idea.bpm || 68),
      key: parsed.key || idea.musicalKey || 'G Minor',
      duration_target: parsed.duration_target || 'about 2 minutes',
      vocal_style: parsed.vocal_style || 'Warm, expressive emotional vocal',
      lyrics: parsed.lyrics || currentLyrics,
      song_structure: parsed.song_structure || idea.songSections || [],
      melody_direction: parsed.melody_direction || idea.melodyDescription || '',
      harmony: parsed.harmony || idea.harmonyChords || '',
      instrumentation: parsed.instrumentation || 'Grand Piano, Acoustic Guitar, Strings, Percussion',
      production_direction: parsed.production_direction || idea.arrangementDirection || '',
      lyria_prompt: parsed.lyria_prompt || generateFallbackLyriaPrompt(idea, currentLyrics),
    };
  } catch (parseError) {
    console.warn('Could not parse Gemini JSON blueprint, constructing standard blueprint:', parseError);
    blueprint = {
      title: idea.title,
      language: 'Vietnamese',
      genre: idea.genreSuggestions?.[0]?.name ?? 'Pop Ballad',
      mood: idea.emotion || 'Chân thành, sâu lắng',
      tempo_bpm: idea.bpm || 68,
      key: idea.musicalKey || 'G Minor',
      duration_target: 'about 2 minutes',
      vocal_style: 'Emotional Vietnamese singing voice with clear phrasing',
      lyrics: currentLyrics,
      song_structure: idea.songSections || [],
      melody_direction: idea.melodyDescription || 'Catchy melodious hook',
      harmony: idea.harmonyChords || 'Am - F - C - G',
      instrumentation: 'Piano, Acoustic Guitar, Bass, Strings',
      production_direction: idea.arrangementDirection || 'Warm modern pop ballad',
      lyria_prompt: generateFallbackLyriaPrompt(idea, currentLyrics),
    };
  }

  return blueprint;
}

/**
 * Step 2: Call Lyria 3.5 to synthesize the actual audio demo
 * Model: lyria-3.5
 * Endpoint: https://generativelanguage.googleapis.com/v1beta/interactions
 * Auth: x-goog-api-key header ONLY
 */
export async function callLyria35(
  blueprint: MusicBlueprint,
  projectId: string,
  versionName: string = 'Demo 01'
): Promise<GeneratedSong> {
  const apiKey = getStoredApiKey();
  if (!apiKey) {
    throw new Error('Gemini chưa được kết nối. Vui lòng cấu hình API Key trong mục Cài đặt.');
  }

  const interactionsUrl = 'https://generativelanguage.googleapis.com/v1beta/interactions';

  // Thử các model identifier theo tài liệu Gemini / Lyria
  const modelCandidates = ['lyria-3.5', 'lyria-3-pro-preview', 'lyria-3-clip-preview'];
  let audioBase64: string | null = null;
  let mimeType = 'audio/mp3';
  let successfulModel = 'lyria-3.5';
  let lastError: Error | null = null;

  for (const modelId of modelCandidates) {
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
              text: blueprint.lyria_prompt,
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
        const errMsg = errObj?.message || `HTTP ${response.status} ${response.statusText}`;

        // Nếu model 404 không tồn tại, thử candidate tiếp theo
        if (response.status === 404 || errMsg.toLowerCase().includes('not found')) {
          console.warn(`Model ${modelId} not found on interactions endpoint, trying candidate...`);
          continue;
        }

        // Nếu lỗi quota, billing hoặc paid tier
        handleLyriaApiError(response.status, errMsg, errObj?.details?.[0]?.reason);
      }

      const data = await response.json();

      // Extract audio output from response
      if (data.output_audio?.data) {
        audioBase64 = data.output_audio.data;
        if (data.output_audio.mime_type) mimeType = data.output_audio.mime_type;
        successfulModel = modelId;
        break;
      }

      // Check steps array
      if (Array.isArray(data.steps)) {
        for (const step of data.steps) {
          if (step.type === 'model_output' && Array.isArray(step.content)) {
            for (const item of step.content) {
              if (item.type === 'audio' && item.data) {
                audioBase64 = item.data;
                if (item.mime_type) mimeType = item.mime_type;
                successfulModel = modelId;
                break;
              }
              if (item.inlineData?.data) {
                audioBase64 = item.inlineData.data;
                if (item.inlineData.mimeType) mimeType = item.inlineData.mimeType;
                successfulModel = modelId;
                break;
              }
            }
          }
          if (audioBase64) break;
        }
      }

      if (audioBase64) {
        successfulModel = modelId;
        break;
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        lastError = err;
        // Nếu là lỗi đã được xử lý (Paid Tier, Quota, v.v.), quăng ra luôn
        if (err.message.includes('Paid Tier') || err.message.includes('Quota') || err.message.includes('Gemini:')) {
          throw err;
        }
      }
    }
  }

  // Nếu cả 3 models ở interactions đều không trả về audio hoặc chưa kích hoạt:
  // Thử phương thức generateContent của Lyria (chuẩn @google/genai music generation)
  if (!audioBase64) {
    try {
      const genUrl = `https://generativelanguage.googleapis.com/v1beta/models/lyria-3-pro-preview:generateContent`;
      const genResponse = await fetch(genUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: blueprint.lyria_prompt }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
          },
        }),
      });

      if (genResponse.ok) {
        const genData = await genResponse.json();
        const parts = genData.candidates?.[0]?.content?.parts;
        if (Array.isArray(parts)) {
          for (const p of parts) {
            if (p.inlineData?.data) {
              audioBase64 = p.inlineData.data;
              if (p.inlineData.mimeType) mimeType = p.inlineData.mimeType;
              successfulModel = 'lyria-3-pro-preview';
              break;
            }
          }
        }
      } else {
        const errJson = await genResponse.json().catch(() => null);
        const errMsg = errJson?.error?.message || `HTTP ${genResponse.status}`;
        if (genResponse.status !== 404) {
          handleLyriaApiError(genResponse.status, errMsg);
        }
      }
    } catch (fallbackErr) {
      if (fallbackErr instanceof Error && (fallbackErr.message.includes('Paid Tier') || fallbackErr.message.includes('Quota'))) {
        throw fallbackErr;
      }
      console.warn('Lyria generateContent fallback error:', fallbackErr);
    }
  }

  // Nếu vẫn không nhận được audio thật từ API
  if (!audioBase64) {
    if (lastError) {
      throw lastError;
    }
    throw new Error(
      'Lyria 3.5 chưa thể tạo âm thanh lúc này. Yêu cầu Google Cloud Project đã bật dịch vụ Lyria (Paid Tier). Music Blueprint đã được lưu an toàn.'
    );
  }

  // Chuyển Base64 audio thành Blob thật
  const audioBlob = base64ToBlob(audioBase64, mimeType);

  const newGeneratedSong: GeneratedSong = {
    id: `demo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    projectId,
    versionName,
    createdAt: Date.now(),
    model: successfulModel,
    mimeType,
    audioBlob,
    blueprint,
    lyriaPrompt: blueprint.lyria_prompt,
  };

  return newGeneratedSong;
}

/**
 * Handle HTTP error codes strictly according to Section 15
 */
function handleLyriaApiError(status: number, message: string, reason?: string): never {
  const lower = (message + ' ' + (reason || '')).toLowerCase();

  if (status === 401 || lower.includes('api_key_invalid') || lower.includes('invalid api key')) {
    throw new Error('Khóa API không hợp lệ. Vui lòng kiểm tra lại trong phần Cài đặt.');
  }

  if (
    status === 403 ||
    lower.includes('billing') ||
    lower.includes('quota') ||
    lower.includes('permission_denied') ||
    lower.includes('tier') ||
    lower.includes('payment')
  ) {
    if (lower.includes('billing') || lower.includes('paid tier') || lower.includes('enable billing')) {
      throw new Error(
        'Lyria 3.5 yêu cầu Paid Tier trên Google Cloud / Gemini API. Vui lòng kích hoạt thanh toán (Pay-as-you-go) cho dự án của bạn.'
      );
    }
    if (lower.includes('quota') || status === 429) {
      throw new Error('Đã vượt quá hạn mức (Quota Exceeded) của Gemini / Lyria API. Vui lòng thử lại sau.');
    }
    throw new Error(`Lyria 3.5 yêu cầu Paid Tier. Chi tiết từ Google API: ${message}`);
  }

  if (status === 429) {
    throw new Error('Đã vượt quá hạn mức sử dụng (Rate Limit 429). Vui lòng thử lại sau giây lát.');
  }

  if (status >= 500) {
    throw new Error(`Máy chủ âm nhạc Lyria của Google đang bận (${status}). Vui lòng thử lại sau.`);
  }

  throw new Error(`Lỗi tạo bài hát từ Lyria 3.5: ${message}`);
}

/**
 * Fallback prompt generator for Lyria 3.5
 */
function generateFallbackLyriaPrompt(idea: AudioIdea, lyrics: string): string {
  const genre = idea.genreSuggestions?.[0]?.name || 'Vietnamese Pop Ballad';
  const bpm = idea.bpm || 68;
  const key = idea.musicalKey || 'G Minor';
  const mood = idea.emotion || 'Emotional and heartfelt';

  return `Produce a complete, emotionally resonant ${genre} track in ${key} at ${bpm} BPM.
Mood: ${mood}.
Language: Vietnamese.
Vocal: Warm, expressive, clear enunciation Vietnamese vocal.
Instrumentation: Acoustic grand piano, delicate acoustic guitar picking, lush cinematic string quartet, warm sub-bass, and gentle drum groove.
Structure & Dynamics:
- Intro: Delicate piano arpeggios setting a melancholic yet hopeful atmosphere.
- Verse: Intimate storytelling vocals with minimal acoustic accompaniment.
- Chorus: Soaring dynamic vocal climax with full strings and uplifting drum rhythm.
- Bridge: Modulating emotional peak with expressive vocal runs.
- Outro: Soft acoustic resolve fading into silence.
Lyrics:
${lyrics || 'Em là giai điệu êm đềm trong những ngày mưa'}
Keep original melody hooks and lyrical sentiment authentic.`;
}
