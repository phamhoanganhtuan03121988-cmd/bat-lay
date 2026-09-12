/**
 * GeminiAudioAnalysisProvider
 * 
 * Implements client-side Gemini Multimodal AI integration using Bring Your Own Key (BYOK):
 * - Primary model: gemini-3.6-flash
 * - Prioritizes Interactions API (https://generativelanguage.googleapis.com/v1beta/interactions)
 *   with fallback to generateContent (https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent)
 * - Sends actual audio blob as base64 audio part
 * - Sends measured Local DSP acoustic facts (BPM, Key, Contour, Silence, RMS, Notes) and Creativity Settings to guide the model
 * - Receives structured JSON with Vietnamese transcription, lyrics, emotion, and musical development
 * - Strictly respects audio reality: no fabricated transcript for humming or instrument recordings
 * - Preserves Local DSP results if Gemini call fails and surfaces accurate error messages
 */

import {
  AudioAnalysisProvider,
  AudioAnalysisResult,
  InputClassification,
  GenreSuggestion,
  CreativitySettings,
  SongDevelopmentRequest,
  SongDevelopment,
  SongSection,
  LyricActionRequest,
} from './types';
import { analyzeAudioWithLocalDSP } from './localAudioAnalyzer';
import { getStoredApiKey, hasApiKeyConfigured } from './apiKeyStorage';

/**
 * Convert audio Blob into base64 string and sanitized mimeType for Gemini API
 */
async function blobToBase64(blob: Blob): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const matches = result.match(/^data:([^;]+).*?;base64,(.*)$/);
      if (matches && matches.length === 3) {
        let cleanMime = matches[1].toLowerCase();
        if (cleanMime.includes('webm')) cleanMime = 'audio/webm';
        else if (cleanMime.includes('mp4') || cleanMime.includes('m4a')) cleanMime = 'audio/mp4';
        else if (cleanMime.includes('wav')) cleanMime = 'audio/wav';
        else if (cleanMime.includes('aac')) cleanMime = 'audio/aac';
        else if (cleanMime.includes('ogg')) cleanMime = 'audio/ogg';
        else if (cleanMime.includes('mpeg') || cleanMime.includes('mp3')) cleanMime = 'audio/mp3';
        else cleanMime = 'audio/webm';

        resolve({ base64: matches[2], mimeType: cleanMime });
      } else {
        const parts = result.split(',');
        resolve({ base64: parts[1] || '', mimeType: 'audio/webm' });
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(blob);
  });
}

/**
 * Expected JSON Schema from Gemini (Specification Requirement 5)
 */
interface RawGeminiAnalysisResponse {
  transcript?: string | null;
  lyrics?: string | null;
  emotion?: {
    label?: string;
    description?: string;
  } | string;
  inputType?: InputClassification;
  inputTypeConfidence?: number;
  bpm?: number | null;
  key?: string | null;
  melodyDescription?: string | null;
  genreSuggestions?: Array<{
    genre?: string;
    name?: string;
    reason?: string;
  }>;
  developmentSuggestions?: string[];
  developedLyric?: string | null;
}

export class GeminiAudioAnalysisProvider implements AudioAnalysisProvider {
  name = 'Gemini 3.6 Flash Multimodal (BYOK)';

  isAiConnected(): boolean {
    return hasApiKeyConfigured();
  }

  /**
   * Run Gemini analysis using already calculated local DSP results and creativity settings
   */
  async analyzeWithDSP(
    blob: Blob,
    duration: number,
    localResult: AudioAnalysisResult,
    creativitySettings?: CreativitySettings
  ): Promise<AudioAnalysisResult> {
    const apiKey = getStoredApiKey();
    if (!apiKey) {
      return localResult;
    }

    const { base64, mimeType } = await blobToBase64(blob);
    if (!base64) {
      return localResult;
    }

    const keepMelodyPct = creativitySettings?.keepMelodyPct ?? 80;
    const keepLyricPct = creativitySettings?.keepLyricPct ?? 70;

    // Prompt providing full DSP context & strict Vietnamese music guidelines
    const prompt = `
Bạn là chuyên gia thẩm âm, nhạc sĩ và nhà sản xuất âm nhạc cao cấp trong ứng dụng sáng tác "BẮT LẤY".
Người dùng vừa thu âm một đoạn âm thanh ngẫu hứng (có thể là ngâm nga giai điệu không lời / humming, hát mộc có ca từ, nói ghi chú ý tưởng, hoặc chơi nhạc cụ).

THÔNG TIN BẢN GHI & ĐO ĐẠC VẬT LÝ TỪ BỘ XỬ LÝ TÍN HIỆU SỐ (WEB AUDIO DSP):
- Thời lượng bản ghi: ${duration.toFixed(1)} giây
- Năng lượng âm thanh trung bình (RMS): ${localResult.acousticFeatures?.avgRmsEnergy?.toFixed(4) ?? 'N/A'}
- Tỷ lệ khoảng lặng (Silence Ratio): ${localResult.acousticFeatures?.silenceRatio ? `${Math.round(localResult.acousticFeatures.silenceRatio * 100)}%` : 'N/A'}
- Đường nét cao độ đo được (Pitch Contour): ${localResult.acousticFeatures?.pitchContour || 'không xác định'}
- Số nốt nhạc sơ bộ phát hiện: ${localResult.acousticFeatures?.detectedNoteCount ?? 0} nốt
- Nhịp độ ước lượng từ DSP: ${localResult.tempo ? `${localResult.tempo} BPM` : 'Nhịp tự do / Chưa đủ chu kỳ rõ'}
- Gam giọng ước lượng từ DSP: ${localResult.key || 'Chưa đủ dữ liệu nốt'}
- Phân loại sơ bộ từ DSP: ${localResult.inputType} (Độ tin cậy: ${Math.round(localResult.confidence * 100)}%)

CÀI ĐẶT SÁNG TẠO CỦA TÁC GIẢ (CREATIVITY SETTINGS):
- Mức độ giữ giai điệu gốc: ${keepMelodyPct}%
- Mức độ giữ lời gốc: ${keepLyricPct}%

NGUYÊN TẮC PHÂN TÍCH QUAN TRỌNG:
1. Lắng nghe trực tiếp file audio đính kèm để thẩm định âm nhạc chân thực.
2. Thể loại đầu vào (inputType):
   - "singing_with_lyrics": Người dùng đang HÁT RÕ LỜI bằng tiếng Việt (hoặc ngôn ngữ khác).
   - "humming_melody": Người dùng đang NGÂM NGA GIAI ĐIỆU KHÔNG LỜI (ví dụ ngân nga "hừm", "la la", "na na", huýt sáo, ngâm giai điệu).
   - "spoken_idea": Người dùng đang NÓI bằng lời nói thông thường để ghi lại ý tưởng sáng tác hoặc cảm nghĩ.
   - "instrument_or_ambient": Tiếng đàn guitar, piano, huýt sáo nhạc cụ hoặc âm thanh tự do.
3. Bóc tách lời hát (transcript & lyrics):
   - NẾU LÀ "humming_melody" hoặc "instrument_or_ambient": TUYỆT ĐỐI KHÔNG BỊA RA LỜI HÁT! Hãy để "transcript": null và "lyrics": null. Tập trung mô tả chi tiết đường nét giai điệu và cảm xúc.
   - NẾU LÀ "singing_with_lyrics": Hãy nhận diện và bóc tách chính xác từng chữ lời hát tiếng Việt vào "transcript" và "lyrics".
   - NẾU LÀ "spoken_idea": Ghi lại chính xác câu nói của người dùng vào "transcript" và "lyrics".
4. Cảm xúc (emotion):
   - Phân tích cảm xúc thể hiện qua giọng hát, hơi thở, cách luyến láy và nội dung ca từ (nếu có). Trả về object { "label": "...", "description": "..." }.
5. Nhịp độ (bpm) & Gam giọng (key):
   - Nếu bạn thẩm âm được rõ ràng tempo (BPM) hoặc gam giọng (key) từ audio, hãy cung cấp số BPM (ví dụ 88) và tên gam (ví dụ "C Major", "A Minor", "E Minor", "G Major"). Nếu nhịp tự do hoặc không đủ rõ, để null (sẽ bảo tồn số liệu DSP).
6. Đường nét giai điệu (melodyDescription):
   - Mô tả đường nét giai điệu (ví dụ: "Giai điệu lượn sóng nhẹ nhàng ở âm khu trung, kết thúc bằng nốt ngân dài tạo cảm giác bâng khuâng").
7. Gợi ý thể loại (genreSuggestions):
   - 2-3 thể loại âm nhạc phù hợp (ví dụ "Acoustic Pop", "R&B Lo-Fi", "Indie Folk", "Ballad da diết") kèm lý do âm nhạc cụ thể kết hợp với nhịp và gam.
8. Gợi ý phát triển (developmentSuggestions):
   - 2-4 ý tưởng phát triển cụ thể:
     + Nếu có lời hát hoặc ngâm nga giai điệu: gợi ý 2-4 câu hát tiếng Việt phát triển tiếp nối cho đoạn điệp khúc hoặc lời 2 (theo tỷ lệ giữ lời ${keepLyricPct}% và giữ giai điệu ${keepMelodyPct}%).
     + Lời khuyên hòa âm, cấu trúc bài hoặc nhịp trống tiếp theo.

ĐỊNH DẠNG BẮT BUỘC:
Trả về DUY NHẤT một chuỗi JSON hợp lệ theo đúng cấu trúc schema sau, không thêm lời dẫn giải ngoài JSON:
{
  "transcript": string | null,
  "lyrics": string | null,
  "emotion": {
    "label": string,
    "description": string
  },
  "inputType": "singing_with_lyrics" | "humming_melody" | "spoken_idea" | "instrument_or_ambient",
  "inputTypeConfidence": number,
  "bpm": number | null,
  "key": string | null,
  "melodyDescription": string,
  "genreSuggestions": [
    {
      "genre": string,
      "reason": string
    }
  ],
  "developmentSuggestions": [
    string
  ]
}
`.trim();

    let rawText = '';

    // Step 1: Attempt Gemini Interactions API first (Google's recommended API for Gemini 3 series)
    const interactionsUrl = `https://generativelanguage.googleapis.com/v1beta/interactions?key=${encodeURIComponent(apiKey)}`;
    let interactionsSuccess = false;

    try {
      const response = await fetch(interactionsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gemini-3.6-flash',
          input: [
            {
              type: 'audio',
              data: base64,
              mime_type: mimeType,
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
          generation_config: {
            temperature: 0.3,
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Extract text from Interactions steps array
        if (Array.isArray(data.steps)) {
          for (const step of data.steps) {
            if (step.type === 'model_output' && Array.isArray(step.content)) {
              for (const c of step.content) {
                if (c.type === 'text' && c.text) {
                  rawText += c.text;
                }
              }
            }
          }
        }
        if (!rawText && data.output_text) {
          rawText = data.output_text;
        }
        if (rawText) {
          interactionsSuccess = true;
        }
      } else {
        const errJson = await response.json().catch(() => null);
        const errObj = Array.isArray(errJson) ? errJson[0]?.error : errJson?.error;
        const errMsg = errObj?.message || `HTTP ${response.status} ${response.statusText}`;

        // If not 404, we throw the specific error so user sees the real cause
        if (response.status !== 404) {
          console.warn('Interactions API returned error:', errMsg);
          this.handleApiHttpError(response.status, errMsg, errObj?.details?.[0]?.reason);
        }
        console.warn('Interactions API 404, attempting generateContent fallback...');
      }
    } catch (netErr: unknown) {
      if (netErr instanceof Error && netErr.message.startsWith('Gemini:')) {
        throw netErr;
      }
      console.warn('Interactions API network/fetch error, trying generateContent fallback:', netErr);
    }

    // Step 2: Fallback to generateContent with gemini-3.6-flash if Interactions API did not return text
    if (!interactionsSuccess) {
      const generateUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
      try {
        const response = await fetch(generateUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  {
                    inlineData: {
                      mimeType,
                      data: base64,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.3,
            },
          }),
        });

        if (!response.ok) {
          const errJson = await response.json().catch(() => null);
          const errObj = Array.isArray(errJson) ? errJson[0]?.error : errJson?.error;
          const errMsg = errObj?.message || `HTTP ${response.status} ${response.statusText}`;
          console.warn('generateContent API returned error:', errMsg);
          this.handleApiHttpError(response.status, errMsg, errObj?.details?.[0]?.reason);
        }

        const data = await response.json();
        const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (candidateText) {
          rawText = candidateText;
        }
      } catch (genErr: unknown) {
        if (genErr instanceof Error && genErr.message.startsWith('Gemini:')) {
          throw genErr;
        }
        console.error('generateContent call failed:', genErr);
        throw new Error(
          'Không thể kết nối đến máy chủ Google Gemini. Vui lòng kiểm tra kết nối mạng của bạn.'
        );
      }
    }

    if (!rawText || !rawText.trim()) {
      throw new Error('Gemini không trả về nội dung phân tích âm thanh.');
    }

    // Parse JSON safely (handling markdown code blocks if wrapped)
    let parsed: RawGeminiAnalysisResponse;
    try {
      const jsonMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/) || rawText.match(/([\{\[][\s\S]*[\}\]])/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[1] : rawText);
    } catch (jsonErr) {
      console.warn('Could not parse Gemini JSON directly, raw was:', rawText);
      throw new Error('Gemini trả về định dạng phân tích không hợp lệ. Bản ghi gốc vẫn được bảo toàn.');
    }

    // Extract transcript and lyrics (never invent lyrics for humming!)
    const cleanTranscript = parsed.transcript ? String(parsed.transcript).trim() : null;
    const cleanLyrics = parsed.lyrics ? String(parsed.lyrics).trim() : null;

    // Extract emotion
    let emotionStr: string | null = null;
    if (parsed.emotion) {
      if (typeof parsed.emotion === 'object') {
        const label = parsed.emotion.label?.trim() || '';
        const desc = parsed.emotion.description?.trim() || '';
        emotionStr = label && desc ? `${label} - ${desc}` : (label || desc || null);
      } else {
        emotionStr = String(parsed.emotion).trim() || null;
      }
    }

    // Extract genre suggestions
    let mergedGenres: GenreSuggestion[] = [];
    if (Array.isArray(parsed.genreSuggestions) && parsed.genreSuggestions.length > 0) {
      mergedGenres = parsed.genreSuggestions.map((g) => ({
        name: g.genre?.trim() || g.name?.trim() || 'Indie Pop',
        reason: g.reason?.trim() || '',
      }));
    } else {
      mergedGenres = localResult.genreSuggestions;
    }

    // Extract development suggestions
    let mergedIdeas: string[] = [];
    if (Array.isArray(parsed.developmentSuggestions) && parsed.developmentSuggestions.length > 0) {
      mergedIdeas = parsed.developmentSuggestions.map((s) => String(s).trim()).filter(Boolean);
    } else {
      mergedIdeas = localResult.developmentIdeas;
    }

    // Extract or derive developed lyric suggestions
    let developedLyric: string | null = parsed.developedLyric?.trim() || null;
    if (!developedLyric && mergedIdeas.length > 0) {
      const poeticCandidate = mergedIdeas.find((s) => s.includes('\n') || s.length > 35);
      if (poeticCandidate) developedLyric = poeticCandidate;
    }

    // Real BPM & Key validation: refine DSP if model found high-certainty musical values
    const finalBpm =
      typeof parsed.bpm === 'number' && parsed.bpm > 40 && parsed.bpm < 240
        ? Math.round(parsed.bpm)
        : localResult.tempo;

    const finalKey =
      parsed.key && typeof parsed.key === 'string' && parsed.key.trim().length > 0 && parsed.key !== 'null'
        ? parsed.key.trim()
        : localResult.key;

    const inputType: InputClassification =
      parsed.inputType === 'singing_with_lyrics' ||
      parsed.inputType === 'humming_melody' ||
      parsed.inputType === 'spoken_idea' ||
      parsed.inputType === 'instrument_or_ambient'
        ? parsed.inputType
        : localResult.inputType;

    const confidence =
      typeof parsed.inputTypeConfidence === 'number' && parsed.inputTypeConfidence > 0
        ? Math.min(1, Math.max(0.6, parsed.inputTypeConfidence))
        : Math.max(localResult.confidence, 0.9);

    return {
      ...localResult,
      inputType,
      hasSpeech: inputType === 'singing_with_lyrics' || inputType === 'spoken_idea',
      transcript: cleanTranscript,
      originalLyric: cleanLyrics || cleanTranscript || null,
      developedLyric: developedLyric || null,
      emotion: emotionStr || localResult.emotion,
      tempo: finalBpm,
      key: finalKey,
      melodyDescription: parsed.melodyDescription?.trim() || localResult.melodyDescription,
      genreSuggestions: mergedGenres,
      developmentIdeas: mergedIdeas,
      confidence,
      analyzedWith: 'hybrid',
      needsAiConnectionFor: [],
    };
  }

  /**
   * Universal internal caller with Dual-API support:
   * 1. Interactions API (v1beta/interactions)
   * 2. Fallback to generateContent (v1beta/models/gemini-3.6-flash:generateContent)
   */
  private async executeGeminiPrompt(
    apiKey: string,
    prompt: string,
    audio?: { base64: string; mimeType: string },
    temperature: number = 0.4
  ): Promise<string> {
    let rawText = '';
    let interactionsSuccess = false;

    // 1. Try Interactions API first
    const interactionsUrl = `https://generativelanguage.googleapis.com/v1beta/interactions?key=${encodeURIComponent(apiKey)}`;
    try {
      const inputItems: Array<{ type: string; data?: string; mime_type?: string; text?: string }> = [];
      if (audio && audio.base64) {
        inputItems.push({
          type: 'audio',
          data: audio.base64,
          mime_type: audio.mimeType,
        });
      }
      inputItems.push({
        type: 'text',
        text: prompt,
      });

      const response = await fetch(interactionsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gemini-3.6-flash',
          input: inputItems,
          generation_config: { temperature },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data.steps)) {
          for (const step of data.steps) {
            if (step.type === 'model_output' && Array.isArray(step.content)) {
              for (const c of step.content) {
                if (c.type === 'text' && c.text) {
                  rawText += c.text;
                }
              }
            }
          }
        }
        if (!rawText && data.output_text) {
          rawText = data.output_text;
        }
        if (rawText) {
          interactionsSuccess = true;
        }
      } else if (response.status !== 404) {
        const errJson = await response.json().catch(() => null);
        const errObj = Array.isArray(errJson) ? errJson[0]?.error : errJson?.error;
        const errMsg = errObj?.message || `HTTP ${response.status} ${response.statusText}`;
        this.handleApiHttpError(response.status, errMsg, errObj?.details?.[0]?.reason);
      }
    } catch (netErr: unknown) {
      if (netErr instanceof Error && netErr.message.startsWith('Gemini:')) {
        throw netErr;
      }
      console.warn('Interactions API non-fatal error, falling back to generateContent:', netErr);
    }

    // 2. Fallback to generateContent
    if (!interactionsSuccess) {
      const generateUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
      try {
        const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];
        parts.push({ text: prompt });
        if (audio && audio.base64) {
          parts.push({
            inlineData: {
              mimeType: audio.mimeType,
              data: audio.base64,
            },
          });
        }

        const response = await fetch(generateUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: {
              responseMimeType: prompt.includes('JSON') ? 'application/json' : 'text/plain',
              temperature,
            },
          }),
        });

        if (!response.ok) {
          const errJson = await response.json().catch(() => null);
          const errObj = Array.isArray(errJson) ? errJson[0]?.error : errJson?.error;
          const errMsg = errObj?.message || `HTTP ${response.status} ${response.statusText}`;
          this.handleApiHttpError(response.status, errMsg, errObj?.details?.[0]?.reason);
        }

        const data = await response.json();
        const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (candidateText) {
          rawText = candidateText;
        }
      } catch (genErr: unknown) {
        if (genErr instanceof Error && genErr.message.startsWith('Gemini:')) {
          throw genErr;
        }
        throw new Error('Không thể kết nối đến máy chủ Google Gemini. Vui lòng kiểm tra kết nối mạng của bạn.');
      }
    }

    if (!rawText || !rawText.trim()) {
      throw new Error('Gemini không trả về kết quả.');
    }

    return rawText;
  }

  /**
   * V2 Feature: Song Development Engine (✨ PHÁT TRIỂN Ý TƯỞNG)
   * Receives original idea, DSP findings, current draft, and creative preservation sliders.
   * Returns a complete song development suite: lyrics, structured sections, hook, melody notes, chords, arrangement.
   */
  async developSong(req: SongDevelopmentRequest): Promise<SongDevelopment> {
    const apiKey = getStoredApiKey();
    if (!apiKey) {
      throw new Error('Gemini chưa được kết nối. Vui lòng gắn API Key trong Cài đặt AI để sử dụng tính năng phát triển bài hát.');
    }

    let audioData: { base64: string; mimeType: string } | undefined;
    if (req.audioBlob) {
      try {
        audioData = await blobToBase64(req.audioBlob);
      } catch (e) {
        console.warn('Could not encode audio blob for developSong, proceeding with text context:', e);
      }
    }

    const keepMelodyPct = req.creativitySettings.keepMelodyPct ?? 80;
    const keepLyricPct = req.creativitySettings.keepLyricPct ?? 70;

    const originalLyricText = req.originalLyric || req.transcript;
    const isHummingOrInstrument = !originalLyricText || originalLyricText.trim() === '';

    const prompt = `
Bạn là một nhạc sĩ, nhà soạn nhạc và nhà sản xuất âm nhạc chuyên nghiệp, đồng hành cùng người dùng trong ứng dụng "BẮT LẤY" để phát triển một ý tưởng âm thanh thô thành một bài hát hoàn chỉnh.

==============================
NGUYÊN TẮC CỐT LÕI (BẮT BUỘC):
==============================
1. "BẢO TỒN Ý TƯỞNG GỐC":
   - Tinh thần, cảm xúc chủ đạo và cái hồn của bản thu ban đầu là kim chỉ nam tối cao.
   - Không được biến bài hát thành một câu chuyện hoàn toàn xa lạ.
   - Nếu bản thu gốc là ngâm nga giai điệu không lời (humming): hãy đặt lời ca tiếng Việt thật giàu hình ảnh và tự nhiên dựa đúng theo giai điệu ngân nga ấy.
   - Nếu bản thu gốc đã có câu hát: giữ trọn vẹn câu hát gốc làm hạt nhân (thường đặt ở Verse 1 hoặc Chorus), không tự ý xóa bỏ hay xuyên tạc.

2. CÀI ĐẶT BẢO TOÀN SÁNG TẠO:
   - Tỷ lệ bảo tồn giai điệu gốc: ${keepMelodyPct}%
     ${keepMelodyPct >= 70 ? '-> Ưu tiên giữ chặt mô-típ nốt và tiết tấu gốc.' : '-> Cho phép đề xuất các đoạn phát triển hoặc mở rộng biến tấu quãng giai điệu.'}
   - Tỷ lệ bảo tồn ca từ gốc: ${keepLyricPct}%
     ${keepLyricPct >= 70 ? '-> Ưu tiên giữ nguyên vẹn từ ngữ, hình ảnh và câu chữ trong bản thu.' : '-> Cho phép AI phát triển từ ngữ mới mẻ, mở rộng câu chuyện mạnh mẽ hơn.'}

==============================
DỮ LIỆU ĐO ĐẠC GỐC TỪ THIẾT BỊ:
==============================
- Tên ý tưởng: "${req.title}"
- Thời lượng bản thu: ${req.duration.toFixed(1)}s
- Lời ca gốc / Câu nói trong bản thu: ${originalLyricText ? `"${originalLyricText}"` : '(Ngâm nga giai điệu không lời / Humming)'}
- Cảm xúc ban đầu: ${req.emotion || 'Chưa xác định'}
- Nhịp độ (BPM): ${req.bpm ? `${req.bpm} BPM` : 'Nhịp tự do'}
- Gam giọng: ${req.key || 'Tự do'}
- Đường nét giai điệu DSP: ${req.melodyDescription || 'Tự nhiên'}
- Thể loại phù hợp: ${req.genreSuggestions?.map(g => g.name).join(', ') || 'Pop / Ballad / Indie'}
${req.currentLyrics ? `- Bản thảo lời hiện tại của người dùng:\n${req.currentLyrics}` : ''}

==============================
YÊU CẦU ĐẦU RA (JSON FORMAT):
==============================
Hãy trả về DUY NHẤT một chuỗi JSON hợp lệ theo schema sau:
{
  "developedLyrics": string, // Toàn bộ bài hát hoàn chỉnh (có ghi rõ các tiêu đề phân đoạn như [Verse 1], [Chorus]...)
  "sections": [
    {
      "type": "Intro" | "Verse 1" | "Pre-Chorus" | "Chorus" | "Verse 2" | "Bridge" | "Final Chorus" | "Outro",
      "title": string, // Tên hiển thị (ví dụ "Verse 1 (Ý tưởng gốc)", "Chorus (Hook chính)")
      "content": string, // Ca từ tiếng Việt của đoạn này (viết giàu chất thơ, vần điệu mượt mà)
      "chords": string, // Vòng hợp âm gợi ý cụ thể (ví dụ "C - G/B - Am7 - Fmaj7")
      "notes": string // Ghi chú cảm xúc, cách nhấn nhá hoặc hát
    }
  ],
  "hookSuggestion": string, // Câu hook / câu điệp khúc "ăn tiền" nhất của bài, đọng lại trong tâm trí
  "melodyDevelopment": string, // Hướng dẫn phát triển giai điệu (cách mở rộng âm vực, nốt nhấn cao trào, chuyển tiếp)
  "harmonyChords": string, // Vòng hòa âm tổng thể đề xuất cho bài hát
  "arrangementDirection": string // Hướng phối khí cụ thể: loại nhạc cụ chính (Guitar mộc, Piano, Beat lofi, Synth...), nhịp điệu và không gian âm thanh
}
`.trim();

    const raw = await this.executeGeminiPrompt(apiKey, prompt, audioData, 0.4);

    try {
      const jsonMatch = raw.match(/```json\s*([\s\S]*?)\s*```/) || raw.match(/([\{\[][\s\S]*[\}\]])/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[1] : raw);

      const sections: SongSection[] = Array.isArray(parsed.sections)
        ? parsed.sections.map((s: any, idx: number) => ({
            id: `sec_${Date.now()}_${idx}`,
            type: s.type || 'Custom',
            title: s.title || s.type || `Đoạn ${idx + 1}`,
            content: String(s.content || '').trim(),
            chords: s.chords ? String(s.chords).trim() : undefined,
            notes: s.notes ? String(s.notes).trim() : undefined,
          }))
        : [];

      return {
        developedLyrics: String(parsed.developedLyrics || '').trim(),
        sections,
        hookSuggestion: parsed.hookSuggestion ? String(parsed.hookSuggestion).trim() : undefined,
        melodyDevelopment: parsed.melodyDevelopment ? String(parsed.melodyDevelopment).trim() : undefined,
        harmonyChords: parsed.harmonyChords ? String(parsed.harmonyChords).trim() : undefined,
        arrangementDirection: parsed.arrangementDirection ? String(parsed.arrangementDirection).trim() : undefined,
        lastDevelopedAt: Date.now(),
      };
    } catch (err) {
      console.error('Failed to parse Gemini Song Development JSON:', raw, err);
      throw new Error('Gemini trả về cấu trúc phát triển bài hát không hợp lệ. Vui lòng thử lại.');
    }
  }

  /**
   * V2 Feature: Targeted Lyric Expansion Actions:
   * - "continue": ✨ AI viết tiếp
   * - "rewrite": ✨ Viết lại đoạn này
   * - "add_chorus": ✨ Thêm điệp khúc
   * - "verse_2": ✨ Viết Verse 2
   * - "bridge": ✨ Viết Bridge
   */
  async expandLyrics(req: LyricActionRequest): Promise<string> {
    const apiKey = getStoredApiKey();
    if (!apiKey) {
      throw new Error('Gemini chưa được kết nối. Vui lòng gắn API Key trong Cài đặt AI.');
    }

    const keepLyricPct = req.creativitySettings.keepLyricPct ?? 70;
    let actionInstruction = '';

    switch (req.action) {
      case 'continue':
        actionInstruction = 'Hãy viết tiếp 1 đến 2 khổ thơ tiếp nối mượt mà cho ca từ hiện tại. Giữ nguyên văn phong, vần điệu và cảm xúc đang có.';
        break;
      case 'rewrite':
        actionInstruction = req.selectedText
          ? `Hãy viết lại đoạn ca từ sau đây cho giàu chất thơ, tinh tế và dễ hát hơn nhưng vẫn giữ trọn ý nghĩa gốc: "${req.selectedText}"`
          : 'Hãy tinh chỉnh và viết lại ca từ hiện tại để giàu chất thơ, vần điệu uyển chuyển và gợi cảm xúc sâu lắng hơn.';
        break;
      case 'add_chorus':
        actionInstruction = 'Hãy sáng tác một đoạn Điệp khúc (Chorus / Hook) bùng nổ cảm xúc, dễ nhớ, bắt tai, làm nổi bật thông điệp cốt lõi của bài hát.';
        break;
      case 'verse_2':
        actionInstruction = 'Hãy viết tiếp Lời 2 (Verse 2) phát triển mạch câu chuyện, đưa cảm xúc đi sâu hơn hoặc mở ra một chiều không gian mới.';
        break;
      case 'bridge':
        actionInstruction = 'Hãy sáng tác một đoạn Cầu nối (Bridge) chuyển hướng cảm xúc hoặc thay đổi góc nhìn, trước khi bài hát bùng nổ trở lại.';
        break;
    }

    const prompt = `
Bạn là nhà soạn lời bài hát tiếng Việt tài hoa.
Người dùng đang sáng tác bài hát với các thông số:
- Lời gốc ban đầu trong bản ghi âm: ${req.originalLyric ? `"${req.originalLyric}"` : 'Ý tưởng ban đầu là giai điệu ngâm nga'}
- Cảm xúc bài hát: ${req.emotion || 'Chân thành, sâu lắng'}
- Gam giọng & Nhịp độ: ${req.key || 'Tự do'}, ${req.bpm ? `${req.bpm} BPM` : 'Tự do'}
- Mức độ bảo tồn ca từ gốc: ${keepLyricPct}% (${keepLyricPct >= 70 ? 'Giữ tối đa từ ngữ và hình ảnh gốc' : 'Tự do mở rộng sáng tạo'})

Ca từ hiện tại trong bản thảo:
"""
${req.currentLyrics}
"""

YÊU CẦU:
${actionInstruction}

QUY TẮC:
- Viết bằng tiếng Việt tự nhiên, giàu hình ảnh, vần điệu đẹp, phù hợp với thanh điệu âm nhạc.
- Không viết lời dẫn hay giải thích dài dòng. Chỉ trả về trực tiếp đoạn ca từ tiếng Việt được tạo ra.
`.trim();

    const result = await this.executeGeminiPrompt(apiKey, prompt, undefined, 0.4);
    return result.trim().replace(/^```[a-z]*\n/i, '').replace(/\n```$/, '').trim();
  }

  async analyzeAudio(
    blob: Blob,
    duration: number,
    creativitySettings?: CreativitySettings
  ): Promise<AudioAnalysisResult> {
    const localResult = await analyzeAudioWithLocalDSP(blob, duration);
    if (this.isAiConnected()) {
      return this.analyzeWithDSP(blob, duration, localResult, creativitySettings);
    }
    return localResult;
  }

  private handleApiHttpError(status: number, message: string, reason?: string): never {
    if (status === 400) {
      if (reason === 'API_KEY_INVALID' || message.toLowerCase().includes('api key')) {
        throw new Error(
          'Gemini: API Key không hợp lệ hoặc sai định dạng (400). Vui lòng kiểm tra lại trong Cài đặt AI.'
        );
      }
      if (message.toLowerCase().includes('no longer available') || message.toLowerCase().includes('not supported')) {
        throw new Error(`Gemini: Model không khả dụng: ${message}`);
      }
      throw new Error(`Gemini: Yêu cầu không hợp lệ (400): ${message}`);
    }
    if (status === 403) {
      throw new Error(
        `Gemini: Quyền truy cập bị từ chối (403). Vui lòng kiểm tra giới hạn domain/HTTP Referrer hoặc quyền bật Gemini API: ${message}`
      );
    }
    if (status === 429) {
      throw new Error(
        'Gemini: Đã vượt quá hạn mức sử dụng (Quota / Rate Limit 429). Vui lòng thử lại sau giây lát.'
      );
    }
    throw new Error(`Gemini: Lỗi máy chủ (${status}): ${message}`);
  }
}


