import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
  FileText,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Clock,
  Music2,
  Sliders,
  DollarSign,
  BookmarkPlus,
  Radio,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { AudioIdea, GeneratedSong, MusicBlueprint } from '../types';
import { createMusicBlueprint, callLyria35 } from '../services/audioAnalysis/lyriaService';
import { saveGeneratedSong, switchGeneratedSong, createIdeaVersion } from '../lib/db';

interface SongDemoSectionProps {
  idea: AudioIdea;
  onIdeaUpdated: (updated: AudioIdea) => void;
  onNotify?: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export const SongDemoSection: React.FC<SongDemoSectionProps> = ({
  idea,
  onIdeaUpdated,
  onNotify,
}) => {
  // Modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Generation status state
  const [status, setStatus] = useState<'idle' | 'preparing_blueprint' | 'generating_audio' | 'completed' | 'error'>(
    idea.demoStatus || (idea.generatedSongs && idea.generatedSongs.length > 0 ? 'completed' : 'idle')
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(idea.demoError || null);
  const [currentBlueprint, setCurrentBlueprint] = useState<MusicBlueprint | null>(
    idea.musicBlueprint || null
  );

  // Audio playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [showBlueprintDetails, setShowBlueprintDetails] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Active generated song
  const generatedSongs = idea.generatedSongs || [];
  const activeSong =
    generatedSongs.find((s) => s.id === idea.activeGeneratedSongId) ||
    (generatedSongs.length > 0 ? generatedSongs[generatedSongs.length - 1] : null);

  // Setup audio URL from blob
  useEffect(() => {
    if (activeSong && activeSong.audioBlob) {
      const url = URL.createObjectURL(activeSong.audioBlob);
      setAudioUrl(url);
      setCurrentBlueprint(activeSong.blueprint || idea.musicBlueprint || null);
      setStatus('completed');
      setErrorMessage(null);

      return () => {
        URL.revokeObjectURL(url);
      };
    } else if (idea.musicBlueprint) {
      setCurrentBlueprint(idea.musicBlueprint);
    }
  }, [activeSong, idea.musicBlueprint]);

  // Audio playback handlers
  const togglePlay = () => {
    if (!audioRef.current || !audioUrl) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch((e) => {
        console.error('Audio play failed:', e);
      });
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration || 0);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    if (audioRef.current) {
      audioRef.current.volume = newVol;
      setIsMuted(newVol === 0);
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      if (isMuted) {
        audioRef.current.volume = volume || 0.8;
        setIsMuted(false);
      } else {
        audioRef.current.volume = 0;
        setIsMuted(true);
      }
    }
  };

  const formatTime = (secs: number): string => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  /**
   * Main Execution: Create Music Blueprint then call Lyria 3.5
   * ONLY triggered after User explicitly confirms in modal!
   */
  const handleStartGeneration = async () => {
    setShowConfirmModal(false);
    setErrorMessage(null);

    // Stop current audio if playing
    if (audioRef.current && isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    }

    try {
      // Step 1: Preparing Music Blueprint
      setStatus('preparing_blueprint');
      const blueprint = await createMusicBlueprint(idea);
      setCurrentBlueprint(blueprint);

      // Step 2: Generating Audio with Lyria 3.5
      setStatus('generating_audio');
      const nextVersionNum = (idea.generatedSongs?.length || 0) + 1;
      const versionName = `Demo ${nextVersionNum < 10 ? '0' : ''}${nextVersionNum}`;

      const generatedSong = await callLyria35(blueprint, idea.id, versionName);

      // Step 3: Save generated song to IndexedDB
      const updatedIdea = await saveGeneratedSong(idea.id, generatedSong);
      onIdeaUpdated(updatedIdea);

      setStatus('completed');
      if (onNotify) {
        onNotify(`Đã tạo thành công bản demo ${versionName} với Lyria 3.5!`, 'success');
      }
    } catch (err: unknown) {
      console.error('Lyria Demo Generation failed:', err);
      const msg = err instanceof Error ? err.message : 'Đã có lỗi xảy ra khi tạo bản demo.';
      setErrorMessage(msg);
      setStatus('error');
      if (onNotify) {
        onNotify(msg, 'error');
      }
    }
  };

  /**
   * Switch between previously generated demos
   */
  const handleSelectDemo = async (songId: string) => {
    if (songId === idea.activeGeneratedSongId) return;
    if (audioRef.current && isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
    const updated = await switchGeneratedSong(idea.id, songId);
    onIdeaUpdated(updated);
  };

  /**
   * Save current demo as a permanent project snapshot version
   */
  const handleSaveDemoVersion = async () => {
    if (!activeSong) return;
    try {
      const verName = `Bản Demo — ${activeSong.versionName} (Lyria 3.5)`;
      const res = await createIdeaVersion(idea.id, {
        name: verName,
        lyrics: activeSong.blueprint.lyrics,
        note: `Bản demo âm thanh thật tạo bởi ${activeSong.model}, thể loại ${activeSong.blueprint.genre}, ${activeSong.blueprint.tempo_bpm} BPM, giọng ${activeSong.blueprint.key}.`,
      });
      onIdeaUpdated(res.idea);
      if (onNotify) {
        onNotify(`Đã lưu phiên bản "${verName}" vào lịch sử dự án!`, 'success');
      }
    } catch (e) {
      console.error('Failed to snapshot demo version:', e);
    }
  };

  return (
    <div id="bat-lay-v3-demo-section" className="bg-slate-900/90 border border-purple-500/20 rounded-2xl p-4 sm:p-6 shadow-xl relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute -top-24 -right-24 w-72 h-72 bg-gradient-to-br from-purple-600/10 via-pink-600/5 to-transparent rounded-full blur-3xl pointer-events-none" />

      {/* Hidden HTML5 Audio Element */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
        />
      )}

      {/* Section Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">🎧</span>
            <h3 className="text-base sm:text-lg font-bold text-slate-100 tracking-tight">
              BẢN DEMO
            </h3>
            {status === 'completed' && activeSong && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-purple-950/80 border border-purple-700/60 text-purple-300">
                Được tạo bởi {activeSong.model}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Biến ý tưởng của bạn thành một bản nhạc có thể nghe được.
          </p>
        </div>

        {/* Cost Badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-950/40 border border-purple-800/40 text-[11px] text-purple-300 font-medium">
          <DollarSign size={13} className="text-purple-400" />
          <span>Chi phí: $0.08 / lần tạo</span>
        </div>
      </div>

      {/* STATE 1: Chưa tạo demo (Idle) */}
      {status === 'idle' && (
        <div className="py-8 px-4 text-center rounded-xl bg-slate-950/40 border border-slate-800/60">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-purple-950/60 border border-purple-800/40 flex items-center justify-center text-purple-300 shadow-inner">
            <Music2 size={26} />
          </div>
          <h4 className="text-sm font-semibold text-slate-200 mb-1">
            Chưa có bản demo âm thanh
          </h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto mb-5 leading-relaxed">
            Gemini 3.6 Flash sẽ phân tích ý tưởng, ca từ và cấu trúc để tạo ra một <strong>Music Blueprint</strong>, sau đó <strong>Lyria 3.5</strong> sẽ tổng hợp thành một bản demo âm nhạc hoàn chỉnh.
          </p>
          <button
            id="btn-trigger-create-demo"
            onClick={() => setShowConfirmModal(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-purple-500 to-pink-500 hover:from-purple-500 hover:to-pink-400 text-white text-xs sm:text-sm font-bold shadow-lg shadow-purple-950/50 hover:shadow-purple-700/40 transition-all active:scale-95 cursor-pointer"
          >
            <span>🎧 TẠO BẢN DEMO</span>
          </button>
        </div>
      )}

      {/* STATE 2: Đang chuẩn bị Music Blueprint */}
      {status === 'preparing_blueprint' && (
        <div className="py-10 px-4 text-center rounded-xl bg-slate-950/50 border border-purple-900/40">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-purple-900/30 border border-purple-700/50 flex items-center justify-center text-purple-400">
            <Loader2 size={24} className="animate-spin" />
          </div>
          <h4 className="text-sm font-semibold text-purple-200 mb-1">
            Đang chuẩn bị Music Blueprint...
          </h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            Gemini 3.6 Flash đang thiết lập bố cục ca từ, hòa âm, định hướng nhạc cụ và chỉ dẫn phối khí dựa trên cài đặt sáng tạo của bạn.
          </p>
        </div>
      )}

      {/* STATE 3: Đang tạo bài hát với Lyria 3.5 */}
      {status === 'generating_audio' && (
        <div className="py-10 px-4 text-center rounded-xl bg-slate-950/50 border border-pink-900/40">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-pink-900/30 border border-pink-700/50 flex items-center justify-center text-pink-400">
            <Radio size={24} className="animate-pulse" />
          </div>
          <h4 className="text-sm font-semibold text-pink-200 mb-1">
            Đang tạo bài hát với Lyria 3.5...
          </h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            Mô hình Lyria 3.5 đang tổng hợp âm thanh giọng hát và các tầng nhạc cụ acoustic/strings. Quá trình này có thể mất từ 20 đến 45 giây.
          </p>
        </div>
      )}

      {/* STATE 4: Đã tạo demo (Completed) */}
      {status === 'completed' && activeSong && (
        <div className="space-y-4">
          {/* Version Selector Tabs (if multiple demos exist) */}
          {generatedSongs.length > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-800">
              <span className="text-[11px] text-slate-400 font-medium mr-1 shrink-0">Các bản demo:</span>
              {generatedSongs.map((song) => (
                <button
                  key={song.id}
                  onClick={() => handleSelectDemo(song.id)}
                  className={`text-[11px] px-2.5 py-1 rounded-md font-medium transition-all shrink-0 cursor-pointer ${
                    song.id === activeSong.id
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {song.versionName}
                </button>
              ))}
            </div>
          )}

          {/* Audio Player Box */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 shadow-inner">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              {/* Play / Pause Big Button */}
              <button
                id="btn-play-demo-audio"
                onClick={togglePlay}
                className="w-12 h-12 rounded-full bg-gradient-to-tr from-purple-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 text-white flex items-center justify-center shadow-lg shadow-purple-900/40 active:scale-95 transition-all shrink-0 cursor-pointer"
                title={isPlaying ? 'Tạm dừng' : 'Phát bản demo'}
              >
                {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
              </button>

              {/* Scrubber & Timeline */}
              <div className="flex-1 w-full min-w-0">
                <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1 font-mono">
                  <span>{formatTime(currentTime)}</span>
                  <span className="text-slate-200 font-bold">{activeSong.versionName}</span>
                  <span>{formatTime(duration)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={duration || 100}
                  step="0.1"
                  value={currentTime}
                  onChange={handleSeek}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>

              {/* Volume Controls */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={toggleMute}
                  className="text-slate-400 hover:text-slate-200 transition-colors p-1"
                >
                  {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-16 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  title="Âm lượng"
                />
              </div>
            </div>

            {/* Metadata Pills */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 pt-3 border-t border-slate-800/80 text-[11px]">
              <div className="bg-slate-900/90 rounded-lg p-2 border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Thể loại</span>
                <span className="font-medium text-slate-200 truncate block">
                  {activeSong.blueprint.genre || 'Pop Ballad'}
                </span>
              </div>
              <div className="bg-slate-900/90 rounded-lg p-2 border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Nhịp độ (BPM)</span>
                <span className="font-medium text-purple-300 truncate block">
                  {activeSong.blueprint.tempo_bpm} BPM
                </span>
              </div>
              <div className="bg-slate-900/90 rounded-lg p-2 border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Giọng điệu (Key)</span>
                <span className="font-medium text-emerald-300 truncate block">
                  {activeSong.blueprint.key}
                </span>
              </div>
              <div className="bg-slate-900/90 rounded-lg p-2 border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Thời lượng / Model</span>
                <span className="font-medium text-slate-200 truncate block">
                  {formatTime(duration)} • {activeSong.model}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              id="btn-listen-demo"
              onClick={togglePlay}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <Play size={14} />
              <span>{isPlaying ? 'TẠM DỪNG' : 'NGHE BẢN DEMO'}</span>
            </button>

            <button
              id="btn-remake-demo"
              onClick={() => setShowConfirmModal(true)}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all active:scale-95 cursor-pointer"
            >
              <RotateCcw size={13} />
              <span>TẠO PHIÊN BẢN KHÁC ($0.08)</span>
            </button>

            <button
              id="btn-save-demo-version"
              onClick={handleSaveDemoVersion}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-950/70 hover:bg-emerald-900/70 border border-emerald-800 text-emerald-300 text-xs font-semibold transition-all active:scale-95 cursor-pointer"
              title="Lưu bản demo này vào lịch sử phiên bản của bài hát"
            >
              <BookmarkPlus size={14} />
              <span className="hidden sm:inline">LƯU PHIÊN BẢN</span>
            </button>
          </div>

          {/* Collapsible Music Blueprint Viewer */}
          {currentBlueprint && (
            <div className="mt-3 border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60">
              <button
                onClick={() => setShowBlueprintDetails(!showBlueprintDetails)}
                className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs text-slate-300 font-medium hover:bg-slate-900/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <FileText size={14} className="text-purple-400" />
                  <span>Xem Music Blueprint & Lyria Prompt của bài</span>
                </div>
                {showBlueprintDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {showBlueprintDetails && (
                <div className="p-3.5 border-t border-slate-800 space-y-3 text-xs">
                  <div>
                    <span className="text-slate-400 font-semibold block mb-0.5">Định hướng thanh nhạc & Nhạc cụ:</span>
                    <p className="text-slate-300">{currentBlueprint.vocal_style}</p>
                    <p className="text-slate-400 text-[11px] mt-0.5">Nhạc cụ: {currentBlueprint.instrumentation}</p>
                  </div>

                  <div>
                    <span className="text-slate-400 font-semibold block mb-0.5">Hòa âm & Chỉ dẫn phối khí:</span>
                    <p className="text-purple-300 font-mono text-[11px]">{currentBlueprint.harmony}</p>
                    <p className="text-slate-300 text-[11px] mt-0.5">{currentBlueprint.production_direction}</p>
                  </div>

                  <div>
                    <span className="text-slate-400 font-semibold block mb-0.5">Lyria Prompt (Instruction gửi tới Lyria):</span>
                    <pre className="p-2.5 rounded-lg bg-slate-900 text-slate-300 text-[11px] whitespace-pre-wrap font-mono border border-slate-800">
                      {currentBlueprint.lyria_prompt}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* STATE 5: Lỗi tạo demo (Error) */}
      {status === 'error' && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/60 space-y-3">
          <div className="flex items-start gap-2.5">
            <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs sm:text-sm font-semibold text-red-200">
                Chưa thể tạo audio bản demo
              </h4>
              <p className="text-xs text-red-300/90 mt-1 leading-relaxed">
                {errorMessage}
              </p>
              {currentBlueprint && (
                <p className="text-xs text-slate-300 mt-2 font-medium">
                  ✓ Music Blueprint đã được Gemini 3.6 Flash thiết lập và lưu an toàn. Bạn có thể xem cấu trúc hoặc thử tạo lại bất kỳ lúc nào.
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-red-900/40">
            <button
              onClick={() => setShowConfirmModal(true)}
              className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              Thử lại với Lyria ($0.08)
            </button>
            {currentBlueprint && (
              <button
                onClick={() => setShowBlueprintDetails(!showBlueprintDetails)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition-colors cursor-pointer"
              >
                {showBlueprintDetails ? 'Ẩn Blueprint' : 'Xem Music Blueprint đã lưu'}
              </button>
            )}
          </div>

          {showBlueprintDetails && currentBlueprint && (
            <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 text-xs space-y-2 mt-2">
              <p className="text-slate-300"><strong>Thể loại:</strong> {currentBlueprint.genre} • <strong>Tempo:</strong> {currentBlueprint.tempo_bpm} BPM • <strong>Giọng:</strong> {currentBlueprint.key}</p>
              <p className="text-slate-400 text-[11px]"><strong>Nhạc cụ:</strong> {currentBlueprint.instrumentation}</p>
              <pre className="p-2 rounded bg-slate-950 text-slate-300 text-[11px] whitespace-pre-wrap font-mono border border-slate-800">
                {currentBlueprint.lyria_prompt}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* CONFIRMATION MODAL — Mandatory Section 3 */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-slate-900 border border-purple-500/30 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 text-purple-400">
              <span className="text-2xl">🎧</span>
              <h3 className="text-lg font-bold text-slate-100">
                TẠO BẢN DEMO?
              </h3>
            </div>

            <div className="space-y-2.5 text-xs sm:text-sm text-slate-300 leading-relaxed">
              <p>
                BẮT LẤY sẽ sử dụng <strong>Gemini 3.6 Flash</strong> và <strong>Lyria 3.5</strong> để tạo một bản demo từ ý tưởng hiện tại.
              </p>
              <div className="p-3 rounded-xl bg-purple-950/60 border border-purple-800/50 space-y-1 text-xs">
                <p className="font-bold text-purple-200 flex items-center gap-1">
                  <span>Chi phí dự kiến:</span>
                  <span className="text-purple-300">$0.08 / bài hát.</span>
                </p>
                <p className="text-purple-300/80">
                  Phí được tính bởi Gemini API. Không nằm trong Free Tier.
                </p>
              </div>
              <p className="text-xs text-slate-400">
                * Bản ghi âm gốc và ca từ gốc của bạn luôn được bảo toàn vĩnh viễn, không bao giờ bị ghi đè.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
              >
                HỦY
              </button>
              <button
                onClick={handleStartGeneration}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 text-white text-xs sm:text-sm font-bold shadow-md shadow-purple-950/50 transition-all active:scale-95 cursor-pointer"
              >
                TẠO BÀI HÁT — $0.08
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
