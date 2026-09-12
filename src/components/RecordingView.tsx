import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mic,
  Square,
  Pause,
  Play,
  X,
  RotateCcw,
  Sparkles,
  BookmarkCheck,
  AlertCircle,
  HelpCircle,
  Clock,
  Compass,
} from 'lucide-react';
import { AudioRecorderService } from '../lib/audioRecorder';
import { formatDuration, formatDurationWithMs, getDefaultTitle } from '../lib/formatters';
import { AudioPlayer } from './AudioPlayer';
import { CreativeContext, AudioIdea } from '../types';

interface RecordingViewProps {
  onCancel: () => void;
  onSave: (ideaData: Omit<AudioIdea, 'id'>, analyzeNow?: boolean) => Promise<void>;
}

const CONTEXT_OPTIONS: CreativeContext[] = [
  'Trên đường về',
  'Ở nhà',
  'Buổi sáng',
  'Buổi tối',
  'Một ngày mưa',
  'Khác',
];

export const RecordingView: React.FC<RecordingViewProps> = ({ onCancel, onSave }) => {
  const [phase, setPhase] = useState<'recording' | 'review'>('recording');
  const [durationMs, setDurationMs] = useState<number>(0);
  const [liveLevels, setLiveLevels] = useState<number[]>([0.1, 0.2, 0.3, 0.2, 0.1]);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Review state
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedDuration, setRecordedDuration] = useState<number>(0);
  const [recordedWaveform, setRecordedWaveform] = useState<number[]>([]);
  const [title, setTitle] = useState<string>(getDefaultTitle());
  const [selectedContext, setSelectedContext] = useState<CreativeContext | ''>('Ở nhà');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const recorderRef = useRef<AudioRecorderService | null>(null);

  const startRecordingSession = async () => {
    setErrorMessage(null);
    setDurationMs(0);
    setIsPaused(false);

    const service = new AudioRecorderService();
    recorderRef.current = service;

    service.onUpdate = ({ durationMs: dur, liveLevels: levels }) => {
      setDurationMs(dur);
      setLiveLevels(levels);
    };

    try {
      await service.start();
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMessage(error.message || 'Không thể bắt đầu ghi âm.');
    }
  };

  useEffect(() => {
    startRecordingSession();

    return () => {
      if (recorderRef.current) {
        recorderRef.current.cancel();
      }
    };
  }, []);

  const handlePauseToggle = () => {
    if (!recorderRef.current) return;
    if (isPaused) {
      recorderRef.current.resume();
      setIsPaused(false);
    } else {
      recorderRef.current.pause();
      setIsPaused(true);
    }
  };

  const handleStop = async () => {
    if (!recorderRef.current) return;
    try {
      const result = await recorderRef.current.stop();
      setRecordedBlob(result.blob);
      setRecordedDuration(result.durationSec);
      setRecordedWaveform(result.waveform);
      setTitle(getDefaultTitle());
      setPhase('review');
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMessage(error.message || 'Lỗi khi dừng ghi âm.');
    }
  };

  const handleReRecord = () => {
    setRecordedBlob(null);
    setRecordedDuration(0);
    setRecordedWaveform([]);
    setPhase('recording');
    startRecordingSession();
  };

  const handleSaveIdea = async (analyzeNow: boolean = false) => {
    if (!recordedBlob) return;
    setIsSaving(true);

    try {
      const ideaData: Omit<AudioIdea, 'id'> = {
        title: title.trim() || getDefaultTitle(),
        createdAt: Date.now(),
        duration: recordedDuration,
        audioBlob: recordedBlob,
        context: selectedContext || undefined,
        waveformData: recordedWaveform,
        favorite: false,
        analysisStatus: analyzeNow ? 'analyzing' : 'idle',
        keepMelodyPct: 80,
        keepLyricPct: 70,
      };

      await onSave(ideaData, analyzeNow);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#070B14] flex flex-col text-slate-100 overflow-y-auto">
      {/* Top Safe Area Bar */}
      <div className="pt-safe px-6 py-4 flex items-center justify-between border-b border-slate-900/80 sticky top-0 bg-[#070B14]/90 backdrop-blur-md z-10">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-pink-500 animate-pulse" />
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-300">
            {phase === 'recording' ? 'Đang Bắt Lấy Giai Điệu' : 'Lưu Ý Tưởng Mới'}
          </span>
        </div>
        <button
          onClick={onCancel}
          className="w-8 h-8 rounded-full bg-slate-900 border border-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors active:scale-95"
          aria-label="Đóng ghi âm"
        >
          <X size={16} />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col justify-between px-6 py-6 max-w-md mx-auto w-full">
        {errorMessage ? (
          /* Error & Permission Handling State */
          <div className="my-auto space-y-5 text-center">
            <div className="w-16 h-16 rounded-3xl bg-pink-500/10 border border-pink-500/20 text-pink-400 flex items-center justify-center mx-auto">
              <AlertCircle size={32} />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-white">Cần quyền truy cập Microphone</h3>
              <p className="text-xs text-slate-300 leading-relaxed max-w-xs mx-auto">
                {errorMessage}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 text-left text-xs space-y-2 text-slate-300">
              <div className="flex items-center gap-2 font-medium text-white">
                <Compass size={14} className="text-blue-400" />
                <span>Hướng dẫn bật trên iPhone Safari:</span>
              </div>
              <ol className="list-decimal pl-4 space-y-1 text-slate-400">
                <li>Vào ứng dụng <strong>Cài đặt (Settings)</strong> trên iPhone.</li>
                <li>Tìm chọn mục <strong>Safari</strong> &gt; <strong>Microphone</strong>.</li>
                <li>Chọn <strong>Hỏi</strong> hoặc <strong>Cho phép</strong>.</li>
                <li>Quay lại và nhấn nút <strong>Thử lại</strong> bên dưới.</li>
              </ol>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={onCancel}
                className="flex-1 py-3 px-4 rounded-2xl bg-slate-800 text-slate-300 hover:text-white font-medium text-xs transition-colors"
              >
                Quay lại
              </button>
              <button
                onClick={startRecordingSession}
                className="flex-1 py-3 px-4 rounded-2xl bg-linear-to-r from-purple-600 to-pink-600 text-white font-semibold text-xs shadow-lg shadow-purple-900/40 transition-all active:scale-95"
              >
                Thử lại
              </button>
            </div>
          </div>
        ) : phase === 'recording' ? (
          /* ACTIVE RECORDING PHASE */
          <>
            {/* Header info */}
            <div className="text-center space-y-2 pt-6">
              <p className="text-xs tracking-wider uppercase text-purple-300 font-medium">
                {isPaused ? 'Đã tạm dừng' : 'Đang lắng nghe âm thanh thật'}
              </p>
              <div className="font-mono text-4xl sm:text-5xl font-extrabold tracking-tight text-white drop-shadow-md">
                {formatDurationWithMs(durationMs)}
              </div>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Hãy hát, ngân nga hoặc chơi một hợp âm vừa vang lên trong đầu bạn...
              </p>
            </div>

            {/* Real-time Dynamic Waveform Visualization */}
            <div className="py-10 flex items-center justify-center gap-1.5 h-36">
              {liveLevels.map((lvl, index) => {
                const heightPct = isPaused ? 15 : Math.max(12, Math.round(lvl * 100));
                return (
                  <motion.div
                    key={index}
                    animate={{ height: `${heightPct}%` }}
                    transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                    className="w-2.5 rounded-full bg-linear-to-t from-blue-500 via-purple-500 to-pink-400 shadow-xs shadow-purple-500/20"
                  />
                );
              })}
            </div>

            {/* Recording Controls */}
            <div className="space-y-6 pb-safe">
              <div className="flex items-center justify-center gap-6">
                {/* Cancel Button */}
                <button
                  onClick={onCancel}
                  className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 flex flex-col items-center justify-center gap-0.5 text-[10px] active:scale-95 transition-all"
                  title="Hủy ghi âm"
                >
                  <X size={18} />
                  <span>Hủy</span>
                </button>

                {/* Main Stop Recording CTA */}
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  onClick={handleStop}
                  className="w-20 h-20 rounded-full bg-linear-to-tr from-pink-600 via-purple-600 to-indigo-600 text-white flex flex-col items-center justify-center shadow-xl shadow-pink-900/40 border-4 border-slate-900"
                  aria-label="Hoàn tất và lưu ghi âm"
                >
                  <Square size={26} className="fill-white" />
                </motion.button>

                {/* Pause/Resume Button */}
                <button
                  onClick={handlePauseToggle}
                  className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 text-slate-300 hover:text-white flex flex-col items-center justify-center gap-0.5 text-[10px] active:scale-95 transition-all"
                  title={isPaused ? 'Tiếp tục ghi âm' : 'Tạm dừng'}
                >
                  {isPaused ? <Play size={18} className="ml-0.5 text-emerald-400" /> : <Pause size={18} />}
                  <span>{isPaused ? 'Tiếp tục' : 'Tạm dừng'}</span>
                </button>
              </div>

              <p className="text-[11px] text-center text-slate-500 flex items-center justify-center gap-1.5">
                <span>Nhấn nút vuông ở giữa khi đã bắt trọn giai điệu</span>
              </p>
            </div>
          </>
        ) : (
          /* REVIEW & SAVE PHASE */
          <div className="space-y-5 my-auto pb-safe">
            <div className="space-y-1 text-center">
              <span className="text-xs font-semibold text-purple-400 uppercase tracking-widest">
                Giai điệu vừa bắt được
              </span>
              <h2 className="text-xl font-bold text-white">Khoảnh khắc vừa qua</h2>
            </div>

            {/* Editable Title */}
            <div className="space-y-1.5">
              <label className="text-[11px] text-slate-400 font-medium">Đặt tên cho ý tưởng</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ví dụ: Giai điệu lúc 16:32, Chiều mưa..."
                className="w-full px-4 py-3 rounded-2xl bg-slate-900/90 border border-slate-800 text-white font-medium text-sm focus:outline-hidden focus:border-purple-500 transition-colors"
              />
            </div>

            {/* Audio Playback Component */}
            {recordedBlob && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Bản thu gốc</span>
                  <span className="font-mono text-purple-300">{formatDuration(recordedDuration)}</span>
                </div>
                <AudioPlayer
                  blob={recordedBlob}
                  waveform={recordedWaveform}
                  duration={recordedDuration}
                />
              </div>
            )}

            {/* Creative Moment: "Khoảnh khắc này đến từ đâu?" */}
            <div className="space-y-2 pt-2">
              <label className="text-[11px] text-slate-400 font-medium block">
                Khoảnh khắc này đến từ đâu?
              </label>
              <div className="flex flex-wrap gap-1.5">
                {CONTEXT_OPTIONS.map((ctx) => (
                  <button
                    key={ctx}
                    type="button"
                    onClick={() => setSelectedContext(ctx)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      selectedContext === ctx
                        ? 'bg-purple-600 text-white shadow-xs shadow-purple-900/50 border border-purple-400/40'
                        : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    {ctx}
                  </button>
                ))}
              </div>
            </div>

            {/* Privacy note */}
            <p className="text-[11px] text-slate-500 text-center italic">
              Thu âm của bạn được lưu an toàn trên thiết bị (IndexedDB).
            </p>

            {/* Action Buttons */}
            <div className="space-y-2.5 pt-2">
              <div className="grid grid-cols-2 gap-2">
                {/* Ghi lại (Re-record) */}
                <button
                  type="button"
                  onClick={handleReRecord}
                  disabled={isSaving}
                  className="py-3 px-4 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white font-medium text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                >
                  <RotateCcw size={14} />
                  <span>Ghi lại</span>
                </button>

                {/* Lưu ý tưởng */}
                <button
                  type="button"
                  onClick={() => handleSaveIdea(false)}
                  disabled={isSaving}
                  className="py-3 px-4 rounded-2xl bg-linear-to-r from-blue-600 to-purple-600 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-blue-900/30 active:scale-95 transition-all"
                >
                  <BookmarkCheck size={14} />
                  <span>{isSaving ? 'Đang lưu...' : 'Lưu ý tưởng'}</span>
                </button>
              </div>

              {/* Phân tích sau (Save and analyze) */}
              <button
                type="button"
                onClick={() => handleSaveIdea(true)}
                disabled={isSaving}
                className="w-full py-3 px-4 rounded-2xl bg-linear-to-r from-purple-600 via-pink-600 to-rose-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-purple-900/40 active:scale-95 transition-all"
              >
                <Sparkles size={14} />
                <span>Lưu & Khám phá phát triển</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
