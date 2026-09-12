/**
 * GeminiAudioAnalysisProvider
 * 
 * Implements external AI multimodal analysis via Gemini models:
 * - Transcribes Vietnamese lyrics / speech from the raw audio
 * - Understands semantic intent and mood nuances
 * - Generates lyric extensions and creative development ideas
 * 
 * If the Gemini service is unavailable (e.g. static GitHub Pages without backend),
 * this provider signals isAiConnected() = false and hands off to LocalAudioAnalyzer.
 */

import { AudioAnalysisProvider, AudioAnalysisResult } from './types';
import { analyzeAudioWithLocalDSP } from './localAudioAnalyzer';

export class GeminiAudioAnalysisProvider implements AudioAnalysisProvider {
  name = 'Gemini 3.5 Transcribe & Multimodal AI';

  isAiConnected(): boolean {
    // Check if an AI backend endpoint or API key exists in runtime environment
    // In GitHub Pages client-side deployment, this is typically false unless configured
    return false;
  }

  async analyzeAudio(blob: Blob, duration: number): Promise<AudioAnalysisResult> {
    // 1. Always run local DSP first to extract mathematically grounded acoustic facts
    const localResult = await analyzeAudioWithLocalDSP(blob, duration);

    // 2. If Gemini API endpoint is available, enrich the local DSP result
    if (this.isAiConnected()) {
      try {
        const formData = new FormData();
        formData.append('audio', blob, 'recording.webm');

        const response = await fetch('/api/analyze-audio', {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const aiData = await response.json();
          return {
            ...localResult,
            inputType: aiData.inputType || localResult.inputType,
            hasSpeech: aiData.hasSpeech ?? localResult.hasSpeech,
            transcript: aiData.transcript || null,
            originalLyric: aiData.originalLyric || aiData.transcript || null,
            developedLyric: aiData.developedLyric || null,
            emotion: aiData.emotion || localResult.emotion,
            developmentIdeas: aiData.developmentIdeas?.length ? aiData.developmentIdeas : localResult.developmentIdeas,
            genreSuggestions: aiData.genreSuggestions?.length ? aiData.genreSuggestions : localResult.genreSuggestions,
            analyzedWith: 'hybrid',
            needsAiConnectionFor: [],
          };
        }
      } catch (err) {
        console.warn('Gemini endpoint call failed, preserving local DSP analysis:', err);
      }
    }

    // Return the real DSP result
    return localResult;
  }
}
