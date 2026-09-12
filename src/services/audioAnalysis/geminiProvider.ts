/**
 * GeminiAudioAnalysisProvider
 * 
 * Implements client-side Gemini Multimodal AI integration using Bring Your Own Key (BYOK):
 * - Default model: gemini-2.5-flash
 * - Sends actual audio blob as base64 inlineData
 * - Sends measured Local DSP acoustic facts (BPM, Key, Contour, Silence) to guide the model
 * - Receives structured JSON with Vietnamese transcription, semantics, and lyric development
 * - No fake or fabricated data: returns null if speech/lyrics are absent
 * - Preserves Local DSP results if Gemini call fails
 */

import { AudioAnalysisProvider, AudioAnalysisResult, InputClassification, GenreSuggestion } from './types';
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
      // data:audio/webm;codecs=opus;base64,GkXfo...
      const matches = result.match(/^data:([^;]+).*?;base64,(.*)$/);
      if (matches && matches.length === 3) {
        let cleanMime = matches[1].toLowerCase();
        // Standardize common audio formats recognized by Gemini
        if (cleanMime.includes('webm')) cleanMime = 'audio/webm';
        else if (cleanMime.includes('mp4') || cleanMime.includes('m4a')) cleanMime = 'audio/mp4';
        else if (cleanMime.includes('wav')) cleanMime = 'audio/wav';
        else if (cleanMime.includes('aac')) cleanMime = 'audio/aac';
        else if (cleanMime.includes('ogg')) cleanMime = 'audio/ogg';
        else if (cleanMime.includes('mpeg') || cleanMime.includes('mp3')) cleanMime = 'audio/mp3';
        else cleanMime = 'audio/webm';

        resolve({ base64: matches[2], mimeType: cleanMime });
      } else {
        // Fallback split
        const parts = result.split(',');
        resolve({ base64: parts[1] || '', mimeType: 'audio/webm' });
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(blob);
  });
}

interface GeminiStructuredResponse {
  inputType: InputClassification;
  hasSpeech: boolean;
  transcript: string | null;
  originalLyric: string | null;
  developedLyric: string | null;
  emotion: string;
  genreSuggestions: Array<{ name: string; reason: string }>;
  developmentIdeas: string[];
}

export class GeminiAudioAnalysisProvider implements AudioAnalysisProvider {
  name = 'Gemini 2.5 Flash Multimodal (BYOK)';

  isAiConnected(): boolean {
    return hasApiKeyConfigured();
  }

  /**
   * Run Gemini analysis using already calculated local DSP results
   */
  async analyzeWithDSP(
    blob: Blob,
    duration: number,
    localResult: AudioAnalysisResult
  ): Promise<AudioAnalysisResult> {
    const apiKey = getStoredApiKey();
    if (!apiKey) {
      return localResult;
    }

    const { base64, mimeType } = await blobToBase64(blob);
    if (!base64) {
      return localResult;
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;

    const systemPrompt = `
Bạn là chuyên gia thẩm âm, nhạc sĩ và nhà sản xuất âm nhạc cao cấp trong ứng dụng "BẮT LẤY" (ứng dụng ghi lại ý tưởng sáng tác âm nhạc ngẫu hứng).
Người dùng vừa thu âm một đoạn âm thanh ngẫu hứng (có thể là ngâm nga giai điệu không lời/humming, hát mộc có ca từ, nói ghi chú ý tưởng, hoặc chơi nhạc cụ).

Bộ xử lý tín hiệu số (Web Audio DSP) trên trình duyệt đã đo đạc các thông số vật lý thực tế từ file âm thanh này như sau:
- Thời lượng: ${duration} giây
- Dự đoán sơ bộ từ DSP: ${localResult.inputType}
- Nhịp độ (BPM) đo được: ${localResult.tempo ? `${localResult.tempo} BPM` : 'Nhịp tự do / Chưa đủ chu kỳ nhịp rõ'}
- Gam giọng (Key) đo được: ${localResult.key || 'Chưa đủ dữ liệu giọng'}
- Đường nét cao độ: ${localResult.acousticFeatures?.pitchContour || 'không rõ'}
- Năng lượng âm thanh RMS: ${localResult.acousticFeatures?.avgRmsEnergy ?? 'N/A'}
- Tỷ lệ khoảng lặng: ${localResult.acousticFeatures?.silenceRatio ?? 'N/A'}

NHIỆM VỤ CỦA BẠN:
1. Hãy lắng nghe kỹ file âm thanh đính kèm (chất giọng, cao độ, nhịp điệu, hơi thở và lời hát).
2. Nhận diện thể loại đầu vào (inputType) chính xác:
   - "singing_with_lyrics": Người dùng đang HÁT RÕ LỜI bằng tiếng Việt (hoặc ngôn ngữ khác).
   - "humming_melody": Người dùng đang NGÂM NGA GIAI ĐIỆU KHÔNG LỜI (ví dụ ngân nga "hừm", "la la", "na na", huýt sáo). KHÔNG ĐƯỢC BỊA LỜI HÁT nếu người dùng chỉ ngâm nga giai điệu!
   - "spoken_idea": Người dùng đang NÓI bằng lời bình thường để lưu lại ý tưởng hoặc cảm xúc.
   - "instrument_or_ambient": Tiếng đàn piano, guitar hoặc âm thanh tự do.
3. Bóc tách lời hát / lời nói (transcript & originalLyric):
   - Nếu là "singing_with_lyrics": Bóc tách chính xác từng chữ lời hát tiếng Việt vào 'transcript' và 'originalLyric'.
   - Nếu là "spoken_idea": Ghi lại chính xác nội dung câu nói của người dùng vào 'transcript' và 'originalLyric'.
   - Nếu là "humming_melody" hoặc "instrument_or_ambient": Để 'transcript': null và 'originalLyric': null. Tuyệt đối không giả mạo ca từ!
4. Phân tích cảm xúc (emotion):
   - Diễn đạt cảm xúc tinh tế, chân thực từ cách ngân rung, sắc thái giọng và nội dung (nếu có).
5. Gợi ý phát triển ca từ (developedLyric):
   - Nếu có lời hát gốc: Giữ nguyên tinh thần và vần điệu, viết tiếp 2-4 câu hát tiếp nối tự nhiên cho đoạn điệp khúc hoặc câu kế tiếp.
   - Nếu là ngâm nga (humming): Viết gợi ý 2-4 câu thơ/lời hát tiếng Việt giàu hình ảnh, khớp đúng số âm tiết và đường nét giai điệu đã ngân nga.
   - Nếu là ý tưởng nói: Chuyển hóa ý nghĩ văn xuôi đó thành 2-4 câu ca từ thơ mộng có giai điệu.
6. Hướng âm nhạc gợi ý (genreSuggestions):
   - Đưa ra 2-3 gợi ý thể loại (ví dụ: "Indie Pop", "Acoustic Ballad", "R&B Lo-Fi", "V-Pop hiện đại") kèm LÝ DO âm nhạc rõ ràng kết hợp với kết quả đo đạc BPM/Key từ DSP.
7. Ý tưởng phát triển sáng tác (developmentIdeas):
   - 2-3 lời khuyên âm nhạc cụ thể (về hòa âm, cách gieo vần, cấu trúc điệp khúc hoặc tiết tấu).

YÊU CẦU ĐỊNH DẠNG:
Trả về DUY NHẤT một chuỗi JSON hợp lệ theo đúng cấu trúc schema sau:
{
  "inputType": "singing_with_lyrics" | "humming_melody" | "spoken_idea" | "instrument_or_ambient",
  "hasSpeech": boolean,
  "transcript": string | null,
  "originalLyric": string | null,
  "developedLyric": string | null,
  "emotion": string,
  "genreSuggestions": [
    { "name": string, "reason": string }
  ],
  "developmentIdeas": [string]
}
`.trim();

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: systemPrompt },
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
            temperature: 0.4,
          },
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => null);
        const errMsg = errJson?.error?.message || `HTTP ${response.status} ${response.statusText}`;
        console.warn('Gemini API returned error:', errMsg);
        throw new Error(`Gemini API: ${errMsg}`);
      }

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawText) {
        throw new Error('Gemini không trả về nội dung phân tích.');
      }

      let parsed: GeminiStructuredResponse;
      try {
        parsed = JSON.parse(rawText);
      } catch (jsonErr) {
        console.warn('Could not parse Gemini JSON directly, raw was:', rawText);
        throw jsonErr;
      }

      // Merge Gemini AI insights with mathematically grounded Local DSP
      const mergedGenreSuggestions: GenreSuggestion[] =
        Array.isArray(parsed.genreSuggestions) && parsed.genreSuggestions.length > 0
          ? parsed.genreSuggestions
          : localResult.genreSuggestions;

      const mergedDevelopmentIdeas =
        Array.isArray(parsed.developmentIdeas) && parsed.developmentIdeas.length > 0
          ? parsed.developmentIdeas
          : localResult.developmentIdeas;

      return {
        ...localResult,
        inputType: parsed.inputType || localResult.inputType,
        hasSpeech: Boolean(parsed.hasSpeech),
        transcript: parsed.transcript || null,
        originalLyric: parsed.originalLyric || parsed.transcript || null,
        developedLyric: parsed.developedLyric || null,
        emotion: parsed.emotion || localResult.emotion,
        genreSuggestions: mergedGenreSuggestions,
        developmentIdeas: mergedDevelopmentIdeas,
        confidence: Math.max(localResult.confidence, 0.88),
        analyzedWith: 'hybrid',
        needsAiConnectionFor: [],
      };
    } catch (apiError: unknown) {
      console.warn('Gemini Multimodal processing encountered an error:', apiError);
      // Re-throw so caller knows AI failed, while retaining local DSP
      throw apiError;
    }
  }

  async analyzeAudio(blob: Blob, duration: number): Promise<AudioAnalysisResult> {
    // 1. Always run local DSP first to extract mathematically grounded acoustic facts
    const localResult = await analyzeAudioWithLocalDSP(blob, duration);

    // 2. If Gemini API key is configured, enrich local DSP
    if (this.isAiConnected()) {
      return this.analyzeWithDSP(blob, duration, localResult);
    }

    return localResult;
  }
}
