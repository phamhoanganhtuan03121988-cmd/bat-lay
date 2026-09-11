import React, { useState } from 'react';
import { Sparkles, Music, Wand2, RefreshCw, Layers, Compass, CheckCircle2 } from 'lucide-react';

interface InspirationPrompt {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  badge: string;
  example: string;
}

export const InspirationScreen: React.FC = () => {
  const [activePrompt, setActivePrompt] = useState<InspirationPrompt | null>(null);

  const concepts: InspirationPrompt[] = [
    {
      id: 'melody',
      title: 'Phát triển giai điệu này',
      subtitle: 'Nối dài câu nhạc, thêm điệp khúc tương phản',
      description: 'Lấy câu ngân nga 4 ô nhịp của bạn và tự động sinh ra đoạn tiền điệp khúc (Pre-chorus) và cao trào tương xứng.',
      badge: 'Giai điệu',
      example: 'Từ câu: "Gió qua hiên nhà..." → Phát triển câu cao trào: "Bay vút lên trời cao cùng mây trắng..."',
    },
    {
      id: 'lyrics',
      title: 'Viết tiếp câu hát',
      subtitle: 'Gieo vần thơ, mở rộng hình ảnh ẩn dụ',
      description: 'Gợi ý các câu thơ tiếp theo ăn vần với câu hát bạn vừa thu âm, duy trì đúng mạch cảm xúc và cấu trúc thanh điệu tiếng Việt.',
      badge: 'Ca từ',
      example: 'Gợi ý vần "ai": ban mai, bờ vai, ngày mai, dở dang...',
    },
    {
      id: 'emotion',
      title: 'Đổi màu cảm xúc',
      subtitle: 'Chuyển đổi từ Trưởng sang Thứ hoặc ngược lại',
      description: 'Thử nghiệm nghe giai điệu vui vẻ của bạn dưới gam màu U buồn (Minor) hoặc biến một khúc ca trầm mặc thành điệu Swing ấm áp.',
      badge: 'Cảm xúc',
      example: 'C Major (Trong trẻo) ⇄ A Minor (Khắc khoải hoài niệm)',
    },
    {
      id: 'style',
      title: 'Thử một phong cách khác',
      subtitle: 'Acoustic, R&B, Lo-Fi, City Pop, Indie Folk',
      description: 'Ướm thử giai điệu thu âm mộc của bạn vào bộ gõ Lo-Fi ấm áp hay tiếng guitar Acoustic mộc mạc bên ánh nến.',
      badge: 'Phong cách',
      example: 'Nghe thử bản demo 10 giây với tiếng trống boom-bap nhẹ nhàng.',
    },
  ];

  const creativeExercises = [
    'Hát một câu nói bình thường với ngữ điệu ngẫu hứng nhất có thể.',
    'Nhắm mắt lại trong 10 giây, gõ nhịp ngón tay theo nhịp tim rồi cất tiếng ngân.',
    'Nhớ về một cơn mưa chiều bạn từng đứng đợi ai đó và ghi lại câu hát đầu tiên xuất hiện.',
  ];

  return (
    <div className="flex-1 flex flex-col px-5 py-6 max-w-md mx-auto w-full space-y-6 pb-28 text-slate-100">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-pink-500/20 text-pink-300 flex items-center justify-center">
            <Sparkles size={18} />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Không Gian Gợi Ý</h1>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          Nguồn cảm hứng giúp khơi thông dòng chảy âm nhạc và mở rộng từng ý nghĩ nhỏ bé.
        </p>
      </div>

      {/* Creative Exercise Box */}
      <div className="p-4 rounded-3xl bg-linear-to-br from-purple-950/60 via-slate-900 to-[#0F172A] border border-purple-800/40 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-widest text-purple-300 font-bold flex items-center gap-1.5">
            <Compass size={12} />
            <span>Thực hành sáng tác hôm nay</span>
          </span>
          <span className="text-[10px] text-pink-400 font-mono">Ngẫu hứng</span>
        </div>
        <p className="text-xs text-slate-200 leading-relaxed italic">
          &ldquo;{creativeExercises[0]}&rdquo;
        </p>
      </div>

      {/* Future Concepts List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-widest">
            Ý Tưởng Phát Triển Âm Nhạc
          </h2>
          <span className="text-[10px] text-slate-500 font-mono">Phiên bản tiếp theo</span>
        </div>

        <div className="space-y-3">
          {concepts.map((concept) => (
            <div
              key={concept.id}
              onClick={() => setActivePrompt(concept)}
              className="p-4 rounded-3xl bg-[#0F172A]/70 hover:bg-[#15203B]/80 border border-slate-800/80 transition-all cursor-pointer space-y-2 group shadow-xs active:scale-[0.99]"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-purple-300 px-2.5 py-0.5 rounded-full bg-purple-950/80 border border-purple-800/40">
                  {concept.badge}
                </span>
                <span className="text-[10px] font-medium text-slate-500 bg-slate-900 px-2 py-0.5 rounded-full border border-slate-800">
                  Sắp có
                </span>
              </div>

              <div>
                <h3 className="text-sm font-bold text-white group-hover:text-pink-300 transition-colors">
                  {concept.title}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">{concept.subtitle}</p>
              </div>

              <p className="text-[11px] text-slate-400/90 leading-relaxed line-clamp-2">
                {concept.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Concept Preview Modal */}
      {activePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-slate-900 border border-purple-900/50 rounded-3xl p-5 shadow-2xl space-y-4 text-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-purple-300 px-2 py-0.5 rounded-full bg-purple-950 border border-purple-800/50">
                {activePrompt.badge}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Tính năng sắp ra mắt</span>
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">{activePrompt.title}</h3>
              <p className="text-xs text-slate-300 leading-relaxed">{activePrompt.description}</p>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
              <span className="text-[10px] text-pink-400 font-semibold uppercase tracking-wider block">
                Ví dụ minh họa
              </span>
              <p className="text-xs text-slate-300 italic">{activePrompt.example}</p>
            </div>

            <button
              onClick={() => setActivePrompt(null)}
              className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 font-medium text-white text-xs transition-colors"
            >
              Đã hiểu
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
