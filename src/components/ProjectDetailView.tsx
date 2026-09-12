import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Calendar,
  Sparkles,
  Sliders,
  Lock,
  ChevronRight,
  BrainCircuit,
  AlertCircle,
  RotateCcw,
  Mic,
  Lightbulb,
  Key,
  Cpu,
  Settings2,
  Wand2,
  CheckCircle2,
  BookmarkCheck,
  Activity,
} from 'lucide-react';
import { AudioIdea, AudioAnalysisResult, InputClassification, SongSection, ProjectStatus } from '../types';
import { formatDateTime, formatDuration } from '../lib/formatters';
import { AudioPlayer } from './AudioPlayer';
import { defaultAudioAnalyzer, defaultGeminiProvider } from '../services/audioAnalysis';
import { hasApiKeyConfigured } from '../services/audioAnalysis/apiKeyStorage';
import { LyricActionType } from '../services/audioAnalysis/types';
import { createIdeaVersion, switchIdeaVersion } from '../lib/db';
import { AiSettingsModal } from './AiSettingsModal';
import { MelodyVisualizer } from './MelodyVisualizer';
import { SongStructureEditor } from './SongStructureEditor';
import { LyricDevelopmentEditor } from './LyricDevelopmentEditor';
import { VersionManagerBar } from './VersionManagerBar';
import { SongDemoSection } from './SongDemoSection';

interface ProjectDetailViewProps {
  idea: AudioIdea;
  onBack: () => void;
  onUpdateIdea: (id: string, updates: Partial<AudioIdea>) => Promise<AudioIdea>;
}

export const ProjectDetailView: React.FC<ProjectDetailViewProps> = ({
  idea,
  onBack,
  onUpdateIdea,
}) => {
  const [currentIdea, setCurrentIdea] = useState<AudioIdea>(idea);
  const [developedLyric, setDevelopedLyric] = useState<string>(
    idea.lyrics || idea.developedLyric || idea.originalLyric || ''
  );
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isSavingLyrics, setIsSavingLyrics] = useState<boolean>(false);
  const [isDevelopingSong, setIsDevelopingSong] = useState<boolean>(false);
  const [developSongError, setDevelopSongError] = useState<string | null>(null);
  const [developSuccessNotice, setDevelopSuccessNotice] = useState<string | null>(null);

  const [isAiConnected, setIsAiConnected] = useState<boolean>(hasApiKeyConfigured());
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Creative sliders
  const [keepMelodyPct, setKeepMelodyPct] = useState<number>(
    idea.creativeControls?.keepMelodyPct ?? idea.keepMelodyPct ?? 80
  );
  const [keepLyricPct, setKeepLyricPct] = useState<number>(
    idea.creativeControls?.keepLyricPct ?? idea.keepLyricPct ?? 70
  );

  // Sync state if idea prop changes
  useEffect(() => {
    setCurrentIdea(idea);
    setDevelopedLyric(idea.lyrics || idea.developedLyric || idea.originalLyric || '');
    setKeepMelodyPct(idea.creativeControls?.keepMelodyPct ?? idea.keepMelodyPct ?? 80);
    setKeepLyricPct(idea.creativeControls?.keepLyricPct ?? idea.keepLyricPct ?? 70);
  }, [idea.id]);

  // Listen for API key changes in local storage
  useEffect(() => {
    const handleKeyChange = () => {
      setIsAiConnected(hasApiKeyConfigured());
    };
    window.addEventListener('bat_lay_api_key_updated', handleKeyChange);
    return () => window.removeEventListener('bat_lay_api_key_updated', handleKeyChange);
  }, []);

  // Trigger analysis if in pending or analyzing state
  useEffect(() => {
    if (currentIdea.analysisStatus === 'pending' || currentIdea.analysisStatus === 'analyzing') {
      handleRunAnalysis();
    }
  }, []);

  const handleSliderChange = async (type: 'melody' | 'lyric', val: number) => {
    const newMelody = type === 'melody' ? val : keepMelodyPct;
    const newLyric = type === 'lyric' ? val : keepLyricPct;

    if (type === 'melody') setKeepMelodyPct(val);
    else setKeepLyricPct(val);

    const updated = await onUpdateIdea(currentIdea.id, {
      keepMelodyPct: newMelody,
      keepLyricPct: newLyric,
      creativeControls: {
        keepMelodyPct: newMelody,
        keepLyricPct: newLyric,
      },
    });
    setCurrentIdea(updated);
  };

  const handleSaveDevelopedLyric = async () => {
    setIsSavingLyrics(true);
    try {
      const updated = await onUpdateIdea(currentIdea.id, {
        lyrics: developedLyric,
        developedLyric,
        updatedAt: Date.now(),
      });
      setCurrentIdea(updated);
    } finally {
      setIsSavingLyrics(false);
    }
  };

  const handleRunAnalysis = async () => {
    setIsAnalyzing(true);
    setAnalysisError(null);

    await onUpdateIdea(currentIdea.id, { analysisStatus: 'analyzing' });

    try {
      const result: AudioAnalysisResult = await defaultAudioAnalyzer.analyzeAudio(
        currentIdea.audioBlob,
        currentIdea.duration,
        {
          keepMelodyPct,
          keepLyricPct,
        }
      );

      const updates: Partial<AudioIdea> = {
        transcript: result.transcript,
        originalLyric: result.originalLyric,
        developedLyric: currentIdea.developedLyric || result.developedLyric,
        lyrics: currentIdea.lyrics || result.developedLyric || result.originalLyric || '',
        emotion: result.emotion,
        bpm: result.tempo,
        musicalKey: result.key,
        melodyDescription: result.melodyDescription,
        suggestedGenres: result.genreSuggestions.map((g) => g.name),
        genreSuggestions: result.genreSuggestions,
        developmentIdeas: result.developmentIdeas,
        confidence: result.confidence,
        inputType: result.inputType,
        hasSpeech: result.hasSpeech,
        analyzedWith: result.analyzedWith,
        needsAiConnectionFor: result.needsAiConnectionFor,
        analysisStatus: 'completed',
        melodyData: result.melodyData || currentIdea.melodyData,
      };

      if (result.developedLyric && !developedLyric) {
        setDevelopedLyric(result.developedLyric);
      }
      const updated = await onUpdateIdea(currentIdea.id, updates);
      setCurrentIdea(updated);
    } catch (err: unknown) {
      console.error('Analysis error:', err);
      const errorObj = err as { message?: string; dspResult?: AudioAnalysisResult };
      const preservedDsp = errorObj.dspResult;

      const fallbackUpdates: Partial<AudioIdea> = {
        analysisStatus: 'error',
        ...(preservedDsp
          ? {
              bpm: preservedDsp.tempo,
              musicalKey: preservedDsp.key,
              melodyDescription: preservedDsp.melodyDescription,
              inputType: preservedDsp.inputType,
              suggestedGenres: preservedDsp.genreSuggestions.map((g) => g.name),
              genreSuggestions: preservedDsp.genreSuggestions,
              analyzedWith: 'local_dsp',
              melodyData: preservedDsp.melodyData,
            }
          : {}),
      };

      setAnalysisError(
        errorObj.message?.includes('400')
          ? 'API Key không hợp lệ. Vui lòng kiểm tra lại trong Cài đặt AI.'
          : errorObj.message?.includes('429')
          ? 'Đã vượt hạn mức gọi API (429). Vui lòng thử lại sau giây lát.'
          : errorObj.message || 'AI chưa thể phân tích bản ghi này. Bản ghi gốc vẫn được bảo tồn.'
      );
      const updated = await onUpdateIdea(currentIdea.id, fallbackUpdates);
      setCurrentIdea(updated);
    } finally {
      setIsAnalyzing(false);
    }
  };

  /**
   * V2 Core Feature: "✨ PHÁT TRIỂN Ý TƯỞNG THÀNH BÀI HÁT"
   * Sends audio, lyrics, BPM, key, melody contour, creativity settings to Gemini 3.6 Flash.
   * Creates a structured song suite and automatically preserves a version snapshot.
   */
  const handleDevelopSong = async () => {
    if (!isAiConnected) {
      setIsSettingsOpen(true);
      return;
    }

    setIsDevelopingSong(true);
    setDevelopSongError(null);
    setDevelopSuccessNotice(null);

    try {
      const devResult = await defaultGeminiProvider.developSong({
        title: currentIdea.title,
        duration: currentIdea.duration,
        audioBlob: currentIdea.audioBlob,
        originalLyric: currentIdea.originalLyric,
        transcript: currentIdea.transcript,
        emotion: currentIdea.emotion,
        bpm: currentIdea.bpm,
        key: currentIdea.musicalKey,
        melodyDescription: currentIdea.melodyDescription,
        genreSuggestions: currentIdea.genreSuggestions,
        currentLyrics: developedLyric,
        currentSections: currentIdea.songDevelopment?.sections,
        creativitySettings: {
          keepMelodyPct,
          keepLyricPct,
        },
      });

      // Update lyrics editor with newly generated complete lyrics
      if (devResult.developedLyrics) {
        setDevelopedLyric(devResult.developedLyrics);
      }

      // Automatically create a new version snapshot so original is NEVER lost
      const existingCount = currentIdea.versions?.length || 0;
      const { idea: updatedIdea, newVersion } = await createIdeaVersion(currentIdea.id, {
        name: `Phiên bản V${existingCount + 2} - AI phát triển`,
        lyrics: devResult.developedLyrics || developedLyric,
        sections: devResult.sections,
        development: devResult,
        creativeControls: { keepMelodyPct, keepLyricPct },
        note: `Tự động tạo bởi Gemini 3.6 Flash (Bảo toàn giai điệu ${keepMelodyPct}%, lời ${keepLyricPct}%)`,
      });

      setCurrentIdea(updatedIdea);
      setDevelopSuccessNotice(
        `Đã phát triển bài hát thành công và lưu giữ tại ${newVersion.name}! Bản ghi gốc được bảo tồn nguyên vẹn.`
      );
      setTimeout(() => setDevelopSuccessNotice(null), 5000);
    } catch (err: unknown) {
      console.error('Song development failed:', err);
      const msg = err instanceof Error ? err.message : 'Không thể phát triển bài hát lúc này.';
      setDevelopSongError(msg);
    } finally {
      setIsDevelopingSong(false);
    }
  };

  /**
   * V2 Feature: Handle AI Lyric Actions ("continue", "rewrite", "add_chorus", "verse_2", "bridge")
   */
  const handleTriggerLyricAction = async (action: LyricActionType, selectedText?: string): Promise<string> => {
    return await defaultGeminiProvider.expandLyrics({
      action,
      currentLyrics: developedLyric,
      selectedText,
      originalLyric: currentIdea.originalLyric,
      transcript: currentIdea.transcript,
      emotion: currentIdea.emotion,
      key: currentIdea.musicalKey,
      bpm: currentIdea.bpm,
      creativitySettings: {
        keepMelodyPct,
        keepLyricPct,
      },
    });
  };

  /**
   * V2 Feature: Song Structure update
   */
  const handleUpdateSections = async (sections: SongSection[]) => {
    const updatedDev = {
      ...(currentIdea.songDevelopment || { lastDevelopedAt: Date.now() }),
      sections,
    };
    const updated = await onUpdateIdea(currentIdea.id, {
      songDevelopment: updatedDev,
      updatedAt: Date.now(),
    });
    setCurrentIdea(updated);
  };

  /**
   * Version Switching
   */
  const handleSwitchVersion = async (versionId: string) => {
    const updated = await switchIdeaVersion(currentIdea.id, versionId);
    setCurrentIdea(updated);
    setDevelopedLyric(updated.lyrics || updated.developedLyric || updated.originalLyric || '');
    if (updated.creativeControls) {
      setKeepMelodyPct(updated.creativeControls.keepMelodyPct);
      setKeepLyricPct(updated.creativeControls.keepLyricPct);
    }
  };

  /**
   * Create Manual Version Snapshot
   */
  const handleCreateSnapshot = async (name: string, note?: string) => {
    const { idea: updated } = await createIdeaVersion(currentIdea.id, {
      name,
      lyrics: developedLyric,
      sections: currentIdea.songDevelopment?.sections,
      development: currentIdea.songDevelopment,
      creativeControls: { keepMelodyPct, keepLyricPct },
      note,
    });
    setCurrentIdea(updated);
  };

  /**
   * Change Project Status
   */
  const handleChangeStatus = async (status: ProjectStatus) => {
    const updated = await onUpdateIdea(currentIdea.id, { status, updatedAt: Date.now() });
    setCurrentIdea(updated);
  };

  const getInputTypeLabel = (type?: InputClassification) => {
    switch (type) {
      case 'singing_with_lyrics':
        return 'Hát có lời';
      case 'humming_melody':
        return 'Ngâm giai điệu (Humming)';
      case 'spoken_idea':
        return 'Ý tưởng nói (Spoken note)';
      case 'instrument_or_ambient':
        return 'Nhạc cụ / Âm thanh tự do';
      default:
        return 'Giai điệu ngẫu hứng';
    }
  };

  const timelineSteps = [
    { label: 'Ý tưởng gốc', icon: '🎙️', status: 'completed' },
    {
      label: 'AI hiểu',
      icon: '🧠',
      status: currentIdea.analysisStatus === 'completed' ? 'completed' : isAnalyzing ? 'active' : 'ready',
    },
    { label: 'Lời', icon: '📝', status: developedLyric ? 'completed' : currentIdea.originalLyric ? 'active' : 'upcoming' },
    { label: 'Cấu trúc', icon: '🧩', status: currentIdea.songDevelopment?.sections?.length ? 'completed' : 'upcoming' },
    { label: 'Giai điệu', icon: '🎼', status: currentIdea.melodyData ? 'completed' : 'upcoming' },
    { label: 'Music Blueprint', icon: '🎹', status: currentIdea.musicBlueprint ? 'completed' : 'upcoming' },
    { label: 'Bản demo', icon: '🎧', status: (currentIdea.generatedSongs && currentIdea.generatedSongs.length > 0) ? 'completed' : currentIdea.demoStatus === 'generating_audio' ? 'active' : 'upcoming' },
  ];

  return (
    <div className="flex-1 flex flex-col px-4 py-4 max-w-md mx-auto w-full space-y-6 pb-28 text-slate-100">
      {/* Navigation Header */}
      <div className="flex items-center justify-between pt-safe">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={16} />
          <span>Quay lại</span>
        </button>

        <div className="flex items-center gap-2">
          {/* AI Status Badge */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium border transition-colors ${
              isAiConnected
                ? 'bg-purple-950/60 border-purple-700/50 text-purple-300 hover:bg-purple-900/60'
                : 'bg-amber-950/50 border-amber-700/50 text-amber-300 hover:bg-amber-900/50'
            }`}
          >
            <Key size={11} />
            <span>{isAiConnected ? 'Gemini 3.6 Flash' : 'Chưa gắn AI Key'}</span>
          </button>
        </div>
      </div>

      {/* Main Title & Context Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-black text-white tracking-tight leading-tight">
          {currentIdea.title}
        </h1>
        <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
          <span className="flex items-center gap-1">
            <Calendar size={13} />
            {formatDateTime(currentIdea.createdAt)}
          </span>
          {currentIdea.context && (
            <>
              <span>•</span>
              <span className="px-2.5 py-0.5 rounded-full bg-slate-800/90 text-purple-300 text-[11px] border border-slate-700/60 font-medium">
                {currentIdea.context}
              </span>
            </>
          )}
          <span>•</span>
          <span className="font-mono text-purple-300">{formatDuration(currentIdea.duration)}</span>
        </div>
      </div>

      {/* V2 Version Management Bar & Status Switcher */}
      <VersionManagerBar
        versions={currentIdea.versions || []}
        activeVersionId={currentIdea.activeVersionId}
        status={currentIdea.status || 'draft'}
        onSwitchVersion={handleSwitchVersion}
        onCreateSnapshot={handleCreateSnapshot}
        onChangeStatus={handleChangeStatus}
      />

      {/* Original Recording Player Card */}
      <div className="p-4 rounded-3xl bg-[#0F172A]/80 border border-slate-800/80 shadow-lg space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-300 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
            <Lock size={12} className="text-emerald-400" />
            <span>Ý tưởng gốc (Bảo tồn vĩnh viễn)</span>
          </span>
          <span className="text-[10px] text-slate-500 italic">Không bị ghi đè</span>
        </div>

        <AudioPlayer
          blob={currentIdea.audioBlob}
          waveform={currentIdea.waveformData}
          duration={currentIdea.duration}
        />
      </div>

      {/* Creative Timeline */}
      <div className="p-4 rounded-3xl bg-slate-900/60 border border-slate-800/80 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-widest">
            Hành trình sáng tác
          </h3>
          <span className="text-[10px] text-purple-400 font-mono">BẮT LẤY → BÀI HÁT</span>
        </div>

        {/* Horizontal scrollable timeline */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-2 no-scrollbar">
          {timelineSteps.map((step, idx) => {
            const isDone = step.status === 'completed';
            const isActive = step.status === 'active';
            const isReady = step.status === 'ready';

            return (
              <div key={idx} className="flex items-center gap-1.5 shrink-0">
                <div
                  className={`flex flex-col items-center px-2.5 py-2 rounded-2xl border text-center transition-all ${
                    isDone
                      ? 'bg-purple-950/40 border-purple-500/40 text-purple-200'
                      : isActive
                      ? 'bg-blue-950/50 border-blue-400/50 text-blue-200 shadow-xs shadow-blue-500/20 animate-pulse'
                      : isReady
                      ? 'bg-slate-800/60 border-slate-700 text-slate-300'
                      : 'bg-slate-900/40 border-slate-800/60 text-slate-500 opacity-60'
                  }`}
                >
                  <span className="text-base">{step.icon}</span>
                  <span className="text-[10px] font-medium mt-0.5 whitespace-nowrap">
                    {step.label}
                  </span>
                  <span className="text-[9px] mt-0.5 font-mono">
                    {isDone ? 'Đã có' : isActive ? 'Đang xử lý' : isReady ? 'Khám phá' : 'Sắp có'}
                  </span>
                </div>
                {idx < timelineSteps.length - 1 && (
                  <ChevronRight size={12} className="text-slate-600 shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* V2 PRIMARY ACTION: "✨ PHÁT TRIỂN Ý TƯỞNG THÀNH BÀI HÁT" */}
      <div className="p-5 rounded-3xl bg-linear-to-b from-purple-950/60 via-slate-900/90 to-slate-950 border border-purple-600/50 shadow-xl space-y-3.5 relative overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-linear-to-tr from-purple-600 to-pink-500 flex items-center justify-center text-white shadow-md shadow-purple-500/30">
              <Sparkles size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black text-white tracking-wide uppercase">
                BẮT LẤY V2 • PHÁT TRIỂN BÀI HÁT
              </h3>
              <p className="text-[10.5px] text-purple-300">
                AI không chỉ hiểu ý tưởng — AI giúp bạn phát triển nó thành bài hát
              </p>
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          Gemini 3.6 Flash sẽ kết hợp bản ghi âm của bạn cùng dữ liệu âm học DSP để sáng tác trọn vẹn: ca từ giàu cảm xúc, phân đoạn cấu trúc bài hát, câu hook bắt tai, vòng hòa âm và hướng phối khí.
        </p>

        {/* Success Notice */}
        {developSuccessNotice && (
          <div className="p-3 rounded-2xl bg-emerald-950/70 border border-emerald-700/60 text-emerald-200 text-xs flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <span>{developSuccessNotice}</span>
          </div>
        )}

        {/* Error Notice */}
        {developSongError && (
          <div className="p-3 rounded-2xl bg-rose-950/60 border border-rose-700/60 text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-400 shrink-0" />
            <span>{developSongError}</span>
          </div>
        )}

        <button
          onClick={handleDevelopSong}
          disabled={isDevelopingSong}
          className="w-full py-3.5 px-4 rounded-2xl bg-linear-to-r from-purple-600 via-pink-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold text-sm shadow-lg shadow-purple-900/50 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60"
        >
          {isDevelopingSong ? (
            <>
              <Sparkles size={16} className="animate-spin" />
              <span>Đang lắng nghe & phát triển bài hát...</span>
            </>
          ) : (
            <>
              <Wand2 size={16} />
              <span>✨ Phát triển thành bài hát</span>
            </>
          )}
        </button>

        <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-1">
          <span>Bảo toàn giai điệu: {keepMelodyPct}%</span>
          <span className="text-emerald-400 flex items-center gap-1">
            <Lock size={10} /> Không ghi đè bản gốc
          </span>
          <span>Bảo toàn ca từ: {keepLyricPct}%</span>
        </div>
      </div>

      {/* V2 Section: LYRIC DEVELOPMENT EDITOR (with 5 AI Actions) */}
      <LyricDevelopmentEditor
        originalLyric={currentIdea.originalLyric}
        transcript={currentIdea.transcript}
        inputType={currentIdea.inputType}
        isAiConnected={isAiConnected}
        developedLyric={developedLyric}
        onChangeDevelopedLyric={setDevelopedLyric}
        onSaveDevelopedLyric={handleSaveDevelopedLyric}
        isSaving={isSavingLyrics}
        onTriggerLyricAction={handleTriggerLyricAction}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* V2 Section: SONG STRUCTURE & HARMONY */}
      <SongStructureEditor
        sections={currentIdea.songDevelopment?.sections || []}
        onChangeSections={handleUpdateSections}
        harmonyChords={currentIdea.songDevelopment?.harmonyChords}
        arrangementDirection={currentIdea.songDevelopment?.arrangementDirection}
        hookSuggestion={currentIdea.songDevelopment?.hookSuggestion}
        onGenerateAiStructure={handleDevelopSong}
        isAiGenerating={isDevelopingSong}
      />

      {/* V2 Section: MELODY CONTOUR & VISUALIZER */}
      <MelodyVisualizer
        melodyData={currentIdea.melodyData}
        bpm={currentIdea.bpm}
        musicalKey={currentIdea.musicalKey}
        melodyDescription={currentIdea.melodyDescription}
        melodyAiDevelopment={currentIdea.songDevelopment?.melodyDevelopment}
      />

      {/* Creative Controls (Section 12) */}
      <div className="p-4 rounded-3xl bg-[#0F172A]/80 border border-slate-800/80 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-300 flex items-center justify-center">
            <Sliders size={16} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Điều Khiển Mức Độ Sáng Tạo
            </h3>
            <p className="text-[10px] text-slate-400">
              Điều chỉnh mức độ AI được phép biến tấu ý tưởng gốc
            </p>
          </div>
        </div>

        {/* Slider 1: GIỮ GIAI ĐIỆU GỐC */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-medium">
            <span className="text-slate-300">BẢO TOÀN GIAI ĐIỆU GỐC</span>
            <span className="font-mono text-purple-400 font-bold">{keepMelodyPct}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={keepMelodyPct}
            onChange={(e) => handleSliderChange('melody', Number(e.target.value))}
            className="w-full accent-purple-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>Tự do biến tấu (0%)</span>
            <span>Giữ chặt mô-típ gốc (100%)</span>
          </div>
        </div>

        {/* Slider 2: GIỮ LỜI GỐC */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-xs font-medium">
            <span className="text-slate-300">BẢO TOÀN CA TỪ GỐC</span>
            <span className="font-mono text-pink-400 font-bold">{keepLyricPct}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={keepLyricPct}
            onChange={(e) => handleSliderChange('lyric', Number(e.target.value))}
            className="w-full accent-pink-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>Tự do phát triển mới (0%)</span>
            <span>Giữ nguyên từng chữ (100%)</span>
          </div>
        </div>
      </div>

      {/* V3 Section: BẢN DEMO BÀI HÁT (Lyria 3.5) */}
      <SongDemoSection
        idea={currentIdea}
        onIdeaUpdated={(updated) => {
          setCurrentIdea(updated);
          onUpdateIdea(updated.id, updated);
        }}
        onNotify={(msg, type) => {
          if (type === 'success') {
            setDevelopSuccessNotice(msg);
            setTimeout(() => setDevelopSuccessNotice(null), 6000);
          } else if (type === 'error') {
            setDevelopSongError(msg);
            setTimeout(() => setDevelopSongError(null), 6000);
          }
        }}
      />

      {/* AI Analysis Findings (THẤU HIỂU Ý TƯỞNG) */}
      <div className="p-4 rounded-3xl bg-[#0F172A]/80 border border-slate-800/80 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-pink-500/20 text-pink-300 flex items-center justify-center">
              <BrainCircuit size={16} />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Thấu hiểu âm thanh (AI Analysis)
              </h3>
              <p className="text-[10px] text-slate-400">
                {currentIdea.analyzedWith === 'hybrid'
                  ? 'Web Audio DSP + Gemini 3.6 Flash'
                  : 'Web Audio DSP trên thiết bị'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Cài đặt API Key"
              aria-label="Cài đặt API Key"
            >
              <Settings2 size={13} />
            </button>
            {currentIdea.analysisStatus === 'completed' && (
              <button
                onClick={handleRunAnalysis}
                disabled={isAnalyzing}
                className="py-1 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-purple-300 text-xs font-semibold flex items-center gap-1 border border-slate-700 active:scale-95 transition-all disabled:opacity-50"
              >
                <RotateCcw size={12} />
                <span>Phân tích lại</span>
              </button>
            )}
          </div>
        </div>

        {/* Analysis Status View */}
        {isAnalyzing || currentIdea.analysisStatus === 'analyzing' ? (
          <div className="p-6 rounded-2xl bg-linear-to-b from-purple-950/40 to-slate-900/90 border border-purple-800/50 text-center space-y-4 shadow-xl">
            <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-purple-500/20 animate-ping" />
              <div className="w-14 h-14 rounded-full bg-linear-to-tr from-purple-600 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-purple-500/30">
                <Sparkles size={24} className="animate-pulse" />
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-black tracking-wider text-white uppercase">
                BẮT LẤY ĐANG LẮNG NGHE...
              </h3>
              <p className="text-xs text-purple-200/90 font-medium">
                {isAiConnected
                  ? 'Đang đo đạc DSP và gửi tới Gemini 3.6 Flash đa phương thức...'
                  : 'Đang trích xuất nhịp, gam giọng và đường nét giai điệu trên thiết bị...'}
              </p>
            </div>
            <div className="flex items-center justify-center gap-1.5 py-1">
              <div className="w-1.5 h-4 bg-purple-400 rounded-full animate-[pulse_1s_infinite_100ms]" />
              <div className="w-1.5 h-8 bg-pink-400 rounded-full animate-[pulse_1s_infinite_200ms]" />
              <div className="w-1.5 h-11 bg-blue-400 rounded-full animate-[pulse_1s_infinite_300ms]" />
              <div className="w-1.5 h-7 bg-purple-300 rounded-full animate-[pulse_1s_infinite_400ms]" />
              <div className="w-1.5 h-5 bg-pink-300 rounded-full animate-[pulse_1s_infinite_500ms]" />
            </div>
          </div>
        ) : currentIdea.analysisStatus === 'error' || analysisError ? (
          <div className="p-5 rounded-2xl bg-rose-950/30 border border-rose-800/40 text-center space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-300 flex items-center justify-center mx-auto">
              <AlertCircle size={20} />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-white font-semibold">Bản ghi đã được lưu an toàn.</p>
              <p className="text-xs text-rose-200/90 leading-relaxed font-medium">
                {analysisError || 'AI chưa thể phân tích bản ghi này.'}
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
              <button
                onClick={handleRunAnalysis}
                disabled={isAnalyzing}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-all active:scale-95"
              >
                <RotateCcw size={13} />
                <span>Thử phân tích lại</span>
              </button>
            </div>
          </div>
        ) : currentIdea.analysisStatus === 'completed' ? (
          <div className="space-y-3.5 text-xs">
            {/* Nhóm 1: ĐO TỪ BẢN THU THỰC TẾ (Web Audio DSP) */}
            <div className="p-3 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-[11px] pb-1 border-b border-slate-800/80">
                <span className="text-blue-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Activity size={13} />
                  <span>Đo đạc từ bản thu (Web Audio DSP)</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Đo trực tiếp từ sóng âm</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
                <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800/60">
                  <span className="text-slate-400 block text-[10px]">Nhịp độ (BPM)</span>
                  <span className="font-bold text-blue-300 font-mono">
                    {currentIdea.bpm ? `${currentIdea.bpm} BPM` : 'Nhịp tự do'}
                  </span>
                </div>
                <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800/60">
                  <span className="text-slate-400 block text-[10px]">Giọng điệu ước tính</span>
                  <span className="font-bold text-emerald-300 font-mono">
                    {currentIdea.musicalKey || 'Tự do / Pentatonic'}
                  </span>
                </div>
                <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800/60">
                  <span className="text-slate-400 block text-[10px]">Thời lượng âm thanh</span>
                  <span className="font-bold text-white font-mono">
                    {Math.round(currentIdea.duration || 0)}s
                  </span>
                </div>
                <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800/60">
                  <span className="text-slate-400 block text-[10px]">Phân loại đầu vào</span>
                  <span className="font-bold text-purple-300 truncate block">
                    {getInputTypeLabel(currentIdea.inputType)}
                  </span>
                </div>
              </div>
            </div>

            {/* Nhóm 2: GỢI Ý & ĐỊNH HƯỚNG SÁNG TÁC (Gemini 3.6 Flash) */}
            <div className="p-3 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-[11px] pb-1 border-b border-slate-800/80">
                <span className="text-pink-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles size={13} />
                  <span>AI Gợi ý & Sáng tác (Gemini 3.6 Flash)</span>
                </span>
                <span className="text-[10px] text-pink-300 font-mono">Ý tưởng đề xuất</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60 space-y-1">
                  <span className="text-[10px] text-pink-300 font-semibold uppercase tracking-wider block">
                    💭 Cảm xúc gợi cảm hứng
                  </span>
                  <p className="text-white font-medium text-[11px] leading-snug">
                    {currentIdea.emotion || 'Chân thành, lắng đọng'}
                  </p>
                </div>

                <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60 space-y-1">
                  <span className="text-[10px] text-amber-300 font-semibold uppercase tracking-wider block">
                    🎼 Hòa âm gợi ý
                  </span>
                  <p className="text-amber-200 font-mono text-[11px] leading-snug">
                    {currentIdea.songDevelopment?.harmonyChords || currentIdea.harmonyChords || 'Am - F - C - G'}
                  </p>
                </div>

                {currentIdea.developmentIdeas && currentIdea.developmentIdeas.length > 0 && (
                  <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60 space-y-1.5 sm:col-span-2">
                    <span className="text-[10px] text-purple-300 font-semibold uppercase tracking-wider flex items-center gap-1">
                      <Lightbulb size={12} />
                      <span>Gợi ý mở rộng bài hát</span>
                    </span>
                    <ul className="space-y-1 text-[11px] text-slate-300 list-disc list-inside">
                      {currentIdea.developmentIdeas.map((ideaText, i) => (
                        <li key={i} className="leading-relaxed">{ideaText}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-5 rounded-2xl bg-slate-900/50 border border-dashed border-slate-800 text-center space-y-3">
            <p className="text-xs text-slate-300 leading-relaxed max-w-xs mx-auto">
              Phân tích nhịp độ, gam giọng bằng Web Audio DSP và nhận diện lời với Gemini 3.6 Flash.
            </p>
            <button
              onClick={handleRunAnalysis}
              disabled={isAnalyzing}
              className="py-2.5 px-5 rounded-2xl bg-linear-to-r from-purple-600 to-pink-600 text-white text-xs font-bold inline-flex items-center gap-2 shadow-md shadow-purple-900/40 active:scale-95 transition-all"
            >
              <Sparkles size={14} />
              <span>Phân tích ý tưởng này</span>
            </button>
          </div>
        )}
      </div>

      {/* AI Settings Modal */}
      <AiSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onKeyChanged={() => setIsAiConnected(hasApiKeyConfigured())}
      />
    </div>
  );
};
