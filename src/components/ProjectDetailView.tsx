import React, { useState } from 'react';
import {
  ArrowLeft,
  Heart,
  Calendar,
  Sparkles,
  Sliders,
  FileText,
  Music,
  Compass,
  CheckCircle2,
  Lock,
  Edit3,
  Flame,
  Layers,
  ChevronRight,
  Disc3,
  Mic,
  BrainCircuit,
  Save,
} from 'lucide-react';
import { AudioIdea, AudioAnalysisResult } from '../types';
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
  const [isSavingLyrics, setIsSavingLyrics] = useState<boolean>(false);

  // Creative sliders
  const [keepMelodyPct, setKeepMelodyPct] = useState<number>(idea.keepMelodyPct ?? 80);
  const [keepLyricPct, setKeepLyricPct] = useState<number>(idea.keepLyricPct ?? 70);

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
        bpm: result.bpm,
        musicalKey: result.musicalKey,
        melodyDescription: result.melodyDescription,
        suggestedGenres: result.suggestedGenres,
        analysisStatus: 'completed',
      };

      setDevelopedLyric(currentIdea.developedLyric || result.developedLyric);
      const updated = await onUpdateIdea(currentIdea.id, updates);
      setCurrentIdea(updated);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const timelineSteps = [
    { label: 'Ý tưởng gốc', icon: '🎙', status: 'completed' },
    {
      label: 'AI hiểu',
      icon: '🧠',
      status: currentIdea.analysisStatus === 'completed' ? 'completed' : 'ready',
    },
    { label: 'Lời', icon: '📝', status: currentIdea.originalLyric ? 'active' : 'upcoming' },
    { label: 'Giai điệu', icon: '🎼', status: 'upcoming' },
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
                      ? 'bg-blue-950/50 border-blue-400/50 text-blue-200 shadow-xs shadow-blue-500/20'
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
                    {isDone ? 'Đã có' : isReady ? 'Khám phá' : 'Sắp có'}
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

      {/* AI Analysis Cards Section (📝 Lời, 🎼 Giai điệu, 💭 Cảm xúc, 🎹 Hướng âm nhạc) */}
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
              <p className="text-[10px] text-slate-400">Phân tích giai điệu & âm nhạc học</p>
            </div>
          </div>

          <button
            onClick={handleRunAnalysis}
            disabled={isAnalyzing}
            className="py-1.5 px-3 rounded-xl bg-linear-to-r from-purple-600 to-pink-600 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all disabled:opacity-50"
          >
            <Sparkles size={12} />
            <span>{isAnalyzing ? 'Đang phân tích...' : currentIdea.analysisStatus === 'completed' ? 'Phân tích lại' : 'Phân tích'}</span>
          </button>
        </div>

        {currentIdea.analysisStatus !== 'completed' ? (
          <div className="p-4 rounded-2xl bg-slate-900/50 border border-dashed border-slate-800 text-center space-y-2">
            <p className="text-xs text-slate-300">
              Nhấn <strong>Phân tích</strong> để tự động cảm nhận cảm xúc, nhịp điệu (BPM), giọng (Key) và gợi ý ca từ từ bản thu gốc.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 text-xs">
            {/* 💭 Cảm xúc */}
            <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
              <span className="text-[10px] text-pink-400 font-semibold uppercase tracking-wider block">
                💭 Cảm xúc
              </span>
              <p className="text-white font-medium">{currentIdea.emotion || 'Chưa xác định'}</p>
            </div>

            {/* 🎼 Giai điệu & Nhịp độ */}
            <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
              <span className="text-[10px] text-blue-400 font-semibold uppercase tracking-wider block">
                🎼 Nhịp & Giọng
              </span>
              <p className="text-white font-medium">
                {currentIdea.bpm} BPM • {currentIdea.musicalKey}
              </p>
            </div>

            {/* 🎹 Hướng âm nhạc */}
            <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1 col-span-2">
              <span className="text-[10px] text-purple-400 font-semibold uppercase tracking-wider block">
                🎹 Hướng âm nhạc gợi ý
              </span>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                {currentIdea.melodyDescription}
              </p>
              {currentIdea.suggestedGenres && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {currentIdea.suggestedGenres.map((g, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-full bg-purple-950/70 border border-purple-800/60 text-[10px] text-purple-300"
                    >
                      {g}
                    </span>
                  ))}
                </div>
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
                'Chưa có ca từ gốc. Hãy bấm "Phân tích" để AI lắng nghe lời thì thầm từ bản thu.'}
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
