import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Calendar,
  Sparkles,
  Sliders,
  FileText,
  Music,
  Lock,
  ChevronRight,
  BrainCircuit,
  Save,
  AlertCircle,
  RotateCcw,
  CheckCircle2,
  Mic,
  Volume2,
  Lightbulb,
  Key,
  Cpu,
  Settings2,
} from 'lucide-react';
import { AudioIdea, AudioAnalysisResult, InputClassification } from '../types';
import { formatDateTime, formatDuration } from '../lib/formatters';
import { AudioPlayer } from './AudioPlayer';
import { defaultAudioAnalyzer } from '../lib/analysis';
import { hasApiKeyConfigured } from '../services/audioAnalysis/apiKeyStorage';
import { AiSettingsModal } from './AiSettingsModal';

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
  const [activeLyricTab, setActiveLyricTab] = useState<'original' | 'developed'>('developed');
  const [developedLyric, setDevelopedLyric] = useState<string>(
    idea.developedLyric || idea.originalLyric || ''
  );
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isSavingLyrics, setIsSavingLyrics] = useState<boolean>(false);
  const [isAiConnected, setIsAiConnected] = useState<boolean>(hasApiKeyConfigured());
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Creative sliders
  const [keepMelodyPct, setKeepMelodyPct] = useState<number>(idea.keepMelodyPct ?? 80);
  const [keepLyricPct, setKeepLyricPct] = useState<number>(idea.keepLyricPct ?? 70);

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
    if (type === 'melody') {
      setKeepMelodyPct(val);
      const updated = await onUpdateIdea(currentIdea.id, { keepMelodyPct: val });
      setCurrentIdea(updated);
    } else {
      setKeepLyricPct(val);
      const updated = await onUpdateIdea(currentIdea.id, { keepLyricPct: val });
      setCurrentIdea(updated);
    }
  };

  const handleSaveDevelopedLyric = async () => {
    setIsSavingLyrics(true);
    try {
      const updated = await onUpdateIdea(currentIdea.id, { developedLyric });
      setCurrentIdea(updated);
    } finally {
      setIsSavingLyrics(false);
    }
  };

  const handleRunAnalysis = async () => {
    setIsAnalyzing(true);
    setAnalysisError(null);

    // Update status to analyzing
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
      };

      if (result.developedLyric && !currentIdea.developedLyric) {
        setDevelopedLyric(result.developedLyric);
      }
      const updated = await onUpdateIdea(currentIdea.id, updates);
      setCurrentIdea(updated);
    } catch (err: unknown) {
      console.error('Analysis error:', err);
      // Preserve local DSP findings if present on the error object
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
    { label: 'Ý tưởng gốc', icon: '🎙', status: 'completed' },
    {
      label: 'AI hiểu',
      icon: '🧠',
      status: currentIdea.analysisStatus === 'completed' ? 'completed' : isAnalyzing ? 'active' : 'ready',
    },
    { label: 'Lời', icon: '📝', status: currentIdea.originalLyric ? 'active' : 'upcoming' },
    { label: 'Giai điệu', icon: '🎼', status: currentIdea.musicalKey ? 'active' : 'upcoming' },
    { label: 'Bản phối', icon: '🎹', status: 'upcoming' },
    { label: 'Giọng hát', icon: '🎤', status: 'upcoming' },
    { label: 'Bài hát', icon: '🎧', status: 'upcoming' },
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

      {/* AI Analysis Cards Section (THẤU HIỂU Ý TƯỞNG) */}
      <div className="p-4 rounded-3xl bg-[#0F172A]/80 border border-slate-800/80 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-pink-500/20 text-pink-300 flex items-center justify-center">
              <BrainCircuit size={16} />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Thấu hiểu ý tưởng (AI Analysis)
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

        {/* STATE 1: ANALYZING */}
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
            {/* Visual sound bars */}
            <div className="flex items-center justify-center gap-1.5 py-1">
              <div className="w-1.5 h-4 bg-purple-400 rounded-full animate-[pulse_1s_infinite_100ms]" />
              <div className="w-1.5 h-8 bg-pink-400 rounded-full animate-[pulse_1s_infinite_200ms]" />
              <div className="w-1.5 h-11 bg-blue-400 rounded-full animate-[pulse_1s_infinite_300ms]" />
              <div className="w-1.5 h-7 bg-purple-300 rounded-full animate-[pulse_1s_infinite_400ms]" />
              <div className="w-1.5 h-5 bg-pink-300 rounded-full animate-[pulse_1s_infinite_500ms]" />
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              Phân tích tín hiệu âm thanh trực tiếp từ bản thu của bạn...
            </p>
          </div>
        ) : currentIdea.analysisStatus === 'error' || analysisError ? (
          /* STATE 2: ERROR / FALLBACK */
          <div className="p-5 rounded-2xl bg-rose-950/30 border border-rose-800/40 text-center space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-300 flex items-center justify-center mx-auto">
              <AlertCircle size={20} />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-white font-semibold">
                Bản ghi đã được lưu an toàn.
              </p>
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
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium inline-flex items-center gap-1.5 border border-slate-700"
              >
                <Key size={13} />
                <span>Kiểm tra API Key</span>
              </button>
            </div>
          </div>
        ) : currentIdea.analysisStatus === 'completed' ? (
          /* STATE 3: SUCCESS - REAL AUDIO ANALYSIS RESULTS */
          <div className="space-y-3 text-xs">
            {/* Input Classification Badge & Provenance */}
            <div className="flex items-center justify-between gap-2 p-2.5 rounded-2xl bg-slate-900/80 border border-slate-800 text-[11px]">
              <div className="flex items-center gap-1.5 text-purple-300 font-medium">
                <Mic size={13} />
                <span>Loại ý tưởng: <strong>{getInputTypeLabel(currentIdea.inputType)}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                {currentIdea.analyzedWith === 'hybrid' ? (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-950/70 border border-emerald-800/60 text-[10px] text-emerald-300 font-mono flex items-center gap-1">
                    <Sparkles size={9} />
                    Gemini 3.6 Flash
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[10px] text-slate-300 font-mono">
                    DSP Cục bộ
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {/* 💭 Cảm xúc */}
              <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
                <span className="text-[10px] text-pink-400 font-semibold uppercase tracking-wider block">
                  💭 Cảm xúc
                </span>
                <p className="text-white font-medium text-[11px] leading-snug">
                  {currentIdea.emotion || 'Chưa đủ dữ liệu'}
                </p>
              </div>

              {/* 🎼 Giai điệu & Nhịp độ */}
              <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
                <span className="text-[10px] text-blue-400 font-semibold uppercase tracking-wider block">
                  🎼 Nhịp & Giọng
                </span>
                <p className="text-white font-medium text-[11px] leading-snug">
                  {currentIdea.bpm ? `${currentIdea.bpm} BPM` : 'Nhịp tự do'} • {currentIdea.musicalKey || 'Chưa đủ dữ liệu'}
                </p>
              </div>

              {/* 🎹 Đường nét giai điệu thực tế */}
              <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1 col-span-2">
                <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider block">
                  🎼 Đường nét giai điệu
                </span>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  {currentIdea.melodyDescription || 'Chưa có phân tích đường nét giai điệu.'}
                </p>
              </div>

              {/* 🎹 Hướng âm nhạc gợi ý */}
              <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2 col-span-2">
                <span className="text-[10px] text-purple-400 font-semibold uppercase tracking-wider block">
                  🎹 Hướng âm nhạc gợi ý & Lý do
                </span>
                <div className="space-y-1.5">
                  {currentIdea.genreSuggestions && currentIdea.genreSuggestions.length > 0 ? (
                    currentIdea.genreSuggestions.map((g, i) => (
                      <div key={i} className="p-2 rounded-xl bg-slate-950/60 border border-slate-800/80">
                        <span className="font-semibold text-purple-300 block text-[11px]">
                          • {g.name}
                        </span>
                        <p className="text-[10px] text-slate-400 leading-relaxed mt-0.5">
                          {g.reason}
                        </p>
                      </div>
                    ))
                  ) : currentIdea.suggestedGenres && currentIdea.suggestedGenres.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {currentIdea.suggestedGenres.map((g, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-full bg-purple-950/70 border border-purple-800/60 text-[10px] text-purple-300"
                        >
                          {g}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500 text-[10px]">Chưa đủ dữ liệu gợi ý thể loại.</p>
                  )}
                </div>
              </div>

              {/* 💡 Ý tưởng phát triển sáng tác */}
              {currentIdea.developmentIdeas && currentIdea.developmentIdeas.length > 0 && (
                <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1.5 col-span-2">
                  <span className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider flex items-center gap-1">
                    <Lightbulb size={12} />
                    <span>Gợi ý phát triển từ chính bản thu</span>
                  </span>
                  <ul className="space-y-1 text-[11px] text-slate-300 list-disc list-inside">
                    {currentIdea.developmentIdeas.map((ideaText, i) => (
                      <li key={i} className="leading-relaxed">
                        {ideaText}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* AI Connection State / Architecture Transparency */}
            {!isAiConnected ? (
              <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-800/40 space-y-2 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-amber-300 font-bold flex items-center gap-1.5">
                    <Key size={13} />
                    <span>AI chưa được kết nối</span>
                  </span>
                  <button
                    onClick={() => setIsSettingsOpen(true)}
                    className="px-2.5 py-1 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 font-semibold transition-colors"
                  >
                    Kết nối Gemini API
                  </button>
                </div>
                <p className="text-slate-300 text-[10.5px] leading-relaxed">
                  Bản phân tích hiện tại được tính toán bằng bộ xử lý DSP cục bộ trên thiết bị. Để tự động nhận diện lời hát tiếng Việt và phát triển ca từ bằng Gemini 3.6 Flash, bạn có thể kết nối API Key cá nhân của mình.
                </p>
              </div>
            ) : (
              <div className="p-3 rounded-2xl bg-purple-950/20 border border-purple-900/30 space-y-1 text-[10px] text-slate-400">
                <div className="flex items-center justify-between text-purple-300 font-semibold">
                  <div className="flex items-center gap-1.5">
                    <Cpu size={12} />
                    <span>Bản thu đã được đồng bộ với Gemini 3.6 Flash</span>
                  </div>
                  <button
                    onClick={() => setIsSettingsOpen(true)}
                    className="text-purple-400 hover:underline"
                  >
                    Quản lý Key
                  </button>
                </div>
                <p className="leading-relaxed text-[10.5px]">
                  BPM, Key và đường nét cao độ do DSP đo đạc. Nhận diện ca từ tiếng Việt, cảm xúc và gợi ý phát triển do Gemini 3.6 Flash xử lý trực tiếp.
                </p>
              </div>
            )}
          </div>
        ) : (
          /* STATE 4: IDLE / NOT YET ANALYZED */
          <div className="p-5 rounded-2xl bg-slate-900/50 border border-dashed border-slate-800 text-center space-y-3">
            {!isAiConnected && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-950/50 border border-amber-700/50 text-[11px] text-amber-300 mb-1">
                <Key size={11} />
                <span>AI chưa được kết nối</span>
              </div>
            )}

            <p className="text-xs text-slate-300 leading-relaxed max-w-xs mx-auto">
              {isAiConnected
                ? 'Nhấn để bắt đầu phân tích nhịp độ, gam giọng bằng Web Audio DSP và lắng nghe nhận diện lời hát với Gemini 3.6 Flash.'
                : 'BẮT LẤY có thể đo nhịp (BPM) và gam giọng bằng DSP trên máy. Bạn có thể kết nối Gemini API cá nhân để nhận diện lời hát và phát triển ca từ.'}
            </p>

            <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
              <button
                onClick={handleRunAnalysis}
                disabled={isAnalyzing}
                className="py-2.5 px-5 rounded-2xl bg-linear-to-r from-purple-600 to-pink-600 text-white text-xs font-bold inline-flex items-center gap-2 shadow-md shadow-purple-900/40 active:scale-95 transition-all"
              >
                <Sparkles size={14} />
                <span>{isAiConnected ? 'Phân tích với Gemini 3.6 Flash' : 'Phân tích ý tưởng này'}</span>
              </button>

              {!isAiConnected && (
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="py-2.5 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-purple-300 text-xs font-medium inline-flex items-center gap-1.5 border border-slate-700 transition-colors"
                >
                  <Key size={13} />
                  <span>Cài đặt API Key</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Lyric Editor Section (Section 11) */}
      <div className="p-4 rounded-3xl bg-[#0F172A]/80 border border-slate-800/80 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-300 flex items-center justify-center">
              <FileText size={16} />
            </div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Khắc Họa Ca Từ (Lyrics)
            </h3>
          </div>

          {activeLyricTab === 'developed' && (
            <button
              onClick={handleSaveDevelopedLyric}
              disabled={isSavingLyrics}
              className="py-1 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-medium flex items-center gap-1 transition-colors"
            >
              <Save size={12} />
              <span>{isSavingLyrics ? 'Đang lưu...' : 'Lưu lời'}</span>
            </button>
          )}
        </div>

        {/* Two Tabs: "BẢN GỐC" and "PHIÊN BẢN PHÁT TRIỂN" */}
        <div className="flex p-1 bg-slate-900 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveLyricTab('original')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeLyricTab === 'original'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            BẢN GỐC (KHÔNG ĐỔI)
          </button>
          <button
            onClick={() => setActiveLyricTab('developed')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeLyricTab === 'developed'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            PHIÊN BẢN PHÁT TRIỂN
          </button>
        </div>

        {activeLyricTab === 'original' ? (
          <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <Lock size={12} className="text-emerald-400" />
              <span>Lời gốc được bảo tồn nguyên vẹn:</span>
            </div>
            <p className="text-xs text-slate-200 whitespace-pre-line leading-relaxed italic">
              {currentIdea.originalLyric ||
                currentIdea.transcript ||
                (currentIdea.inputType === 'humming_melody'
                  ? 'Bản thu ngâm nga giai điệu không lời (Humming). BẮT LẤY tập trung phân tích cao độ và nhịp điệu của bạn thay vì ép thành ca từ.'
                  : currentIdea.inputType === 'spoken_idea'
                  ? 'Ý tưởng được thu âm bằng giọng nói. Bạn có thể tự do gieo vần cho giai điệu ở tab Phiên Bản Phát Triển.'
                  : !isAiConnected
                  ? 'Bản ghi âm đã được lưu an toàn trên máy. Kết nối Gemini API (BYOK) để tự động nhận diện lời hát tiếng Việt.'
                  : 'Chưa phát hiện lời hát rõ rệt trong đoạn thu âm này.')}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <textarea
              rows={4}
              value={developedLyric}
              onChange={(e) => setDevelopedLyric(e.target.value)}
              placeholder="Viết tiếp câu hát, phát triển thêm các đoạn điệp khúc hoặc lời 2..."
              className="w-full p-3 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-hidden focus:border-purple-500 leading-relaxed font-sans"
            />
            <p className="text-[10px] text-slate-500">
              Bản phát triển cho phép bạn tự do sáng tác thêm mà không bao giờ mất đi ý tưởng ban đầu.
            </p>
          </div>
        )}
      </div>

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
              Điều chỉnh mức độ AI được phép phát triển ý tưởng gốc.
            </p>
          </div>
        </div>

        {/* Slider 1: GIỮ GIAI ĐIỆU GỐC */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-medium">
            <span className="text-slate-300">GIỮ GIAI ĐIỆU GỐC</span>
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
            <span>Tự do bay bổng (0%)</span>
            <span>Trung thành tuyệt đối (100%)</span>
          </div>
        </div>

        {/* Slider 2: GIỮ LỜI GỐC */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-xs font-medium">
            <span className="text-slate-300">GIỮ LỜI GỐC</span>
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
            <span>Viết lại hoàn toàn (0%)</span>
            <span>Giữ nguyên từng chữ (100%)</span>
          </div>
        </div>
      </div>

      {/* Future Production Actions (Section 16: Sắp có) */}
      <div className="p-4 rounded-3xl bg-slate-900/40 border border-slate-800/80 text-center space-y-2">
        <span className="text-[10px] uppercase tracking-widest text-slate-500 font-mono">
          Sản xuất âm nhạc hoàn chỉnh
        </span>
        <h4 className="text-xs font-bold text-slate-300">Hòa âm, Giọng hát & Bản master</h4>
        <p className="text-[11px] text-slate-400">
          Các tính năng tự động tạo bản phối (Arrangement) và gắn giọng hát của bạn sẽ được kích hoạt ở phiên bản tiếp theo.
        </p>
        <span className="inline-block px-3 py-1 rounded-full bg-slate-800 text-[10px] text-slate-400 font-medium">
          Trạng thái: Sắp có
        </span>
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
