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

