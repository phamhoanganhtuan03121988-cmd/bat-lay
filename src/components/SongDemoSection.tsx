import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  Sparkles,
  Volume2,
  VolumeX,
  FileText,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Music2,
  BookmarkPlus,
  Radio,
  Loader2,
  Headphones,
  CheckCircle2,
  Info,
  Bug,
  HelpCircle,
  ShieldAlert,
  XCircle,
  Wrench,
  SearchCode,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import {
  AudioIdea,
  GeneratedSong,
  MusicBlueprint,
  GenerationType,
  LYRIA_CLIP_ESTIMATED_COST,
  LYRIA_FULL_ESTIMATED_COST,
  DiagnosticTestId,
  DiagnosticTestResult,
} from '../types';
import {
  createMusicBlueprint,
  generateLyriaAudio,
  LyriaApiError,
} from '../services/audioAnalysis/lyriaService';
import {
  runLyriaDiagnosticTest,
  getDiagnosticConclusion,
  DIAGNOSTIC_MODEL,
  TEST_A_MINIMAL_PROMPT,
  buildTestBPrompt,
  buildTestCPrompt,
} from '../services/musicGeneration/lyriaPromptDiagnostic';
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
  // Modal state: null | 'clip' | 'full'
  const [confirmModalType, setConfirmModalType] = useState<GenerationType | null>(null);

  // Generation status state
  const [status, setStatus] = useState<
    'idle' | 'preparing_blueprint' | 'generating_clip' | 'generating_full' | 'completed' | 'error'
  >(() => {
    if (idea.generatedSongs && idea.generatedSongs.length > 0) return 'completed';
    if (idea.demoStatus === 'preparing_blueprint') return 'preparing_blueprint';
    if (idea.demoStatus === 'generating_clip') return 'generating_clip';
    if (idea.demoStatus === 'generating_full' || idea.demoStatus === 'generating_audio') return 'generating_full';
    if (idea.demoStatus === 'error') return 'error';
    return 'idle';
  });

  const [errorCode, setErrorCode] = useState<
    'POLICY_BLOCKED' | 'BILLING' | 'AUTH' | 'NETWORK' | 'UNKNOWN' | null
  >(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(idea.demoError || null);
  const [rawErrorDetails, setRawErrorDetails] = useState<string | null>(null);
  const [showErrorDetails, setShowErrorDetails] = useState(false);

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

  // Diagnostic State (V3.2)
  const [diagnosticResults, setDiagnosticResults] = useState<
    Partial<Record<DiagnosticTestId, DiagnosticTestResult | null>>
  >({});
  const [runningTestId, setRunningTestId] = useState<DiagnosticTestId | null>(null);
  const [diagnosticModalTest, setDiagnosticModalTest] = useState<DiagnosticTestId | null>(null);
  const [showDiagPrompt, setShowDiagPrompt] = useState<Partial<Record<DiagnosticTestId, boolean>>>({});
  const [showDiagError, setShowDiagError] = useState<Partial<Record<DiagnosticTestId, boolean>>>({});
  const [diagnosticAudioUrl, setDiagnosticAudioUrl] = useState<{
    testId: DiagnosticTestId;
    url: string;
  } | null>(null);

  const diagnosticAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isDiagPlaying, setIsDiagPlaying] = useState(false);

  // Setup audio URL from blob
  useEffect(() => {
    if (activeSong && activeSong.audioBlob) {
      const url = URL.createObjectURL(activeSong.audioBlob);
      setAudioUrl(url);
      setCurrentBlueprint(activeSong.blueprint || idea.musicBlueprint || null);
      setStatus('completed');
      setErrorMessage(null);
      setErrorCode(null);

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
      audioRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
        })
        .catch((e) => {
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
    if (!audioRef.current) return;
    if (isMuted) {
      audioRef.current.volume = volume || 0.5;
      setIsMuted(false);
    } else {
      audioRef.current.volume = 0;
      setIsMuted(true);
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  /**
   * Main Production Generation: Create Music Blueprint then call Lyria
   * ONLY triggered after User explicitly confirms in modal!
   * NO automatic retries!
   */
  const handleStartGeneration = async (genType: GenerationType) => {
    setConfirmModalType(null);
    setErrorMessage(null);
    setErrorCode(null);
    setRawErrorDetails(null);
    setShowErrorDetails(false);

    // Stop current audio if playing
    if (audioRef.current && isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    }

    try {
      // Step 1: Preparing Music Blueprint (if not existing or user wants refresh)
      setStatus('preparing_blueprint');
      let blueprint = currentBlueprint;
      if (!blueprint) {
        blueprint = await createMusicBlueprint(idea);
        setCurrentBlueprint(blueprint);
      }

      // Step 2: Generating Audio with Lyria
      setStatus(genType === 'clip' ? 'generating_clip' : 'generating_full');

      const versionName =
        genType === 'clip'
          ? `Clip 30s #${(idea.generatedSongs?.filter((s) => s.generationType === 'clip').length || 0) + 1}`
          : `Demo ${((idea.generatedSongs?.filter((s) => s.generationType !== 'clip').length || 0) + 1)
              .toString()
              .padStart(2, '0')}`;

      const generatedSong = await generateLyriaAudio({
        idea,
        blueprint,
        generationType: genType,
        versionName,
      });

      // Step 3: Save generated song to IndexedDB
      const updatedIdea = await saveGeneratedSong(idea.id, generatedSong);
      onIdeaUpdated(updatedIdea);

      setStatus('completed');
      if (onNotify) {
        onNotify(
          genType === 'clip'
            ? `Đã tạo thành công bản nghe thử 30s (${versionName})!`
            : `Đã tạo thành công bài hát đầy đủ (${versionName})!`,
          'success'
        );
      }
    } catch (err: unknown) {
      console.error('Lyria Generation failed:', err);
      setStatus('error');

      if (err instanceof LyriaApiError) {
        setErrorCode(err.errorCode);
        setErrorMessage(err.userMessage);
        setRawErrorDetails(err.rawErrorDetails);
      } else {
        const msg = err instanceof Error ? err.message : 'Đã có lỗi xảy ra khi tạo bản demo.';
        setErrorCode('UNKNOWN');
        setErrorMessage(msg);
        setRawErrorDetails(msg);
      }
    }
  };

  /**
   * Diagnostic Test Runner (V3.2):
   * Strictly calls lyria-3-clip-preview (~$0.04).
   * Never mutates Music Blueprint or original recording.
   */
  const handleExecuteDiagnosticTest = async (testId: DiagnosticTestId) => {
    setDiagnosticModalTest(null);
    setRunningTestId(testId);

    // Stop any playing audio
    if (audioRef.current && isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
    if (diagnosticAudioRef.current && isDiagPlaying) {
      diagnosticAudioRef.current.pause();
      setIsDiagPlaying(false);
    }

    try {
      // Ensure blueprint exists for Test C
      let blueprint = currentBlueprint;
      if (testId === 'test_c' && !blueprint) {
        blueprint = await createMusicBlueprint(idea);
        setCurrentBlueprint(blueprint);
      }

      const result = await runLyriaDiagnosticTest({
        testId,
        idea,
        blueprint,
      });

      setDiagnosticResults((prev) => ({
        ...prev,
        [testId]: result,
      }));

      // Setup audio preview if test produced audio
      if (result.outcome === 'pass' && result.audioBlob) {
        const url = URL.createObjectURL(result.audioBlob);
        setDiagnosticAudioUrl({ testId, url });
      }

      if (onNotify) {
        if (result.outcome === 'pass') {
          onNotify(`Hoàn thành ${result.testName}: PASS (Hợp lệ)`, 'success');
        } else if (result.outcome === 'blocked') {
          onNotify(`Hoàn thành ${result.testName}: BLOCKED (Bị từ chối)`, 'error');
        } else {
          onNotify(`Hoàn thành ${result.testName}: ERROR`, 'warning');
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setDiagnosticResults((prev) => ({
        ...prev,
        [testId]: {
          testId,
          testName: `Test ${testId.toUpperCase()}`,
          outcome: 'error',
          model: DIAGNOSTIC_MODEL,
          exactPrompt: '',
          timestamp: Date.now(),
          errorSummary: msg,
          rawErrorDetails: msg,
        },
      }));
    } finally {
      setRunningTestId(null);
    }
  };

  const toggleDiagnosticPlay = () => {
    if (!diagnosticAudioRef.current || !diagnosticAudioUrl) return;
    if (isDiagPlaying) {
      diagnosticAudioRef.current.pause();
      setIsDiagPlaying(false);
    } else {
      diagnosticAudioRef.current
        .play()
        .then(() => setIsDiagPlaying(true))
        .catch((e) => console.error('Diag audio play error:', e));
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
      const isClip = activeSong.generationType === 'clip';
      const verName = isClip
        ? `Bản nghe thử 30s — ${activeSong.versionName}`
        : `Bản Demo Đầy Đủ — ${activeSong.versionName}`;
      const res = await createIdeaVersion(idea.id, {
        name: verName,
        lyrics: activeSong.blueprint.lyrics,
        note: `Bản demo âm thanh thật tạo bởi ${activeSong.model}, thể loại ${activeSong.blueprint.genre}, ${activeSong.blueprint.tempo_bpm} BPM, giọng ${activeSong.blueprint.key}. Chi phí: $${activeSong.estimatedCost || 0.08}`,
      });
      onIdeaUpdated(res.idea);
      if (onNotify) {
        onNotify(`Đã lưu "${verName}" vào lịch sử phiên bản!`, 'success');
      }
    } catch (e) {
      console.error('Failed to snapshot demo version:', e);
    }
  };

  const diagnosticConclusion = getDiagnosticConclusion(diagnosticResults);

  return (
    <div
      id="bat-lay-v3-demo-section"
      className="bg-slate-900/90 border border-purple-500/30 rounded-3xl p-4 sm:p-6 shadow-xl relative overflow-hidden space-y-5"
    >
      {/* Background ambient lighting */}
      <div className="absolute -top-24 -right-24 w-72 h-72 bg-gradient-to-br from-purple-600/10 via-pink-600/5 to-transparent rounded-full blur-3xl pointer-events-none" />

      {/* Hidden HTML5 Audio Element for Main Songs */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
        />
      )}

      {/* Hidden HTML5 Audio Element for Diagnostic Audio */}
      {diagnosticAudioUrl && (
        <audio
          ref={diagnosticAudioRef}
          src={diagnosticAudioUrl.url}
          onEnded={() => setIsDiagPlaying(false)}
        />
      )}

      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center">
              <Headphones size={18} />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-white tracking-wide uppercase">
                BẢN DEMO BÀI HÁT (LYRIA V3.2)
              </h3>
              <p className="text-[11px] text-purple-300">
                Biến ý tưởng sáng tác thành bản nhạc có âm thanh thật
              </p>
            </div>
          </div>
        </div>

        {/* Action Status Indicator */}
        <div className="flex items-center gap-2 text-xs">
          {status === 'completed' && activeSong ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/70 border border-emerald-800 text-[11px] text-emerald-300 font-medium">
              <CheckCircle2 size={12} />
              <span>
                {activeSong.generationType === 'clip' ? 'Clip 30 giây' : 'Bản đầy đủ'} ({activeSong.model})
              </span>
            </span>
          ) : (
            <span className="text-[11px] text-slate-400 font-mono">
              Chưa phát sinh phí cho đến khi xác nhận
            </span>
          )}
        </div>
      </div>

      {/* RECOMMENDATION FLOW BANNER */}
      <div className="p-3.5 rounded-2xl bg-purple-950/40 border border-purple-800/40 text-xs text-purple-200 flex items-start gap-2.5">
        <Info size={16} className="text-purple-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-semibold text-white block">Luồng sáng tác khuyến nghị:</span>
          <p className="text-[11.5px] leading-relaxed text-purple-200/90">
            Nên bấm <strong>&quot;🎧 Nghe thử 30 giây&quot;</strong> trước (~$0.04) để kiểm tra phong cách phối khí và giọng hát. Nếu ưng ý, hãy bấm <strong>&quot;🎵 Tạo bài đầy đủ&quot;</strong> (~$0.08).
          </p>
        </div>
      </div>

      {/* COPYRIGHT / RECITATION SAFETY WARNING (YÊU CẦU 8) */}
      <div className="p-3 rounded-2xl bg-amber-950/30 border border-amber-800/40 text-xs text-amber-200/90 flex items-start gap-2.5">
        <ShieldAlert size={15} className="text-amber-400 shrink-0 mt-0.5" />
        <p className="text-[11px] leading-relaxed">
          <strong>Lưu ý về bản quyền ca từ:</strong> Lời ca sẽ được gửi tới Lyria để tạo nhạc. Nếu nội dung trùng hoặc quá giống lyrics đã đăng ký bản quyền của các tác phẩm âm nhạc nổi tiếng, bộ lọc an toàn của Google Lyria có thể từ chối tạo bài hát.
        </p>
      </div>

      {/* 2 NÚT BẤM RIÊNG BIỆT KÈM CHI PHÍ RÕ RÀNG */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Nút 1: Nghe thử 30s */}
        <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/90 hover:border-purple-600/40 transition-all flex flex-col justify-between space-y-2.5">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase flex items-center gap-1.5">
                <Headphones size={14} className="text-purple-400" />
                <span>NGHE THỬ 30 GIÂY</span>
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 font-mono border border-purple-800">
                lyria-3-clip-preview
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">
              Tạo nhanh đoạn intro & điệp khúc hook chính để kiểm tra độ hòa hợp âm sắc.
            </p>
          </div>

          <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between">
            <div className="text-[11px] text-slate-300 font-mono">
              Chi phí: <span className="text-purple-300 font-bold">~${LYRIA_CLIP_ESTIMATED_COST}</span>
            </div>
            <button
              id="btn-trigger-clip-preview"
              onClick={() => setConfirmModalType('clip')}
              disabled={status === 'generating_clip' || status === 'generating_full' || status === 'preparing_blueprint' || runningTestId !== null}
              className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-purple-900/40 active:scale-95 transition-all inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Headphones size={13} />
              <span>Nghe thử 30s</span>
            </button>
          </div>
        </div>

        {/* Nút 2: Tạo bài đầy đủ */}
        <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/90 hover:border-pink-600/40 transition-all flex flex-col justify-between space-y-2.5">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase flex items-center gap-1.5">
                <Music2 size={14} className="text-pink-400" />
                <span>TẠO BÀI ĐẦY ĐỦ</span>
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-950 text-pink-300 font-mono border border-pink-800">
                lyria-3.5
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">
              Sản xuất bài hát hoàn chỉnh với toàn bộ khổ hát (Verse, Chorus, Bridge, Outro).
            </p>
          </div>

          <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between">
            <div className="text-[11px] text-slate-300 font-mono">
              Chi phí: <span className="text-pink-300 font-bold">~${LYRIA_FULL_ESTIMATED_COST}</span>
            </div>
            <button
              id="btn-trigger-full-song"
              onClick={() => setConfirmModalType('full')}
              disabled={status === 'generating_clip' || status === 'generating_full' || status === 'preparing_blueprint' || runningTestId !== null}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-pink-900/40 active:scale-95 transition-all inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles size={13} />
              <span>Tạo bài đầy đủ</span>
            </button>
          </div>
        </div>
      </div>

      {/* STATE 2: Đang chuẩn bị Music Blueprint */}
      {status === 'preparing_blueprint' && (
        <div className="py-8 px-4 text-center rounded-2xl bg-slate-950/60 border border-purple-800/40 space-y-2">
          <div className="w-10 h-10 mx-auto rounded-full bg-purple-900/40 border border-purple-700/50 flex items-center justify-center text-purple-300">
            <Loader2 size={20} className="animate-spin" />
          </div>
          <h4 className="text-xs font-bold text-purple-200">
            Đang cấu trúc Music Blueprint với Gemini 3.6 Flash...
          </h4>
          <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
            Thiết lập phong cách âm nhạc, ca từ sạch và các tầng phối khí tối ưu cho Lyria.
          </p>
        </div>
      )}

      {/* STATE 3A: Đang tạo Clip 30s */}
      {status === 'generating_clip' && (
        <div className="py-8 px-4 text-center rounded-2xl bg-slate-950/60 border border-purple-600/50 space-y-2">
          <div className="w-10 h-10 mx-auto rounded-full bg-purple-900/40 border border-purple-600 flex items-center justify-center text-purple-300">
            <Radio size={20} className="animate-pulse" />
          </div>
          <h4 className="text-xs font-bold text-purple-200">
            Đang tạo bản nghe thử 30 giây với Lyria (lyria-3-clip-preview)...
          </h4>
          <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
            Hệ thống đang tổng hợp âm thanh. Quá trình này mất khoảng 15 đến 30 giây.
          </p>
        </div>
      )}

      {/* STATE 3B: Đang tạo bài đầy đủ */}
      {status === 'generating_full' && (
        <div className="py-8 px-4 text-center rounded-2xl bg-slate-950/60 border border-pink-600/50 space-y-2">
          <div className="w-10 h-10 mx-auto rounded-full bg-pink-900/40 border border-pink-600 flex items-center justify-center text-pink-300">
            <Sparkles size={20} className="animate-pulse" />
          </div>
          <h4 className="text-xs font-bold text-pink-200">
            Đang tạo bài hát đầy đủ với Lyria 3.5 (lyria-3.5)...
          </h4>
          <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
            Đang tổng hợp trọn vẹn giọng hát và hòa âm đa tầng. Vui lòng chờ trong giây lát.
          </p>
        </div>
      )}

      {/* STATE 4: ĐÃ TẠO DEMO (COMPLETED) */}
      {status === 'completed' && activeSong && (
        <div className="space-y-4 pt-1">
          {/* Version Selector Tabs (nếu có nhiều demo) */}
          {generatedSongs.length > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-800">
              <span className="text-[11px] text-slate-400 font-medium mr-1 shrink-0">
                Các bản đã tạo:
              </span>
              {generatedSongs.map((song) => (
                <button
                  key={song.id}
                  onClick={() => handleSelectDemo(song.id)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg font-medium transition-all shrink-0 cursor-pointer ${
                    song.id === activeSong.id
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {song.generationType === 'clip' ? '🎧 ' : '🎵 '}
                  {song.versionName}
                </button>
              ))}
            </div>
          )}

          {/* Audio Player Card */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/90 shadow-inner space-y-3">
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
                  <div className="flex items-center gap-1.5">
                    <span className="text-white font-bold">{activeSong.versionName}</span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] bg-purple-950 text-purple-300 border border-purple-800">
                      {activeSong.generationType === 'clip' ? 'Clip 30s' : 'Bài đầy đủ'}
                    </span>
                  </div>
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800/80 text-[11px]">
              <div className="bg-slate-900/90 rounded-xl p-2 border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Thể loại</span>
                <span className="font-medium text-slate-200 truncate block">
                  {activeSong.blueprint.genre || 'Pop Ballad'}
                </span>
              </div>
              <div className="bg-slate-900/90 rounded-xl p-2 border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Nhịp độ (BPM)</span>
                <span className="font-medium text-purple-300 truncate block">
                  {activeSong.blueprint.tempo_bpm} BPM
                </span>
              </div>
              <div className="bg-slate-900/90 rounded-xl p-2 border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Giọng điệu (Key)</span>
                <span className="font-medium text-emerald-300 truncate block">
                  {activeSong.blueprint.key}
                </span>
              </div>
              <div className="bg-slate-900/90 rounded-xl p-2 border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Model & Chi phí</span>
                <span className="font-medium text-slate-200 truncate block font-mono">
                  {activeSong.model} • ${activeSong.estimatedCost || (activeSong.generationType === 'clip' ? 0.04 : 0.08)}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              id="btn-listen-demo"
              onClick={togglePlay}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <Play size={14} />
              <span>{isPlaying ? 'TẠM DỪNG' : 'NGHE BẢN DEMO'}</span>
            </button>

            {/* Nếu đang nghe clip 30s, khuyến khích tạo bản đầy đủ */}
            {activeSong.generationType === 'clip' && (
              <button
                onClick={() => setConfirmModalType('full')}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white text-xs font-bold shadow-md transition-all active:scale-95 cursor-pointer"
              >
                <Sparkles size={13} />
                <span>THÍCH BẢN NÀY? TẠO BÀI ĐẦY ĐỦ (~$0.08)</span>
              </button>
            )}

            <button
              id="btn-save-demo-version"
              onClick={handleSaveDemoVersion}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-950/70 hover:bg-emerald-900/70 border border-emerald-800 text-emerald-300 text-xs font-semibold transition-all active:scale-95 cursor-pointer"
              title="Lưu bản demo này vào lịch sử phiên bản của bài hát"
            >
              <BookmarkPlus size={14} />
              <span>LƯU VÀO LỊCH SỬ</span>
            </button>
          </div>

          {/* Collapsible Music Blueprint & Lyria Prompt Viewer */}
          {currentBlueprint && (
            <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/60">
              <button
                onClick={() => setShowBlueprintDetails(!showBlueprintDetails)}
                className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs text-slate-300 font-medium hover:bg-slate-900/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <FileText size={14} className="text-purple-400" />
                  <span>Xem Music Blueprint & Lyria Prompt đã gửi</span>
                </div>
                {showBlueprintDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {showBlueprintDetails && (
                <div className="p-3.5 border-t border-slate-800 space-y-3 text-xs">
                  <div>
                    <span className="text-slate-400 font-semibold block mb-0.5">
                      Định hướng thanh nhạc & Nhạc cụ:
                    </span>
                    <p className="text-slate-300">{currentBlueprint.vocal_style}</p>
                    <p className="text-slate-400 text-[11px] mt-0.5">
                      Nhạc cụ: {currentBlueprint.instrumentation}
                    </p>
                  </div>

                  <div>
                    <span className="text-slate-400 font-semibold block mb-0.5">
                      Hòa âm & Chỉ dẫn phối khí:
                    </span>
                    <p className="text-purple-300 font-mono text-[11px]">{currentBlueprint.harmony}</p>
                    <p className="text-slate-300 text-[11px] mt-0.5">
                      {currentBlueprint.production_direction}
                    </p>
                  </div>

                  <div>
                    <span className="text-slate-400 font-semibold block mb-0.5">
                      Prompt gửi tới Lyria (Đã chuẩn hóa 2 phần):
                    </span>
                    <pre className="p-2.5 rounded-xl bg-slate-900 text-slate-300 text-[11px] whitespace-pre-wrap font-mono border border-slate-800 max-h-60 overflow-y-auto">
                      {currentBlueprint.lyria_prompt}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* STATE 5: XỬ LÝ LỖI — TUÂN THỦ NGHIÊM NGẶT YÊU CẦU 2 (KHÔNG CHO RETRY VÔ TỘI VẠ) */}
      {status === 'error' && (
        <div className="p-4 sm:p-5 rounded-2xl bg-rose-950/40 border border-rose-800/60 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
              <AlertCircle size={20} />
            </div>
            <div className="space-y-1.5 flex-1 min-w-0">
              <h4 className="text-xs sm:text-sm font-black tracking-wide text-rose-200 uppercase">
                {errorCode === 'POLICY_BLOCKED'
                  ? 'LYRIA TỪ CHỐI PROMPT'
                  : errorCode === 'BILLING'
                  ? 'CHƯA THỂ TẠO NHẠC VÌ QUYỀN TRUY CẬP (BILLING)'
                  : errorCode === 'AUTH'
                  ? 'LỖI XÁC THỰC API KEY'
                  : errorCode === 'NETWORK'
                  ? 'LỖI KẾT NỐI MẠNG'
                  : 'CHƯA THỂ TẠO BẢN DEMO'}
              </h4>

              {errorCode === 'POLICY_BLOCKED' ? (
                <div className="space-y-1">
                  <p className="text-xs font-bold text-rose-300">
                    Đừng thử lại cùng một prompt. Hãy kiểm tra phần nội dung bị từ chối.
                  </p>
                  <p className="text-[11.5px] text-rose-200/90 leading-relaxed">
                    Hệ thống an toàn / recitation của Google Lyria đã chặn request này. Vui lòng sử dụng công cụ chẩn đoán bên dưới để xác định chính xác nguyên nhân (do cấu trúc request, do lyrics hay do music direction).
                  </p>
                </div>
              ) : (
                <p className="text-xs text-rose-200/90 leading-relaxed">
                  {errorMessage ||
                    'Prompt âm nhạc này chưa được chấp nhận bởi hệ thống. Bản thu gốc và Music Blueprint của bạn vẫn được giữ nguyên an toàn.'}
                </p>
              )}

              <p className="text-[11px] text-emerald-300 flex items-center gap-1 font-medium pt-0.5">
                <CheckCircle2 size={12} className="text-emerald-400" />
                <span>Bản thu gốc và Music Blueprint của bạn vẫn được lưu nguyên vẹn, không hề bị ảnh hưởng.</span>
              </p>
            </div>
          </div>

          {/* Action buttons & View Error Details */}
          <div className="flex items-center gap-2 pt-2 border-t border-rose-900/40 flex-wrap">
            {/* TUYỆT ĐỐI KHÔNG HIỂN THỊ NÚT RETRY BỪA BÃI NẾU LÀ POLICY_BLOCKED */}
            {errorCode !== 'POLICY_BLOCKED' && (
              <button
                onClick={() => setConfirmModalType('clip')}
                className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all cursor-pointer active:scale-95"
              >
                Thử lại với Clip 30s (~$0.04)
              </button>
            )}

            {errorCode === 'POLICY_BLOCKED' && (
              <a
                href="#bat-lay-diagnostic-section"
                className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all cursor-pointer active:scale-95 inline-flex items-center gap-1.5"
              >
                <SearchCode size={13} />
                <span>Dùng công cụ chẩn đoán để tìm nguyên nhân</span>
              </a>
            )}

            {rawErrorDetails && (
              <button
                onClick={() => setShowErrorDetails(!showErrorDetails)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium inline-flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Bug size={12} />
                <span>{showErrorDetails ? 'Ẩn chi tiết lỗi' : 'Xem chi tiết lỗi'}</span>
              </button>
            )}

            {currentBlueprint && (
              <button
                onClick={() => setShowBlueprintDetails(!showBlueprintDetails)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition-colors cursor-pointer"
              >
                {showBlueprintDetails ? 'Ẩn Blueprint' : 'Xem Music Blueprint'}
              </button>
            )}
          </div>

          {/* Error Details Box for Debugging */}
          {showErrorDetails && rawErrorDetails && (
            <div className="p-3 rounded-xl bg-slate-950 border border-rose-900/50 text-[11px] space-y-1.5 font-mono">
              <span className="text-rose-400 font-bold block">Chi tiết kỹ thuật từ API:</span>
              <pre className="text-slate-300 whitespace-pre-wrap max-h-40 overflow-y-auto">
                {rawErrorDetails}
              </pre>
            </div>
          )}

          {showBlueprintDetails && currentBlueprint && (
            <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs space-y-2 mt-2">
              <p className="text-slate-300">
                <strong>Thể loại:</strong> {currentBlueprint.genre} • <strong>Tempo:</strong>{' '}
                {currentBlueprint.tempo_bpm} BPM • <strong>Giọng:</strong> {currentBlueprint.key}
              </p>
              <pre className="p-2 rounded bg-slate-950 text-slate-300 text-[11px] whitespace-pre-wrap font-mono border border-slate-800 max-h-44 overflow-y-auto">
                {currentBlueprint.lyria_prompt}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* KHU VỰC DEBUG: KIỂM TRA LYRIA (DIAGNOSTIC PIPELINE - YÊU CẦU 1, 4, 9, 10) */}
      {/* ========================================================================= */}
      <div
        id="bat-lay-diagnostic-section"
        className="p-4 sm:p-5 rounded-2xl bg-slate-950/90 border border-purple-500/40 space-y-4 shadow-lg"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-300 flex items-center justify-center">
              <Wrench size={15} />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">
                KIỂM TRA LYRIA (DIAGNOSTIC PIPELINE)
              </h4>
              <p className="text-[10.5px] text-slate-400">
                Xác định chính xác nguyên nhân policy block qua 3 tầng độc lập (Chỉ dùng model clip-preview ~$0.04)
              </p>
            </div>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 font-mono border border-purple-800 self-start sm:self-auto">
            {DIAGNOSTIC_MODEL}
          </span>
        </div>

        {/* Kết luận chẩn đoán tự động (Yêu cầu 9) */}
        {diagnosticConclusion && (
          <div
            className={`p-3.5 rounded-2xl border text-xs space-y-1.5 ${
              diagnosticConclusion.type === 'success'
                ? 'bg-emerald-950/40 border-emerald-800 text-emerald-200'
                : diagnosticConclusion.type === 'error'
                ? 'bg-rose-950/50 border-rose-800 text-rose-200'
                : 'bg-amber-950/40 border-amber-800 text-amber-200'
            }`}
          >
            <div className="font-bold uppercase flex items-center gap-1.5">
              {diagnosticConclusion.type === 'success' ? (
                <CheckCircle2 size={14} className="text-emerald-400" />
              ) : diagnosticConclusion.type === 'error' ? (
                <XCircle size={14} className="text-rose-400" />
              ) : (
                <AlertCircle size={14} className="text-amber-400" />
              )}
              <span>{diagnosticConclusion.title}</span>
            </div>
            <p className="text-[11.5px]">{diagnosticConclusion.summary}</p>
            <div className="p-2 rounded-xl bg-black/40 text-[11px] font-medium border border-white/5">
              👉 {diagnosticConclusion.recommendation}
            </div>
          </div>
        )}

        {/* 3 NÚT KIỂM TRA ĐỘC LẬP (YÊU CẦU 4) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* TEST A CARD */}
          <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-purple-300 uppercase">
                  ① Kiểm tra Lyria cơ bản
                </span>
                {diagnosticResults.test_a && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase font-mono ${
                      diagnosticResults.test_a.outcome === 'pass'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : diagnosticResults.test_a.outcome === 'blocked'
                        ? 'bg-rose-950 text-rose-300 border border-rose-800'
                        : 'bg-amber-950 text-amber-300 border border-amber-800'
                    }`}
                  >
                    {diagnosticResults.test_a.outcome}
                  </span>
                )}
              </div>
              <p className="text-[10.5px] text-slate-400 leading-snug">
                Prompt tối giản cố định an toàn, không có lời bài hát. Xác định API & auth có chạy không.
              </p>
            </div>

            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-mono">~$0.04</span>
              <button
                id="btn-test-a"
                onClick={() => setDiagnosticModalTest('test_a')}
                disabled={runningTestId !== null}
                className="px-2.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-[11px] font-bold transition-all active:scale-95 cursor-pointer"
              >
                {runningTestId === 'test_a' ? (
                  <span className="flex items-center gap-1">
                    <Loader2 size={11} className="animate-spin" /> Đang test...
                  </span>
                ) : (
                  'Chạy Test A'
                )}
              </button>
            </div>

            {/* View Details for Test A */}
            {diagnosticResults.test_a && (
              <div className="pt-1 text-[10px] space-y-1 border-t border-slate-800/60">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Kết quả:</span>
                  <span
                    className={`font-bold uppercase ${
                      diagnosticResults.test_a.outcome === 'pass'
                        ? 'text-emerald-400'
                        : diagnosticResults.test_a.outcome === 'blocked'
                        ? 'text-rose-400'
                        : 'text-amber-400'
                    }`}
                  >
                    {diagnosticResults.test_a.outcome}
                  </span>
                </div>
                <button
                  onClick={() =>
                    setShowDiagPrompt((prev) => ({ ...prev, test_a: !prev.test_a }))
                  }
                  className="text-purple-300 hover:underline block text-[10px]"
                >
                  {showDiagPrompt.test_a ? 'Ẩn prompt đã gửi' : 'Xem exact prompt đã gửi'}
                </button>
                {showDiagPrompt.test_a && (
                  <pre className="p-1.5 rounded bg-black/60 text-slate-300 font-mono text-[9.5px] whitespace-pre-wrap max-h-24 overflow-y-auto">
                    {diagnosticResults.test_a.exactPrompt}
                  </pre>
                )}
                {diagnosticResults.test_a.rawErrorDetails && (
                  <button
                    onClick={() =>
                      setShowDiagError((prev) => ({ ...prev, test_a: !prev.test_a }))
                    }
                    className="text-rose-300 hover:underline block text-[10px]"
                  >
                    {showDiagError.test_a ? 'Ẩn lỗi' : 'Xem chi tiết lỗi'}
                  </button>
                )}
                {showDiagError.test_a && diagnosticResults.test_a.rawErrorDetails && (
                  <pre className="p-1.5 rounded bg-black/60 text-rose-300 font-mono text-[9.5px] whitespace-pre-wrap max-h-24 overflow-y-auto">
                    {diagnosticResults.test_a.rawErrorDetails}
                  </pre>
                )}
              </div>
            )}
          </div>

          {/* TEST B CARD */}
          <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-purple-300 uppercase">
                  ② Kiểm tra với lyrics
                </span>
                {diagnosticResults.test_b && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase font-mono ${
                      diagnosticResults.test_b.outcome === 'pass'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : diagnosticResults.test_b.outcome === 'blocked'
                        ? 'bg-rose-950 text-rose-300 border border-rose-800'
                        : 'bg-amber-950 text-amber-300 border border-amber-800'
                    }`}
                  >
                    {diagnosticResults.test_b.outcome}
                  </span>
                )}
              </div>
              <p className="text-[10.5px] text-slate-400 leading-snug">
                Âm nhạc an toàn + lời ca của dự án. Xác định xem lyrics có phải nguyên nhân bị block.
              </p>
            </div>

            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-mono">~$0.04</span>
              <button
                id="btn-test-b"
                onClick={() => setDiagnosticModalTest('test_b')}
                disabled={runningTestId !== null}
                className="px-2.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-[11px] font-bold transition-all active:scale-95 cursor-pointer"
              >
                {runningTestId === 'test_b' ? (
                  <span className="flex items-center gap-1">
                    <Loader2 size={11} className="animate-spin" /> Đang test...
                  </span>
                ) : (
                  'Chạy Test B'
                )}
              </button>
            </div>

            {/* View Details for Test B */}
            {diagnosticResults.test_b && (
              <div className="pt-1 text-[10px] space-y-1 border-t border-slate-800/60">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Kết quả:</span>
                  <span
                    className={`font-bold uppercase ${
                      diagnosticResults.test_b.outcome === 'pass'
                        ? 'text-emerald-400'
                        : diagnosticResults.test_b.outcome === 'blocked'
                        ? 'text-rose-400'
                        : 'text-amber-400'
                    }`}
                  >
                    {diagnosticResults.test_b.outcome}
                  </span>
                </div>
                <button
                  onClick={() =>
                    setShowDiagPrompt((prev) => ({ ...prev, test_b: !prev.test_b }))
                  }
                  className="text-purple-300 hover:underline block text-[10px]"
                >
                  {showDiagPrompt.test_b ? 'Ẩn prompt đã gửi' : 'Xem exact prompt đã gửi'}
                </button>
                {showDiagPrompt.test_b && (
                  <pre className="p-1.5 rounded bg-black/60 text-slate-300 font-mono text-[9.5px] whitespace-pre-wrap max-h-24 overflow-y-auto">
                    {diagnosticResults.test_b.exactPrompt}
                  </pre>
                )}
                {diagnosticResults.test_b.rawErrorDetails && (
                  <button
                    onClick={() =>
                      setShowDiagError((prev) => ({ ...prev, test_b: !prev.test_b }))
                    }
                    className="text-rose-300 hover:underline block text-[10px]"
                  >
                    {showDiagError.test_b ? 'Ẩn lỗi' : 'Xem chi tiết lỗi'}
                  </button>
                )}
                {showDiagError.test_b && diagnosticResults.test_b.rawErrorDetails && (
                  <pre className="p-1.5 rounded bg-black/60 text-rose-300 font-mono text-[9.5px] whitespace-pre-wrap max-h-24 overflow-y-auto">
                    {diagnosticResults.test_b.rawErrorDetails}
                  </pre>
                )}
              </div>
            )}
          </div>

          {/* TEST C CARD */}
          <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-purple-300 uppercase">
                  ③ Kiểm tra prompt BẮT LẤY
                </span>
                {diagnosticResults.test_c && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase font-mono ${
                      diagnosticResults.test_c.outcome === 'pass'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : diagnosticResults.test_c.outcome === 'blocked'
                        ? 'bg-rose-950 text-rose-300 border border-rose-800'
                        : 'bg-amber-950 text-amber-300 border border-amber-800'
                    }`}
                  >
                    {diagnosticResults.test_c.outcome}
                  </span>
                )}
              </div>
              <p className="text-[10.5px] text-slate-400 leading-snug">
                Đầy đủ Music Blueprint (genre, mood, arrangement, lyrics). Kiểm tra toàn diện.
              </p>
            </div>

            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-mono">~$0.04</span>
              <button
                id="btn-test-c"
                onClick={() => setDiagnosticModalTest('test_c')}
                disabled={runningTestId !== null}
                className="px-2.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-[11px] font-bold transition-all active:scale-95 cursor-pointer"
              >
                {runningTestId === 'test_c' ? (
                  <span className="flex items-center gap-1">
                    <Loader2 size={11} className="animate-spin" /> Đang test...
                  </span>
                ) : (
                  'Chạy Test C'
                )}
              </button>
            </div>

            {/* View Details for Test C */}
            {diagnosticResults.test_c && (
              <div className="pt-1 text-[10px] space-y-1 border-t border-slate-800/60">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Kết quả:</span>
                  <span
                    className={`font-bold uppercase ${
                      diagnosticResults.test_c.outcome === 'pass'
                        ? 'text-emerald-400'
                        : diagnosticResults.test_c.outcome === 'blocked'
                        ? 'text-rose-400'
                        : 'text-amber-400'
                    }`}
                  >
                    {diagnosticResults.test_c.outcome}
                  </span>
                </div>
                <button
                  onClick={() =>
                    setShowDiagPrompt((prev) => ({ ...prev, test_c: !prev.test_c }))
                  }
                  className="text-purple-300 hover:underline block text-[10px]"
                >
                  {showDiagPrompt.test_c ? 'Ẩn prompt đã gửi' : 'Xem exact prompt đã gửi'}
                </button>
                {showDiagPrompt.test_c && (
                  <pre className="p-1.5 rounded bg-black/60 text-slate-300 font-mono text-[9.5px] whitespace-pre-wrap max-h-24 overflow-y-auto">
                    {diagnosticResults.test_c.exactPrompt}
                  </pre>
                )}
                {diagnosticResults.test_c.rawErrorDetails && (
                  <button
                    onClick={() =>
                      setShowDiagError((prev) => ({ ...prev, test_c: !prev.test_c }))
                    }
                    className="text-rose-300 hover:underline block text-[10px]"
                  >
                    {showDiagError.test_c ? 'Ẩn lỗi' : 'Xem chi tiết lỗi'}
                  </button>
                )}
                {showDiagError.test_c && diagnosticResults.test_c.rawErrorDetails && (
                  <pre className="p-1.5 rounded bg-black/60 text-rose-300 font-mono text-[9.5px] whitespace-pre-wrap max-h-24 overflow-y-auto">
                    {diagnosticResults.test_c.rawErrorDetails}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Diagnostic Audio Player if test generated audio */}
        {diagnosticAudioUrl && (
          <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-800/50 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <button
                onClick={toggleDiagnosticPlay}
                className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center hover:bg-purple-500 cursor-pointer shrink-0"
              >
                {isDiagPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
              </button>
              <div>
                <span className="font-bold text-white block">
                  Đã tạo đoạn âm thanh kiểm tra ({diagnosticAudioUrl.testId.toUpperCase()})
                </span>
                <span className="text-[10px] text-purple-300">
                  Lyria đã trả về âm thanh thành công cho test này.
                </span>
              </div>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded bg-purple-900/60 text-purple-200 font-mono">
              30s clip
            </span>
          </div>
        )}
      </div>

      {/* CONFIRMATION MODAL CHO BÀI TEST CHẨN ĐOÁN (YÊU CẦU 4) */}
      {diagnosticModalTest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-slate-900 border border-purple-500/40 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 text-purple-400">
              <div className="w-10 h-10 rounded-2xl bg-purple-500/20 flex items-center justify-center text-purple-300">
                <Wrench size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white uppercase">
                  XÁC NHẬN KIỂM TRA LYRIA ({diagnosticModalTest === 'test_a' ? 'TEST A' : diagnosticModalTest === 'test_b' ? 'TEST B' : 'TEST C'})
                </h3>
                <span className="text-[10px] text-purple-300 font-mono">
                  Mô hình: {DIAGNOSTIC_MODEL}
                </span>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <p>
                {diagnosticModalTest === 'test_a' &&
                  'BẮT LẤY sẽ gửi prompt âm nhạc tối giản (hoàn toàn an toàn, không có lời bài hát) tới Lyria để kiểm tra kết nối API và authentication.'}
                {diagnosticModalTest === 'test_b' &&
                  'BẮT LẤY sẽ gửi prompt âm nhạc cơ bản kèm lời ca hiện tại của bài hát để kiểm tra xem lyrics có kích hoạt safety/recitation filter hay không.'}
                {diagnosticModalTest === 'test_c' &&
                  'BẮT LẤY sẽ gửi prompt đầy đủ từ Music Blueprint (thể loại, hòa âm, phối khí, ca từ) để kiểm tra tính toàn vẹn.'}
              </p>

              <div className="p-3.5 rounded-2xl bg-purple-950/60 border border-purple-800/50 space-y-1">
                <p className="font-bold text-purple-200 flex items-center justify-between text-xs">
                  <span>Chi phí kiểm tra dự kiến:</span>
                  <span className="text-purple-300 font-mono text-sm">
                    ${LYRIA_CLIP_ESTIMATED_COST}
                  </span>
                </p>
                <p className="text-[11px] text-purple-300/80">
                  Chỉ sử dụng model clip preview (lyria-3-clip-preview), tuyệt đối không dùng model bài đầy đủ.
                </p>
              </div>

              <p className="text-[11px] text-slate-400">
                * Bản thu gốc, Music Blueprint và lịch sử phiên bản của bạn không bao giờ bị thay đổi.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                onClick={() => setDiagnosticModalTest(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                HỦY
              </button>
              <button
                id="btn-confirm-diagnostic-test"
                onClick={() => handleExecuteDiagnosticTest(diagnosticModalTest)}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md shadow-purple-900/50 transition-all active:scale-95 cursor-pointer"
              >
                XÁC NHẬN KIỂM TRA (${LYRIA_CLIP_ESTIMATED_COST})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL CHO CLIP 30S */}
      {confirmModalType === 'clip' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-slate-900 border border-purple-500/40 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 text-purple-400">
              <div className="w-10 h-10 rounded-2xl bg-purple-500/20 flex items-center justify-center text-purple-300">
                <Headphones size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white uppercase">
                  NGHE THỬ 30 GIÂY
                </h3>
                <span className="text-[10px] text-purple-300 font-mono">
                  Mô hình: lyria-3-clip-preview
                </span>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <p>
                BẮT LẤY sẽ tạo một bản preview 30 giây giúp bạn nghe thử phong cách âm nhạc, giọng hát và nhịp điệu của bài hát.
              </p>

              <div className="p-3.5 rounded-2xl bg-purple-950/60 border border-purple-800/50 space-y-1">
                <p className="font-bold text-purple-200 flex items-center justify-between text-xs">
                  <span>Chi phí dự kiến:</span>
                  <span className="text-purple-300 font-mono text-sm">
                    ${LYRIA_CLIP_ESTIMATED_COST}
                  </span>
                </p>
                <p className="text-[11px] text-purple-300/80">
                  Phí được tính trực tiếp bởi Gemini API theo lượng sử dụng thực tế.
                </p>
              </div>

              <p className="text-[11px] text-slate-400">
                * Bạn có muốn tạo bản preview không? Bản thu gốc luôn được bảo toàn tuyệt đối.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                onClick={() => setConfirmModalType(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                HỦY
              </button>
              <button
                id="btn-confirm-create-clip"
                onClick={() => handleStartGeneration('clip')}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md shadow-purple-900/50 transition-all active:scale-95 cursor-pointer"
              >
                TẠO BẢN PREVIEW (${LYRIA_CLIP_ESTIMATED_COST})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL CHO BÀI HÁT ĐẦY ĐỦ */}
      {confirmModalType === 'full' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-slate-900 border border-pink-500/40 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 text-pink-400">
              <div className="w-10 h-10 rounded-2xl bg-pink-500/20 flex items-center justify-center text-pink-300">
                <Music2 size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white uppercase">
                  TẠO BÀI ĐẦY ĐỦ
                </h3>
                <span className="text-[10px] text-pink-300 font-mono">
                  Mô hình: lyria-3.5
                </span>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <p>
                BẮT LẤY sẽ sử dụng <strong>Lyria 3.5</strong> để sản xuất trọn vẹn bài hát với toàn bộ lời ca và các phân đoạn (Intro, Verse, Chorus, Bridge, Outro).
              </p>

              <div className="p-3.5 rounded-2xl bg-pink-950/60 border border-pink-800/50 space-y-1">
                <p className="font-bold text-pink-200 flex items-center justify-between text-xs">
                  <span>Chi phí dự kiến:</span>
                  <span className="text-pink-300 font-mono text-sm">
                    ${LYRIA_FULL_ESTIMATED_COST}
                  </span>
                </p>
                <p className="text-[11px] text-pink-300/80">
                  Phí được tính trực tiếp bởi Gemini API theo lượng sử dụng thực tế.
                </p>
              </div>

              <p className="text-[11px] text-slate-400">
                * Bạn có muốn tạo bài hát đầy đủ không? Bản thu gốc của bạn không bao giờ bị ghi đè.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                onClick={() => setConfirmModalType(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                HỦY
              </button>
              <button
                id="btn-confirm-create-full"
                onClick={() => handleStartGeneration('full')}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white text-xs font-bold shadow-md shadow-pink-900/50 transition-all active:scale-95 cursor-pointer"
              >
                TẠO BÀI HÁT (${LYRIA_FULL_ESTIMATED_COST})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
