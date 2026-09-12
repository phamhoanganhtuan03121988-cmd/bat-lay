export type NavigationTab = 'home' | 'library' | 'inspiration' | 'voice';

export type CreativeContext =
  | 'Trên đường về'
  | 'Ở nhà'
  | 'Buổi sáng'
  | 'Buổi tối'
  | 'Một ngày mưa'
  | 'Khác';

export type AnalysisStatus = 'idle' | 'analyzing' | 'completed' | 'error' | 'none' | 'pending';

export type ProjectStatus = 'draft' | 'original' | 'in_progress' | 'completed';

export type InputClassification =
  | 'singing_with_lyrics'
  | 'humming_melody'
  | 'spoken_idea'
  | 'instrument_or_ambient';

export interface GenreSuggestion {
  name: string;
  reason: string;
}

export type SectionType =
  | 'Intro'
  | 'Verse 1'
  | 'Pre-Chorus'
  | 'Chorus'
  | 'Verse 2'
  | 'Bridge'
  | 'Final Chorus'
  | 'Outro'
  | 'Custom';

export type SongSectionType = SectionType;

export interface SongSection {
  id: string;
  type: SectionType;
  title: string;
  content: string; // Ca từ hoặc ý tưởng cho đoạn
  chords?: string; // Hợp âm đề xuất
  notes?: string; // Ghi chú cảm xúc, nhịp điệu
}

export interface SongDevelopment {
  developedLyrics: string;
  sections: SongSection[];
  hookSuggestion?: string;
  melodyDevelopment?: string;
  harmonyChords?: string;
  arrangementDirection?: string;
  lastDevelopedAt?: number;
}

export interface MelodyPitchPoint {
  time: number; // thời gian (giây)
  hz: number;   // tần số Hz
  noteName: string; // Tên nốt (ví dụ "A3", "C4")
}

export interface MelodyAnalysisData {
  pitchesHz: number[];
  pitchPoints: MelodyPitchPoint[];
  minHz: number;
  maxHz: number;
  peakHz: number;
  peakNote: string;
  pitchRangeSemitones: number;
  contour: 'ascending' | 'descending' | 'melodic_wave' | 'speech_like' | 'flat' | 'indeterminate';
  contourDescription: string;
  sustainedRuns: number;
}

export interface MusicBlueprint {
  title: string;
  language: string;
  genre: string;
  mood: string;
  tempo_bpm: number;
  key: string;
  duration_target: string;
  vocal_style: string;
  lyrics: string;
  song_structure: string[] | SongSection[];
  melody_direction: string;
  harmony: string;
  instrumentation: string;
  production_direction: string;
  lyria_prompt: string;
}

export const LYRIA_CLIP_ESTIMATED_COST = 0.04;
export const LYRIA_FULL_ESTIMATED_COST = 0.08;

export type GenerationType = 'clip' | 'full';

export type PromptType =
  | 'diagnostic-minimal'
  | 'diagnostic-with-lyrics'
  | 'diagnostic-production'
  | 'production';

export interface GenerationRecord {
  id: string;
  projectId: string;
  model: string;
  prompt: string;
  exactPrompt: string;
  promptType: PromptType;
  generationType: GenerationType;
  estimatedCost: number;
  createdAt: number;
  timestamp: number;
  status: 'success' | 'blocked' | 'error';
  errorCode?: string;
  errorMessage?: string;
}

export type DiagnosticTestId = 'test_a' | 'test_b' | 'test_c';
export type DiagnosticOutcome = 'idle' | 'running' | 'pass' | 'blocked' | 'error';

export interface DiagnosticTestResult {
  testId: DiagnosticTestId;
  testName: string;
  outcome: DiagnosticOutcome;
  model: string;
  exactPrompt: string;
  timestamp?: number;
  errorSummary?: string;
  rawErrorDetails?: string;
  errorCode?: string;
  audioBlob?: Blob;
  mimeType?: string;
}

export interface GeneratedSong {
  id: string;
  projectId: string;
  versionName: string; // e.g. "Demo 01", "Clip 30s"
  createdAt: number;
  model: string; // "lyria-3-clip-preview" | "lyria-3.5"
  mimeType: string;
  audioBlob: Blob;
  duration?: number;
  blueprint: MusicBlueprint;
  lyriaPrompt: string;
  generationType?: GenerationType;
  estimatedCost?: number;
}

export type DemoStatus =
  | 'idle'
  | 'preparing_blueprint'
  | 'generating_clip'
  | 'generating_full'
  | 'generating_audio'
  | 'completed'
  | 'error';

export interface ProjectVersion {
  id: string;
  versionNumber?: number;
  name: string; // Ví dụ: "V1 — Bản gốc", "V2 — Phát triển lời", "V3 — Thêm Chorus"
  savedAt?: number;
  createdAt?: number;
  lyrics?: string;
  developedLyrics?: string;
  sections?: SongSection[];
  development?: SongDevelopment;
  creativeControls?: { keepMelodyPct: number; keepLyricPct: number };
  hookSuggestion?: string;
  harmonyChords?: string;
  arrangementDirection?: string;
  melodyDevelopment?: string;
  note?: string;
  notes?: string;
}

export interface AudioIdea {
  id: string;
  title: string;
  createdAt: number;
  updatedAt?: number;
  duration: number; // in seconds
  audioBlob: Blob;
  context?: CreativeContext | string;
  waveformData: number[]; // normalized amplitudes [0..1]
  
  // V2 Project Status (● Bản nháp, ● Đang phát triển, ● Đã hoàn thiện)
  status?: ProjectStatus;

  // Bản gốc (Audio & Phân tích gốc)
  transcript?: string | null;
  originalLyric?: string | null;
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
  analysisResult?: AudioAnalysisResult | null;
  
  // Creative Controls (0 - 100%)
  keepMelodyPct: number; // 0 - 100
  keepLyricPct: number; // 0 - 100
  creativeControls?: {
    keepMelodyPct: number;
    keepLyricPct: number;
  };

  // V2 Song Development Data
  lyrics?: string | null;
  developedLyric?: string | null;
  songSections?: SongSection[];
  songDevelopment?: SongDevelopment;
  hookSuggestion?: string | null;
  melodyDevelopment?: string | null;
  harmonyChords?: string | null;
  arrangementDirection?: string | null;
  melodyData?: MelodyAnalysisData | null;

  // V2 Version Management
  versions?: ProjectVersion[];
  activeVersionId?: string;

  // V3 & V3.1 Lyria Demo Generation
  generatedSongs?: GeneratedSong[];
  activeGeneratedSongId?: string;
  musicBlueprint?: MusicBlueprint;
  demoStatus?: DemoStatus;
  demoError?: string | null;
  generationRecords?: GenerationRecord[];
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
  melodyData?: MelodyAnalysisData | null;
  acousticFeatures?: {
    avgRmsEnergy?: number;
    silenceRatio?: number;
    pitchContour?: string;
    detectedNoteCount?: number;
    dominantFreqHz?: number;
    pitchesHz?: number[];
  };
}

export interface AudioAnalysisProvider {
  name: string;
  analyzeAudio(blob: Blob, duration: number): Promise<AudioAnalysisResult>;
}

