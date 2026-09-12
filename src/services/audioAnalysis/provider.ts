/**
 * AudioAnalysisProvider Factory & Composite Dispatcher
 */

import { AudioAnalysisProvider, AudioAnalysisResult, CreativitySettings } from './types';
import { analyzeAudioWithLocalDSP } from './localAudioAnalyzer';
import { GeminiAudioAnalysisProvider } from './geminiProvider';

export class CompositeAudioAnalysisProvider implements AudioAnalysisProvider {
  name = 'BẮT LẤY Composite Audio Analyzer';
  private geminiProvider = new GeminiAudioAnalysisProvider();

  isAiConnected(): boolean {
    return this.geminiProvider.isAiConnected();
  }

  async analyzeAudio(
    blob: Blob,
    duration: number,
    creativitySettings?: CreativitySettings
  ): Promise<AudioAnalysisResult> {
    if (!blob || blob.size === 0) {
      throw new Error('Không có dữ liệu âm thanh hợp lệ để phân tích.');
    }

    // 1. ALWAYS run real Web Audio DSP directly on the user's recorded Blob
    const dspResult = await analyzeAudioWithLocalDSP(blob, duration);

    // 2. If Gemini BYOK is connected, enrich with Multimodal Gemini 3.6 Flash
    if (this.isAiConnected()) {
      try {
        const enrichedResult = await this.geminiProvider.analyzeWithDSP(
          blob,
          duration,
          dspResult,
          creativitySettings
        );
        return enrichedResult;
      } catch (aiErr) {
        console.warn('Gemini AI enrichment failed, returning local DSP with error flag:', aiErr);
        // Throw specific error with partial DSP data preserved so UI can show error state while keeping DSP
        const error = new Error(aiErr instanceof Error ? aiErr.message : 'Lỗi kết nối Gemini AI');
        (error as unknown as { dspResult: AudioAnalysisResult }).dspResult = dspResult;
        throw error;
      }
    }

    // 3. If Gemini is not connected, return local DSP result with clear notice
    return dspResult;
  }
}

export const defaultAudioAnalyzer = new CompositeAudioAnalysisProvider();
