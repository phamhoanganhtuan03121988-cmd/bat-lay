import React from 'react';
import { Mic2, ShieldCheck, Sparkles, Volume2, UserCheck, Lock } from 'lucide-react';

export const VoiceScreen: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col px-5 py-6 max-w-md mx-auto w-full space-y-6 pb-28 text-slate-100">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center">
            <Mic2 size={18} />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Giọng Của Tôi</h1>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          Đây sẽ là nơi lưu giọng hát của bạn cho những phiên bản bài hát sau này.
        </p>
      </div>

      {/* Main AI Singing Voice Card */}
      <div className="p-5 rounded-3xl bg-linear-to-br from-[#0F172A] via-slate-900 to-purple-950/40 border border-purple-900/30 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-linear-to-tr from-pink-500/20 to-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300">
              <Mic2 size={20} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">AI Singing Voice</h2>
              <p className="text-[11px] text-slate-400">Giọng hát tổng hợp cá nhân hóa</p>
            </div>
          </div>

          <span className="px-3 py-1 rounded-full bg-purple-950/80 border border-purple-800/60 text-purple-300 text-[11px] font-semibold">
            Sắp có
          </span>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          Trong tương lai, BẮT LẤY sẽ hỗ trợ tạo mô hình biểu diễn giọng hát từ các bản ngân nga mộc của chính bạn, giúp bạn hát thử các bài hát hoàn chỉnh mà không cần phòng thu chuyên nghiệp.
        </p>

        {/* Feature Teasers */}
        <div className="space-y-2 pt-1 text-xs">
          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/60 border border-slate-800">
            <span className="text-slate-300">Âm sắc tự nhiên (Timbre)</span>
            <span className="text-[11px] text-slate-500 font-mono">Bảo tồn chất giọng</span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/60 border border-slate-800">
            <span className="text-slate-300">Tự động bắt đúng cao độ</span>
            <span className="text-[11px] text-slate-500 font-mono">Auto Pitch Alignment</span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/60 border border-slate-800">
            <span className="text-slate-300">Hát bè & Hợp xướng (Harmonies)</span>
            <span className="text-[11px] text-slate-500 font-mono">Đa bè tự động</span>
          </div>
        </div>
      </div>

      {/* Privacy & Ethical Reassurance */}
      <div className="p-4 rounded-3xl bg-slate-900/40 border border-slate-800/80 space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-white">
          <Lock size={14} className="text-emerald-400" />
          <span>Cam kết bảo mật sinh trắc học giọng nói</span>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Giọng hát là chữ ký tâm hồn và bản sắc cá nhân duy nhất. BẮT LẤY cam kết không thương mại hóa, không chia sẻ và không tải mẫu giọng của bạn lên bất kỳ máy chủ bên ngoài nào khi chưa có sự đồng ý rõ ràng.
        </p>
      </div>
    </div>
  );
};
