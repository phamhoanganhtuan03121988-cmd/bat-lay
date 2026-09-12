/**
 * BẮT LẤY - AI Audio Analysis Types & Contracts
 */

export type InputClassification =
  | 'singing_with_lyrics'
  | 'humming_melody'
  | 'spoken_idea'
  | 'instrument_or_ambient';

export interface GenreSuggestion {
  name: string;
  reason: string;
}

export interface AudioAnalysisResult {
  duration: number; // in seconds
  hasSpeech: boolean;
  inputType: InputClassification;
  transcript: string | null;
  originalLyric: string | null;
  developedLyric: string | null;
  melodyDescription: string | null;
  tempo: number | null; // Real detected BPM or null if indeterminate
  key: string | null;   // Real detected musical key or null if indeterminate
  emotion: string | null; // Real acoustic/semantic emotion or null
  genreSuggestions: GenreSuggestion[];
  confidence: number; // 0 to 1
  developmentIdeas: string[];
  
  // Provenance & AI Connection Transparency
  analyzedWith: 'local_dsp' | 'gemini_multimodal' | 'hybrid';
  needsAiConnectionFor?: string[];
  acousticFeatures?: {
    avgRmsEnergy: number;
    silenceRatio: number;
    pitchContour: 'ascending' | 'descending' | 'melodic_wave' | 'speech_like' | 'flat' | 'indeterminate';
    detectedNoteCount: number;
    dominantFreqHz?: number;
  };
}

export interface CreativitySettings {
  keepMelodyPct?: number; // 0 - 100
  keepLyricPct?: number;  // 0 - 100
}

export interface AudioAnalysisProvider {
  name: string;
  isAiConnected(): boolean;
  analyzeAudio(
    blob: Blob,
    duration: number,
    creativitySettings?: CreativitySettings
  ): Promise<AudioAnalysisResult>;
}
