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
  Radio,
  Cpu,
} from 'lucide-react';
import { AudioIdea, AudioAnalysisResult, InputClassification } from '../types';
import { formatDateTime, formatDuration } from '../lib/formatters';
import { AudioPlayer } from './AudioPlayer';
import { defaultAudioAnalyzer } from '../lib/analysis';

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

  // Creative sliders
  const [keepMelodyPct, setKeepMelodyPct] = useState<number>(idea.keepMelodyPct ?? 80);
  const [keepLyricPct, setKeepLyricPct] = useState<number>(idea.keepLyricPct ?? 70);

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
        currentIdea.duration
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
      setAnalysisError('Bản ghi đã được lưu an toàn. AI chưa thể phân tích bản ghi này.');
      const updated = await onUpdateIdea(currentIdea.id, { analysisStatus: 'error' });
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

        <span className="text-[11px] font-mono uppercase tracking-wider text-purple-400 px-2.5 py-0.5 rounded-full bg-purple-950/60 border border-purple-800/40">
          Dự án sáng tác
        </span>
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
              <p className="text-[10px] text-slate-400">Phân tích từ file audio thực</p>
            </div>
          </div>

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
                Đang tìm giai điệu, nhịp điệu và cảm xúc của bạn.
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
              Giải mã cao độ và nhịp độ qua Web Audio DSP thực tế...
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
              <p className="text-xs text-slate-300 leading-relaxed">
                AI chưa thể phân tích bản ghi này.
              </p>
            </div>
            <button
              onClick={handleRunAnalysis}
              disabled={isAnalyzing}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold inline-flex items-center gap-2 border border-slate-700 transition-all active:scale-95"
            >
              <RotateCcw size={13} />
              <span>Thử phân tích lại</span>
            </button>
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
              <span className="px-2 py-0.5 rounded-full bg-purple-950/70 border border-purple-800/60 text-[10px] text-purple-300 font-mono">
                Độ tin cậy: {Math.round((currentIdea.confidence || 0.7) * 100)}%
              </span>
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

            {/* AI Architecture Transparency Notice */}
            <div className="p-3 rounded-2xl bg-purple-950/20 border border-purple-900/30 space-y-1 text-[10px] text-slate-400">
              <div className="flex items-center gap-1.5 text-purple-300 font-semibold">
                <Cpu size={12} />
                <span>Trạng thái phân tích âm thanh thực</span>
              </div>
              <p className="leading-relaxed">
                Các chỉ số nhịp (BPM), gam giọng (Key) và đường nét giai điệu được tính toán trực tiếp từ tín hiệu âm thanh thực tế qua <strong>Web Audio DSP</strong> trên thiết bị của bạn.
              </p>
              {currentIdea.needsAiConnectionFor && currentIdea.needsAiConnectionFor.length > 0 && (
                <div className="pt-1 text-slate-400">
                  <span className="text-slate-300">Tính năng nâng cao khi gắn AI model (Gemini):</span>
                  <ul className="list-disc list-inside pl-1 text-[9.5px] text-slate-400 mt-0.5 space-y-0.5">
                    {currentIdea.needsAiConnectionFor.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* STATE 4: IDLE / NOT YET ANALYZED */
          <div className="p-5 rounded-2xl bg-slate-900/50 border border-dashed border-slate-800 text-center space-y-3">
            <p className="text-xs text-slate-300 leading-relaxed max-w-xs mx-auto">
              Nhấn <strong>Phân tích</strong> để tự động cảm nhận cảm xúc, đo nhịp độ (BPM), gam giọng (Key) và đường nét giai điệu từ chính file âm thanh của bạn.
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
                  : 'Bản ghi âm đã được lưu an toàn trên máy. Cần kết nối AI (Gemini Multimodal) để tự động nhận diện lời hát tiếng Việt.')}
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
    </div>
  );
};
