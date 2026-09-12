/**
 * AudioAnalysisProvider Factory & Composite Dispatcher
 */

import { AudioAnalysisProvider, AudioAnalysisResult } from './types';
import { analyzeAudioWithLocalDSP } from './localAudioAnalyzer';
import { GeminiAudioAnalysisProvider } from './geminiProvider';

export class CompositeAudioAnalysisProvider implements AudioAnalysisProvider {
  name = 'BẮT LẤY Composite Audio Analyzer';
  private geminiProvider = new GeminiAudioAnalysisProvider();

  isAiConnected(): boolean {
    return this.geminiProvider.isAiConnected();
  }

  async analyzeAudio(blob: Blob, duration: number): Promise<AudioAnalysisResult> {
    if (!blob || blob.size === 0) {
      throw new Error('Không có dữ liệu âm thanh hợp lệ để phân tích.');
    }

    try {
      // 1. Run real Web Audio DSP directly on the user's recorded Blob
      const dspResult = await analyzeAudioWithLocalDSP(blob, duration);

      // 2. If external Gemini AI is connected, enrich with speech recognition & lyric writing
      if (this.isAiConnected()) {
        try {
          return await this.geminiProvider.analyzeAudio(blob, duration);
        } catch (aiErr) {
          console.warn('AI enhancement error, continuing with local DSP result:', aiErr);
        }
      }

      return dspResult;
    } catch (error) {
      console.error('Audio analysis pipeline failed:', error);
      throw error;
    }
  }
}

export const defaultAudioAnalyzer = new CompositeAudioAnalysisProvider();
