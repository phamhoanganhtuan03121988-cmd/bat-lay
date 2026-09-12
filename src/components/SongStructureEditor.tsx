import React, { useState } from 'react';
import { Layers, Plus, Trash2, Edit3, Check, Music2, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { SongSection, SongSectionType } from '../types';

interface SongStructureEditorProps {
  sections: SongSection[];
  onChangeSections: (sections: SongSection[]) => void;
  harmonyChords?: string | null;
  arrangementDirection?: string | null;
  hookSuggestion?: string | null;
  onGenerateAiStructure?: () => void;
  isAiGenerating?: boolean;
}

const SECTION_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  'Intro': { bg: 'bg-slate-800/80', border: 'border-slate-700', text: 'text-slate-300' },
  'Verse 1': { bg: 'bg-blue-950/60', border: 'border-blue-800/60', text: 'text-blue-300' },
  'Pre-Chorus': { bg: 'bg-indigo-950/60', border: 'border-indigo-800/60', text: 'text-indigo-300' },
  'Chorus': { bg: 'bg-purple-950/70', border: 'border-purple-700/70', text: 'text-purple-200' },
  'Verse 2': { bg: 'bg-sky-950/60', border: 'border-sky-800/60', text: 'text-sky-300' },
  'Bridge': { bg: 'bg-amber-950/60', border: 'border-amber-800/60', text: 'text-amber-300' },
  'Final Chorus': { bg: 'bg-pink-950/70', border: 'border-pink-700/70', text: 'text-pink-200' },
  'Outro': { bg: 'bg-slate-800/80', border: 'border-slate-700', text: 'text-slate-300' },
  'Custom': { bg: 'bg-slate-900/80', border: 'border-slate-800', text: 'text-slate-300' },
};

export const SongStructureEditor: React.FC<SongStructureEditorProps> = ({
  sections,
  onChangeSections,
  harmonyChords,
  arrangementDirection,
  hookSuggestion,
  onGenerateAiStructure,
  isAiGenerating,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedChords, setExpandedChords] = useState<boolean>(true);

  const handleUpdateSection = (id: string, updates: Partial<SongSection>) => {
    const next = sections.map((s) => (s.id === id ? { ...s, ...updates } : s));
    onChangeSections(next);
  };

  const handleAddSection = (type: SongSectionType = 'Verse 2') => {
    const newSec: SongSection = {
      id: `sec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type,
      title: type === 'Custom' ? 'Đoạn mới' : type,
      content: '',
      chords: '',
      notes: '',
    };
    onChangeSections([...sections, newSec]);
    setEditingId(newSec.id);
  };

  const handleDeleteSection = (id: string) => {
    onChangeSections(sections.filter((s) => s.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === sections.length - 1)
    ) {
      return;
    }
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const next = [...sections];
    const temp = next[index];
    next[index] = next[targetIdx];
    next[targetIdx] = temp;
    onChangeSections(next);
  };

  return (
    <div className="p-4 rounded-3xl bg-[#0F172A]/80 border border-slate-800/80 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center">
            <Layers size={16} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Cấu Trúc Bài Hát (Song Structure)
            </h3>
            <p className="text-[10px] text-slate-400">
              Phân khúc Intro, Verse, Chorus, Bridge và hòa âm
            </p>
          </div>
        </div>

        {onGenerateAiStructure && (
          <button
            onClick={onGenerateAiStructure}
            disabled={isAiGenerating}
            className="px-2.5 py-1 rounded-xl bg-purple-600/80 hover:bg-purple-500 text-white text-[11px] font-semibold flex items-center gap-1 transition-all disabled:opacity-50"
          >
            <Sparkles size={12} className={isAiGenerating ? 'animate-spin' : ''} />
            <span>{isAiGenerating ? 'Đang tạo...' : 'Gợi ý cấu trúc'}</span>
          </button>
        )}
      </div>

      {/* Hook Suggestion Banner */}
      {hookSuggestion && (
        <div className="p-3 rounded-2xl bg-linear-to-r from-purple-950/50 to-pink-950/40 border border-purple-800/50 space-y-1">
          <span className="text-[10px] text-purple-300 font-bold uppercase tracking-wider flex items-center gap-1">
            <Sparkles size={11} className="text-pink-400" />
            Điểm nhấn / Câu Hook cốt lõi
          </span>
          <p className="text-xs text-white font-medium italic leading-relaxed">
            "{hookSuggestion}"
          </p>
        </div>
      )}

      {/* Harmony Chords & Arrangement summary (Collapsible) */}
      {(harmonyChords || arrangementDirection) && (
        <div className="rounded-2xl bg-slate-900/70 border border-slate-800 overflow-hidden text-xs">
          <button
            onClick={() => setExpandedChords(!expandedChords)}
            className="w-full p-3 flex items-center justify-between text-left hover:bg-slate-800/40 transition-colors"
          >
            <span className="font-semibold text-slate-300 flex items-center gap-1.5 text-[11px]">
              <Music2 size={13} className="text-blue-400" />
              <span>Hòa âm & Hướng phối khí</span>
            </span>
            {expandedChords ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
          </button>

          {expandedChords && (
            <div className="p-3 pt-0 space-y-2 border-t border-slate-800/60 mt-1">
              {harmonyChords && (
                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-400 uppercase font-mono">Vòng hợp âm tổng thể</span>
                  <p className="font-mono text-xs text-purple-300 bg-slate-950/70 p-2 rounded-xl border border-slate-800">
                    {harmonyChords}
                  </p>
                </div>
              )}
              {arrangementDirection && (
                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-400 uppercase font-mono">Gợi ý nhạc cụ & Phối khí</span>
                  <p className="text-[11px] text-slate-300 leading-relaxed bg-slate-950/40 p-2 rounded-xl border border-slate-800/60">
                    {arrangementDirection}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Sections List */}
      <div className="space-y-2.5">
        {sections.length === 0 ? (
          <div className="p-5 rounded-2xl bg-slate-900/40 border border-dashed border-slate-800 text-center space-y-2">
            <p className="text-xs text-slate-400">Chưa có phân đoạn cấu trúc bài hát.</p>
            <p className="text-[11px] text-slate-500">
              Nhấn "Gợi ý cấu trúc" để AI bố cục bài hát hoàn chỉnh hoặc thêm phân đoạn thủ công.
            </p>
            <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
              <button
                onClick={() => handleAddSection('Verse 1')}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium inline-flex items-center gap-1"
              >
                <Plus size={12} />
                <span>Thêm Verse 1</span>
              </button>
              <button
                onClick={() => handleAddSection('Chorus')}
                className="px-3 py-1.5 rounded-xl bg-purple-950 hover:bg-purple-900 text-purple-200 text-xs font-medium inline-flex items-center gap-1 border border-purple-800/60"
              >
                <Plus size={12} />
                <span>Thêm Chorus</span>
              </button>
            </div>
          </div>
        ) : (
          sections.map((section, idx) => {
            const isEditing = editingId === section.id;
            const style = SECTION_COLORS[section.type] || SECTION_COLORS['Custom'];

            return (
              <div
                key={section.id}
                className={`rounded-2xl border transition-all ${
                  isEditing
                    ? 'bg-slate-900 border-purple-500/60 shadow-lg'
                    : `${style.bg} ${style.border} hover:border-slate-700`
                } p-3.5 space-y-2`}
              >
                {/* Section Item Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-slate-500">{idx + 1}.</span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${style.border} ${style.text}`}
                    >
                      {section.title || section.type}
                    </span>
                    {section.chords && !isEditing && (
                      <span className="font-mono text-[10px] text-purple-300 bg-slate-950/60 px-2 py-0.5 rounded-md border border-slate-800">
                        {section.chords}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Move up / down */}
                    <button
                      onClick={() => handleMove(idx, 'up')}
                      disabled={idx === 0}
                      className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                      title="Di chuyển lên"
                      aria-label="Di chuyển lên"
                    >
                      <ChevronUp size={13} />
                    </button>
                    <button
                      onClick={() => handleMove(idx, 'down')}
                      disabled={idx === sections.length - 1}
                      className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                      title="Di chuyển xuống"
                      aria-label="Di chuyển xuống"
                    >
                      <ChevronDown size={13} />
                    </button>

                    {/* Toggle edit mode */}
                    <button
                      onClick={() => setEditingId(isEditing ? null : section.id)}
                      className="p-1 rounded-md hover:bg-slate-800 text-slate-300 transition-colors ml-1"
                      title={isEditing ? 'Xong' : 'Chỉnh sửa'}
                      aria-label={isEditing ? 'Xong' : 'Chỉnh sửa'}
                    >
                      {isEditing ? <Check size={14} className="text-emerald-400" /> : <Edit3 size={13} />}
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => handleDeleteSection(section.id)}
                      className="p-1 rounded-md hover:bg-rose-950/50 text-slate-400 hover:text-rose-400 transition-colors"
                      title="Xóa đoạn này"
                      aria-label="Xóa đoạn này"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Edit Form */}
                {isEditing ? (
                  <div className="space-y-2 pt-1">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400 uppercase font-mono block mb-1">
                          Loại phân đoạn
                        </label>
                        <select
                          value={section.type}
                          onChange={(e) => {
                            const val = e.target.value as SongSectionType;
                            handleUpdateSection(section.id, {
                              type: val,
                              title: val === 'Custom' ? section.title : val,
                            });
                          }}
                          className="w-full p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                        >
                          <option value="Intro">Intro (Mở đầu)</option>
                          <option value="Verse 1">Verse 1 (Khổ 1)</option>
                          <option value="Pre-Chorus">Pre-Chorus (Dẫn)</option>
                          <option value="Chorus">Chorus (Điệp khúc)</option>
                          <option value="Verse 2">Verse 2 (Khổ 2)</option>
                          <option value="Bridge">Bridge (Cầu nối)</option>
                          <option value="Final Chorus">Final Chorus (Điệp khúc cuối)</option>
                          <option value="Outro">Outro (Kết bài)</option>
                          <option value="Custom">Tự đặt tên...</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 uppercase font-mono block mb-1">
                          Hợp âm gợi ý
                        </label>
                        <input
                          type="text"
                          value={section.chords || ''}
                          onChange={(e) => handleUpdateSection(section.id, { chords: e.target.value })}
                          placeholder="vd: C - G - Am - F"
                          className="w-full p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-mono placeholder:text-slate-600"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 uppercase font-mono block mb-1">
                        Lời hát của đoạn
                      </label>
                      <textarea
                        rows={3}
                        value={section.content}
                        onChange={(e) => handleUpdateSection(section.id, { content: e.target.value })}
                        placeholder="Nhập câu hát cho đoạn này..."
                        className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder:text-slate-600 leading-relaxed"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 uppercase font-mono block mb-1">
                        Ghi chú biểu cảm / Cách hát
                      </label>
                      <input
                        type="text"
                        value={section.notes || ''}
                        onChange={(e) => handleUpdateSection(section.id, { notes: e.target.value })}
                        placeholder="vd: Hát thầm thì, dồn dập ở cuối câu..."
                        className="w-full p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder:text-slate-600"
                      />
                    </div>
                  </div>
                ) : (
                  /* Display mode */
                  <div className="space-y-1 pt-0.5">
                    {section.content ? (
                      <p className="text-xs text-slate-200 whitespace-pre-line leading-relaxed pl-1 border-l-2 border-slate-700/60">
                        {section.content}
                      </p>
                    ) : (
                      <p className="text-[11px] text-slate-500 italic pl-1">
                        Chưa có ca từ cho đoạn này. Nhấn biểu tượng bút để viết lời.
                      </p>
                    )}
                    {section.notes && (
                      <p className="text-[10px] text-slate-400 italic mt-1">
                        Ghi chú: {section.notes}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add quick section button bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-1 no-scrollbar text-xs">
        <span className="text-[10px] text-slate-500 font-mono shrink-0">Thêm nhanh:</span>
        <button
          onClick={() => handleAddSection('Verse 1')}
          className="px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-blue-300 text-[11px] border border-blue-900/60 shrink-0"
        >
          + Verse 1
        </button>
        <button
          onClick={() => handleAddSection('Pre-Chorus')}
          className="px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-indigo-300 text-[11px] border border-indigo-900/60 shrink-0"
        >
          + Pre-Chorus
        </button>
        <button
          onClick={() => handleAddSection('Chorus')}
          className="px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-purple-300 text-[11px] border border-purple-900/60 shrink-0"
        >
          + Chorus
        </button>
        <button
          onClick={() => handleAddSection('Bridge')}
          className="px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 text-[11px] border border-amber-900/60 shrink-0"
        >
          + Bridge
        </button>
        <button
          onClick={() => handleAddSection('Outro')}
          className="px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-[11px] border border-slate-700 shrink-0"
        >
          + Outro
        </button>
      </div>
    </div>
  );
};
