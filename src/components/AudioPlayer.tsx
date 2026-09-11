import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { formatDuration } from '../lib/formatters';

interface AudioPlayerProps {
  blob: Blob;
  waveform?: number[];
  duration?: number;
  compact?: boolean;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  blob,
  waveform = [],
  duration: initialDuration = 0,
  compact = false,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [audioDuration, setAudioDuration] = useState<number>(initialDuration);
  const [audioUrl, setAudioUrl] = useState<string>('');

  useEffect(() => {
    const url = URL.createObjectURL(blob);
    setAudioUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [blob]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((e) => console.warn('Playback error:', e));
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current && (!audioDuration || audioDuration === 0)) {
      setAudioDuration(audioRef.current.duration || initialDuration);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleSeek = (index: number, total: number) => {
    if (!audioRef.current) return;
    const dur = audioDuration || initialDuration || 1;
    const target = (index / total) * dur;
    audioRef.current.currentTime = target;
    setCurrentTime(target);
  };

  const progressPct =
    (audioDuration || initialDuration) > 0
      ? (currentTime / (audioDuration || initialDuration)) * 100
      : 0;

  // Fallback waveform if empty
  const bars =
    waveform && waveform.length > 0
      ? waveform
      : [0.3, 0.5, 0.7, 0.9, 0.6, 0.8, 0.4, 0.6, 0.3, 0.5, 0.7, 0.4];

  return (
    <div
      className={`flex items-center gap-3 w-full ${
        compact
          ? 'p-2 rounded-xl bg-slate-900/50'
          : 'p-3.5 rounded-2xl bg-[#0F172A]/70 border border-slate-800/80 shadow-inner'
      }`}
    >
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
      />

      {/* Play/Pause Button */}
      <button
        onClick={togglePlay}
        className={`shrink-0 rounded-full flex items-center justify-center transition-all shadow-md active:scale-95 ${
          compact
            ? 'w-9 h-9 bg-linear-to-tr from-purple-600 to-pink-500 text-white'
            : 'w-11 h-11 bg-linear-to-tr from-indigo-600 via-purple-600 to-pink-500 text-white shadow-purple-900/30'
        }`}
        aria-label={isPlaying ? 'Tạm dừng' : 'Phát giai điệu'}
      >
        {isPlaying ? <Pause size={compact ? 15 : 18} /> : <Play size={compact ? 15 : 18} className="ml-0.5" />}
      </button>

      {/* Waveform Scrubber */}
      <div className="flex-1 flex flex-col justify-center min-w-0">
        <div
          className="h-8 flex items-center gap-0.5 sm:gap-1 cursor-pointer select-none py-1"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const pct = Math.max(0, Math.min(1, clickX / rect.width));
            if (audioRef.current) {
              const dur = audioDuration || initialDuration || 1;
              audioRef.current.currentTime = pct * dur;
              setCurrentTime(pct * dur);
            }
          }}
        >
          {bars.map((amplitude, i) => {
            const barPct = (i / bars.length) * 100;
            const isPlayed = barPct <= progressPct;
            const heightPx = Math.max(6, Math.round(amplitude * 24));

            return (
              <div
                key={i}
                style={{ height: `${heightPx}px` }}
                className={`flex-1 rounded-full transition-colors duration-150 ${
                  isPlayed
                    ? 'bg-linear-to-t from-pink-400 to-purple-400 shadow-xs shadow-purple-500/30'
                    : 'bg-slate-700/60 hover:bg-slate-600'
                }`}
              />
            );
          })}
        </div>

        {/* Timers */}
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mt-0.5">
          <span>{formatDuration(currentTime)}</span>
          <span>{formatDuration(audioDuration || initialDuration)}</span>
        </div>
      </div>
    </div>
  );
};
