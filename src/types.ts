export type NavigationTab = 'home' | 'library' | 'inspiration' | 'voice';

export type CreativeContext =
  | 'Trên đường về'
  | 'Ở nhà'
  | 'Buổi sáng'
  | 'Buổi tối'
  | 'Một ngày mưa'
  | 'Khác';

export type AnalysisStatus = 'idle' | 'analyzing' | 'completed' | 'error' | 'none' | 'pending';

export type InputClassification =
  | 'singing_with_lyrics'
  | 'humming_melody'
  | 'spoken_idea'
  | 'instrument_or_ambient';

export interface GenreSuggestion {
  name: string;
  reason: string;
}

export interface AudioIdea {
  id: string;
  title: string;
  createdAt: number;
  duration: number; // in seconds
  audioBlob: Blob;
  context?: CreativeContext | string;
  waveformData: number[]; // normalized amplitudes [0..1]
  transcript?: string | null;
  originalLyric?: string | null;
  developedLyric?: string | null;
  emotion?: string | null;
  bpm?: number | null;
  musicalKey?: string | null;
  melodyDescription?: string | null;
  suggestedGenres?: string[];
  genreSuggestions?: GenreSuggestion[];
  developmentIdeas?: string[];
  confidence?: number;
  inputType?: InputClassification;
  hasSpeech?: boolean;
  analyzedWith?: 'local_dsp' | 'gemini_multimodal' | 'hybrid';
  needsAiConnectionFor?: string[];
  favorite: boolean;
  analysisStatus: AnalysisStatus;
  keepMelodyPct: number; // 0 - 100
  keepLyricPct: number; // 0 - 100
}

export interface AudioAnalysisResult {
  duration: number;
  hasSpeech: boolean;
  inputType: InputClassification;
  transcript: string | null;
  originalLyric: string | null;
  developedLyric: string | null;
  melodyDescription: string | null;
  tempo: number | null;
  key: string | null;
  emotion: string | null;
  genreSuggestions: GenreSuggestion[];
  confidence: number;
  developmentIdeas: string[];
  analyzedWith: 'local_dsp' | 'gemini_multimodal' | 'hybrid';
  needsAiConnectionFor?: string[];
}

export interface AudioAnalysisProvider {
  name: string;
  analyzeAudio(blob: Blob, duration: number): Promise<AudioAnalysisResult>;
}

