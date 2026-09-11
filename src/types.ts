export type NavigationTab = 'home' | 'library' | 'inspiration' | 'voice';

export type CreativeContext =
  | 'Trên đường về'
  | 'Ở nhà'
  | 'Buổi sáng'
  | 'Buổi tối'
  | 'Một ngày mưa'
  | 'Khác';

export interface AudioIdea {
  id: string;
  title: string;
  createdAt: number;
  duration: number; // in seconds
  audioBlob: Blob;
  context?: CreativeContext | string;
  waveformData: number[]; // normalized amplitudes [0..1]
  transcript?: string;
  originalLyric?: string;
  developedLyric?: string;
  emotion?: string;
  bpm?: number;
  musicalKey?: string;
  melodyDescription?: string;
  suggestedGenres?: string[];
  favorite: boolean;
  analysisStatus: 'none' | 'analyzing' | 'completed' | 'pending';
  keepMelodyPct: number; // 0 - 100
  keepLyricPct: number; // 0 - 100
}

export interface AudioAnalysisResult {
  transcript: string;
  originalLyric: string;
  developedLyric: string;
  emotion: string;
  bpm: number;
  musicalKey: string;
  melodyDescription: string;
  suggestedGenres: string[];
}

export interface AudioAnalysisProvider {
  analyzeAudio(blob: Blob, duration: number): Promise<AudioAnalysisResult>;
}
