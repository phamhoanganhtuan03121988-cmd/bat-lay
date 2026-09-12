import React, { useMemo } from 'react';
import { Music, Activity, TrendingUp, Sparkles, Award } from 'lucide-react';
import { MelodyAnalysisData } from '../types';

interface MelodyVisualizerProps {
  melodyData?: MelodyAnalysisData | null;
  bpm?: number | null;
  musicalKey?: string | null;
  melodyDescription?: string | null;
  melodyAiDevelopment?: string | null;
}

export const MelodyVisualizer: React.FC<MelodyVisualizerProps> = ({
  melodyData,
  bpm,
  musicalKey,
  melodyDescription,
  melodyAiDevelopment,
}) => {
  // If no pitch points or less than 4 points, display real notice (no fake simulation!)
  const hasValidMelody = Boolean(melodyData && melodyData.pitchPoints && melodyData.pitchPoints.length >= 4);

  // Normalize points for SVG path
  const svgPath = useMemo(() => {
    if (!hasValidMelody || !melodyData) return '';

    const pts = melodyData.pitchPoints;
    const minTime = pts[0]?.time ?? 0;
    const maxTime = Math.max(minTime + 0.1, pts[pts.length - 1]?.time ?? 1);
    const minHz = melodyData.minHz;
    const maxHz = Math.max(minHz + 10, melodyData.maxHz);

    const width = 340;
    const height = 90;
    const paddingY = 12;
    const paddingX = 14;

    const coords = pts.map((p) => {
      const x = paddingX + ((p.time - minTime) / (maxTime - minTime)) * (width - paddingX * 2);
      // Invert Y because higher Hz is higher in pitch
      const y = height - paddingY - ((p.hz - minHz) / (maxHz - minHz)) * (height - paddingY * 2);
      return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)), note: p.noteName };
    });

    if (coords.length < 2) return '';

    // Build SVG curve
    let d = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 1; i < coords.length; i++) {
      const prev = coords[i - 1];
      const curr = coords[i];
      const midX = (prev.x + curr.x) / 2;
      d += ` Q ${prev.x} ${prev.y}, ${midX} ${(prev.y + curr.y) / 2} T ${curr.x} ${curr.y}`;
    }
    return d;
  }, [hasValidMelody, melodyData]);

  return (
    <div className="p-4 rounded-3xl bg-[#0F172A]/80 border border-slate-800/80 space-y-4">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center">
            <Music size={16} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Phác Thảo Giai Điệu (Melody Contour)
            </h3>
            <p className="text-[10px] text-slate-400">
              Đo đạc đường nét cao độ và điểm nhấn từ bản thu
            </p>
          </div>
        </div>

        {hasValidMelody && (
          <span className="px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-800/60 text-[10px] text-emerald-300 font-mono flex items-center gap-1">
            <Activity size={10} />
            DSP Chuẩn
          </span>
        )}
      </div>

      {hasValidMelody && melodyData ? (
        <div className="space-y-3">
          {/* Visual pitch curve canvas */}
          <div className="relative p-3 rounded-2xl bg-slate-950/80 border border-slate-800 overflow-hidden">
            {/* Top Stats Ribbon */}
            <div className="flex items-center justify-between text-[11px] mb-2 font-mono">
              <span className="text-slate-400 flex items-center gap-1">
                <TrendingUp size={12} className="text-emerald-400" />
                <span>
                  {melodyData.contour === 'ascending'
                    ? 'Xu hướng: Vút lên cao'
                    : melodyData.contour === 'descending'
                    ? 'Xu hướng: Lắng dần'
                    : 'Xu hướng: Lượn sóng'}
                </span>
              </span>

              {melodyData.peakNote && (
                <span className="text-emerald-300 font-bold flex items-center gap-1 bg-emerald-950/50 px-2 py-0.5 rounded-md border border-emerald-800/50">
                  <Award size={11} className="text-amber-400" />
                  Nốt đỉnh: {melodyData.peakNote} ({melodyData.peakHz}Hz)
                </span>
              )}
            </div>

            {/* SVG Contour Line */}
            <svg viewBox="0 0 340 90" className="w-full h-24 overflow-visible">
              <defs>
                <linearGradient id="melodyGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#10B981" />
                  <stop offset="50%" stopColor="#3B82F6" />
                  <stop offset="100%" stopColor="#A855F7" />
                </linearGradient>
                <linearGradient id="areaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#10B981" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Grid guide lines */}
              <line x1="14" y1="20" x2="326" y2="20" stroke="#1e293b" strokeDasharray="3 3" />
              <line x1="14" y1="50" x2="326" y2="50" stroke="#1e293b" strokeDasharray="3 3" />
              <line x1="14" y1="80" x2="326" y2="80" stroke="#1e293b" strokeDasharray="3 3" />

              {/* Filled area below path */}
              {svgPath && (
                <path
                  d={`${svgPath} L 326 85 L 14 85 Z`}
                  fill="url(#areaGrad)"
                />
              )}

              {/* Main Curve */}
              {svgPath && (
                <path
                  d={svgPath}
                  fill="none"
                  stroke="url(#melodyGrad)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Pitch dots */}
              {melodyData.pitchPoints.map((p, idx) => {
                if (idx % Math.max(1, Math.floor(melodyData.pitchPoints.length / 8)) !== 0) return null;
                const minTime = melodyData.pitchPoints[0]?.time ?? 0;
                const maxTime = Math.max(minTime + 0.1, melodyData.pitchPoints[melodyData.pitchPoints.length - 1]?.time ?? 1);
                const minHz = melodyData.minHz;
                const maxHz = Math.max(minHz + 10, melodyData.maxHz);
                const cx = 14 + ((p.time - minTime) / (maxTime - minTime)) * (340 - 28);
                const cy = 90 - 12 - ((p.hz - minHz) / (maxHz - minHz)) * (90 - 24);

                return (
                  <g key={idx}>
                    <circle cx={cx} cy={cy} r="3" fill="#A855F7" stroke="#0F172A" strokeWidth="1.5" />
                    <text
                      x={cx}
                      y={Math.max(12, cy - 6)}
                      fontSize="9"
                      fill="#CBD5E1"
                      textAnchor="middle"
                      className="font-mono select-none"
                    >
                      {p.noteName}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Bottom time & pitch range labels */}
            <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono mt-1 pt-1 border-t border-slate-900">
              <span>Đáy: {melodyData.minHz}Hz</span>
              <span>Độ rộng: {melodyData.pitchRangeSemitones} bán âm</span>
              <span>Đỉnh: {melodyData.maxHz}Hz</span>
            </div>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-0.5">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Tông giọng & Nhịp</span>
              <p className="text-white font-medium text-[11px]">
                {musicalKey || 'Tự do'} • {bpm ? `${bpm} BPM` : 'Nhịp tự do'}
              </p>
            </div>
            <div className="p-2.5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-0.5">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Đoạn ngân nổi bật</span>
              <p className="text-white font-medium text-[11px]">
                {melodyData.sustainedRuns > 0 ? `${melodyData.sustainedRuns} trường đoạn ngân rõ` : 'Tiết tấu liền mạch'}
              </p>
            </div>
          </div>

          {/* Melody Description */}
          {melodyDescription && (
            <div className="p-2.5 rounded-2xl bg-slate-900/50 border border-slate-800 text-[11px] text-slate-300 leading-relaxed">
              <span className="text-emerald-400 font-semibold block text-[10px] uppercase mb-0.5">
                Nhận xét đường nét
              </span>
              {melodyDescription}
            </div>
          )}

          {/* AI Melody Development Suggestion if available */}
          {melodyAiDevelopment && (
            <div className="p-3 rounded-2xl bg-purple-950/30 border border-purple-800/40 text-[11px] space-y-1">
              <span className="text-purple-300 font-semibold flex items-center gap-1 text-[10.5px]">
                <Sparkles size={11} />
                Gợi ý phát triển giai điệu từ Gemini
              </span>
              <p className="text-slate-200 leading-relaxed">{melodyAiDevelopment}</p>
            </div>
          )}
        </div>
      ) : (
        /* Truthful DSP notice when melody is not enough to construct contour */
        <div className="p-4 rounded-2xl bg-slate-900/50 border border-dashed border-slate-800 text-center space-y-2 text-xs">
          <p className="text-slate-300 font-medium">Chưa đủ dữ liệu để dựng melody contour.</p>
          <p className="text-[11px] text-slate-500 leading-relaxed max-w-xs mx-auto">
            Bản thu cần có các nốt ngân giai điệu rõ ràng (humming hoặc tiếng hát) với thời lượng đủ dài để bộ xử lý DSP trích xuất đường cong cao độ chính xác.
          </p>
        </div>
      )}
    </div>
  );
};
