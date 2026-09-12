/**
 * BẮT LẤY - AI Audio Analysis Types & Contracts
 */
import {
  InputClassification,
  GenreSuggestion,
  MelodyAnalysisData,
  SongSection,
  SongDevelopment,
} from '../../types';

export type { InputClassification, GenreSuggestion, MelodyAnalysisData, SongSection, SongDevelopment };

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
  melodyData?: MelodyAnalysisData | null;
  acousticFeatures?: {
    avgRmsEnergy: number;
    silenceRatio: number;
    pitchContour: 'ascending' | 'descending' | 'melodic_wave' | 'speech_like' | 'flat' | 'indeterminate';
    detectedNoteCount: number;
    dominantFreqHz?: number;
    pitchesHz?: number[];
  };
}

export interface CreativitySettings {
  keepMelodyPct?: number; // 0 - 100
  keepLyricPct?: number;  // 0 - 100
}

export interface SongDevelopmentRequest {
  audioBlob?: Blob;
  title: string;
  duration: number;
  originalLyric?: string | null;
  transcript?: string | null;
  emotion?: string | null;
  bpm?: number | null;
  key?: string | null;
  melodyDescription?: string | null;
  genreSuggestions?: GenreSuggestion[];
  creativitySettings: CreativitySettings;
  currentLyrics?: string;
  currentSections?: SongSection[];
  melodyData?: MelodyAnalysisData | null;
}

export type LyricActionType =
  | 'continue'      // ✨ AI viết tiếp
  | 'rewrite'       // ✨ Viết lại đoạn này
  | 'add_chorus'    // ✨ Thêm điệp khúc
  | 'verse_2'       // ✨ Viết Verse 2
  | 'bridge';       // ✨ Viết Bridge

export interface LyricActionRequest {
  action: LyricActionType;
  selectedText?: string;
  currentLyrics: string;
  originalLyric?: string | null;
  transcript?: string | null;
  emotion?: string | null;
  key?: string | null;
  bpm?: number | null;
  creativitySettings: CreativitySettings;
  genreSuggestions?: GenreSuggestion[];
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

