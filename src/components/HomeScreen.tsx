import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Mic, Music, ArrowRight, Sparkles, Heart, ShieldCheck, Clock, Key } from 'lucide-react';
import { AudioIdea } from '../types';
import { formatDuration, formatDateTime } from '../lib/formatters';
import { hasApiKeyConfigured } from '../services/audioAnalysis/apiKeyStorage';

interface HomeScreenProps {
  recentIdeas: AudioIdea[];
  onStartRecording: () => void;
  onOpenIdea: (idea: AudioIdea) => void;
  onViewAllLibrary: () => void;
  onOpenPwaGuide: () => void;
  onOpenAiSettings?: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  recentIdeas,
  onStartRecording,
  onOpenIdea,
  onViewAllLibrary,
  onOpenPwaGuide,
  onOpenAiSettings,
}) => {
  const [isAiConnected, setIsAiConnected] = useState<boolean>(hasApiKeyConfigured());

  useEffect(() => {
    const handleKeyChange = () => {
      setIsAiConnected(hasApiKeyConfigured());
    };
    window.addEventListener('bat_lay_api_key_updated', handleKeyChange);
    return () => window.removeEventListener('bat_lay_api_key_updated', handleKeyChange);
  }, []);

  return (
    <div className="flex-1 flex flex-col justify-between px-5 py-6 max-w-md mx-auto w-full space-y-8 pb-24">
      {/* Brand & Atmosphere Header */}
      <header className="space-y-2 text-center pt-2">
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-400/20 text-[11px] font-medium text-purple-300">
            <Sparkles size={12} className="text-pink-400" />
            <span>Nhật ký âm nhạc sáng tạo</span>
          </div>

          {onOpenAiSettings && (
            <button
              onClick={onOpenAiSettings}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${
                isAiConnected
                  ? 'bg-purple-950/60 border-purple-700/60 text-purple-300 hover:bg-purple-900/60'
                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-purple-300 hover:border-slate-600'
              }`}
              title="Cài đặt Gemini AI (BYOK)"
              aria-label="Cài đặt Gemini AI"
            >
              <Key size={11} className={isAiConnected ? 'text-emerald-400' : 'text-slate-400'} />
              <span>{isAiConnected ? 'Gemini 3.6 Flash' : 'Gắn AI Key'}</span>
            </button>
          )}
        </div>

        <h1 className="text-3xl font-black tracking-tight text-white flex items-center justify-center gap-2">
          <span>BẮT LẤY</span>
        </h1>
        <p className="text-xs italic text-purple-200/80 font-light tracking-wide">
          &ldquo;Một ý nghĩ thoáng qua. Một giai điệu ở lại.&rdquo;
        </p>
      </header>

      {/* Hero Capture Section */}
      <section className="space-y-6 text-center my-auto">
        <div className="space-y-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Có một giai điệu trong đầu?
          </h2>
          <p className="text-sm font-medium text-purple-300/90 tracking-wide">
            Đừng để nó biến mất.
          </p>
        </div>

        {/* Primary CTA: 🎙️ GHI LẠI CẢM XÚC */}
        <div className="relative flex flex-col items-center justify-center pt-2">
          {/* Ambient Breathing Glow Ring */}
          <div className="absolute w-36 h-36 rounded-full bg-linear-to-tr from-pink-600/30 via-purple-600/30 to-blue-500/20 blur-xl animate-pulse pointer-events-none" />

          <motion.button
            whileTap={{ scale: 0.94 }}
            whileHover={{ scale: 1.02 }}
            onClick={onStartRecording}
            className="relative z-10 w-full max-w-xs py-5 px-6 rounded-3xl bg-linear-to-r from-pink-500 via-purple-600 to-indigo-600 text-white font-bold text-base tracking-wide shadow-2xl shadow-purple-900/50 flex items-center justify-center gap-3 border border-white/20 active:scale-95 transition-all"
            aria-label="Bắt đầu ghi lại cảm xúc"
          >
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center text-white backdrop-blur-xs shadow-inner">
              <Mic size={22} className="animate-pulse" />
            </div>
            <div className="text-left">
              <span className="block text-base leading-tight font-black tracking-wide">
                GHI LẠI CẢM XÚC
              </span>
              <span className="block text-[11px] font-normal text-purple-200">
                Lưu giữ giai điệu trước khi bạn quên
              </span>
            </div>
          </motion.button>
        </div>

        <p className="text-[11px] text-slate-400 font-light max-w-xs mx-auto">
          Thu âm trực tiếp trên thiết bị của bạn. Không lo mất đi nguồn cảm hứng bất chợt.
        </p>
      </section>

      {/* Recent Ideas Stream */}
      <section className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Clock size={13} />
            <span>Ý tưởng gần đây</span>
          </h3>
          {recentIdeas.length > 0 && (
            <button
              onClick={onViewAllLibrary}
              className="text-xs font-medium text-purple-400 hover:text-purple-300 flex items-center gap-0.5 transition-colors"
            >
              <span>Xem tất cả ({recentIdeas.length})</span>
              <ArrowRight size={13} />
            </button>
          )}
        </div>

        {recentIdeas.length === 0 ? (
          <div className="p-6 rounded-3xl bg-slate-900/40 border border-slate-800/80 text-center space-y-2">
            <Music size={24} className="mx-auto text-slate-600" />
            <p className="text-xs text-slate-400">Chưa có giai điệu nào được lưu giữ.</p>
            <p className="text-[11px] text-slate-500">
              Hãy nhấn &ldquo;Ghi lại cảm xúc&rdquo; khi có một giai điệu hay câu hát lóe lên!
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentIdeas.slice(0, 3).map((idea) => (
              <div
                key={idea.id}
                onClick={() => onOpenIdea(idea)}
                className="group p-3.5 rounded-2xl bg-slate-900/60 hover:bg-slate-800/70 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer flex items-center justify-between gap-3 active:scale-[0.99]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-300 flex items-center justify-center shrink-0 border border-purple-500/20 group-hover:scale-105 transition-transform">
                    <Music size={16} />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-slate-100 truncate group-hover:text-purple-300 transition-colors">
                      {idea.title}
                    </h4>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                      <span>{formatDateTime(idea.createdAt)}</span>
                      {idea.context && (
                        <>
                          <span>•</span>
                          <span className="text-purple-300/80">{idea.context}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-purple-300">
                    {formatDuration(idea.duration)}
                  </span>
                  {idea.favorite && (
                    <Heart size={14} className="fill-pink-500 text-pink-500" />
                  )}
                  <ArrowRight size={14} className="text-slate-500 group-hover:text-purple-400 transition-colors" />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Privacy Guarantee & Safari Tip */}
      <footer className="pt-2 text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
          <ShieldCheck size={13} className="text-emerald-400/80" />
          <span>Thu âm của bạn được lưu hoàn toàn trên thiết bị (IndexedDB).</span>
        </div>
        <div className="flex items-center justify-center gap-3 text-[10px] text-slate-500 flex-wrap">
          <button
            onClick={onOpenPwaGuide}
            className="hover:text-purple-400 underline decoration-slate-700 underline-offset-2 transition-colors"
          >
            Thêm BẮT LẤY vào màn hình chính iPhone
          </button>
          <span>•</span>
          {onOpenAiSettings && (
            <button
              onClick={onOpenAiSettings}
              className="hover:text-purple-400 underline decoration-slate-700 underline-offset-2 transition-colors"
            >
              Cài đặt Gemini AI (BYOK)
            </button>
          )}
        </div>
      </footer>
    </div>
  );
};
