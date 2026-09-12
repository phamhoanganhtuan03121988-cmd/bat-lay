import React, { useState } from 'react';
import {
  FileText,
  Lock,
  Sparkles,
  Save,
  RotateCcw,
  Check,
  Copy,
  PlusCircle,
  HelpCircle,
} from 'lucide-react';
import { LyricActionType } from '../services/audioAnalysis/types';

interface LyricDevelopmentEditorProps {
  originalLyric?: string | null;
  transcript?: string | null;
  inputType?: string;
  isAiConnected: boolean;
  developedLyric: string;
  onChangeDevelopedLyric: (text: string) => void;
  onSaveDevelopedLyric: () => Promise<void>;
  isSaving: boolean;
  onTriggerLyricAction: (action: LyricActionType, selectedText?: string) => Promise<string>;
  onOpenSettings: () => void;
}

export const LyricDevelopmentEditor: React.FC<LyricDevelopmentEditorProps> = ({
  originalLyric,
  transcript,
  inputType,
  isAiConnected,
  developedLyric,
  onChangeDevelopedLyric,
  onSaveDevelopedLyric,
  isSaving,
  onTriggerLyricAction,
  onOpenSettings,
}) => {
  const [activeTab, setActiveTab] = useState<'original' | 'developed'>('developed');
  const [selectedText, setSelectedText] = useState<string>('');
  const [activeActionLoading, setActiveActionLoading] = useState<LyricActionType | null>(null);
  const [aiGeneratedPreview, setAiGeneratedPreview] = useState<{
    action: LyricActionType;
    text: string;
  } | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  const handleSelectText = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    const start = target.selectionStart;
    const end = target.selectionEnd;
    if (start !== end) {
      setSelectedText(target.value.substring(start, end));
    } else {
      setSelectedText('');
    }
  };

  const handleRunAction = async (action: LyricActionType) => {
    if (!isAiConnected) {
      onOpenSettings();
      return;
    }

    setActiveActionLoading(action);
    setAiGeneratedPreview(null);
    try {
      const generated = await onTriggerLyricAction(action, selectedText || undefined);
      setAiGeneratedPreview({ action, text: generated });
    } catch (err) {
      console.error('Lyric action failed:', err);
    } finally {
      setActiveActionLoading(null);
    }
  };

  const handleApplyGenerated = (mode: 'append' | 'replace') => {
    if (!aiGeneratedPreview) return;

    if (mode === 'append') {
      const separator = developedLyric.trim() ? '\n\n' : '';
      onChangeDevelopedLyric(`${developedLyric.trim()}${separator}${aiGeneratedPreview.text}`);
    } else if (mode === 'replace' && selectedText) {
      const updated = developedLyric.replace(selectedText, aiGeneratedPreview.text);
      onChangeDevelopedLyric(updated);
    } else {
      onChangeDevelopedLyric(aiGeneratedPreview.text);
    }
    setAiGeneratedPreview(null);
    setSelectedText('');
  };

  const handleSave = async () => {
    await onSaveDevelopedLyric();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleCopyPreview = () => {
    if (aiGeneratedPreview) {
      navigator.clipboard.writeText(aiGeneratedPreview.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <div className="p-4 rounded-3xl bg-[#0F172A]/80 border border-slate-800/80 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-300 flex items-center justify-center">
            <FileText size={16} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Khắc Họa Ca Từ (Lyrics)
            </h3>
            <p className="text-[10px] text-slate-400">
              Bảo tồn câu hát gốc và phát triển bài hát hoàn chỉnh
            </p>
          </div>
        </div>

        {activeTab === 'developed' && (
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="py-1 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-medium flex items-center gap-1 transition-colors active:scale-95 disabled:opacity-50"
          >
            {saveSuccess ? (
              <>
                <Check size={12} className="text-emerald-300" />
                <span>Đã lưu!</span>
              </>
            ) : (
              <>
                <Save size={12} />
                <span>{isSaving ? 'Đang lưu...' : 'Lưu lời'}</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Two Tabs: "BẢN GỐC" and "PHIÊN BẢN PHÁT TRIỂN" */}
      <div className="flex p-1 bg-slate-900 rounded-xl border border-slate-800">
        <button
          onClick={() => setActiveTab('original')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'original'
              ? 'bg-slate-800 text-white shadow-xs'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          BẢN GỐC (BẢO TỒN)
        </button>
        <button
          onClick={() => setActiveTab('developed')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'developed'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          PHIÊN BẢN PHÁT TRIỂN
        </button>
      </div>

      {activeTab === 'original' ? (
        /* Tab 1: Original Lyric View (Strictly read-only & preserved) */
        <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5 font-medium text-emerald-400">
              <Lock size={12} />
              <span>Lời gốc được bảo tồn nguyên vẹn vĩnh viễn</span>
            </span>
            <span className="text-[10px] text-slate-500 font-mono">Chỉ đọc</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <p className="text-xs text-slate-100 whitespace-pre-line leading-relaxed italic font-serif">
              {originalLyric ||
                transcript ||
                (inputType === 'humming_melody'
                  ? 'Bản thu ngâm nga giai điệu không lời (Humming). BẮT LẤY ưu tiên phân tích cao độ và tiết tấu thay vì tự chế lời gốc.'
                  : inputType === 'spoken_idea'
                  ? 'Ý tưởng được thu âm bằng giọng nói. Bạn có thể tự do sáng tác lời ca tại tab Phiên Bản Phát Triển.'
                  : !isAiConnected
                  ? 'Bản ghi âm đã được lưu an toàn. Kết nối Gemini API (BYOK) để tự động nhận diện lời hát tiếng Việt chính xác.'
                  : 'Chưa phát hiện lời hát trong đoạn thu âm này.')}
            </p>
          </div>

          <p className="text-[10.5px] text-slate-500 leading-relaxed">
            Nguyên tắc cốt lõi của BẮT LẤY: Mọi thử nghiệm sáng tác ở tab phát triển sẽ không bao giờ làm mất câu hát ban đầu của bạn.
          </p>
        </div>
      ) : (
        /* Tab 2: Developed Lyrics Editor with AI Assistant buttons */
        <div className="space-y-3">
          {/* AI Actions Toolbar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10.5px]">
              <span className="text-purple-300 font-semibold flex items-center gap-1 font-mono uppercase tracking-wider">
                <Sparkles size={11} />
                Công cụ hỗ trợ viết lời (AI Lyric Actions)
              </span>
              {!isAiConnected && (
                <button
                  onClick={onOpenSettings}
                  className="text-amber-400 hover:underline text-[10px]"
                >
                  Cần gắn API Key
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {/* ✨ AI viết tiếp */}
              <button
                onClick={() => handleRunAction('continue')}
                disabled={activeActionLoading !== null}
                className="p-2 rounded-xl bg-slate-900/90 hover:bg-purple-950/70 border border-purple-900/50 text-purple-200 text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
              >
                <Sparkles size={12} className={activeActionLoading === 'continue' ? 'animate-spin text-purple-400' : 'text-purple-400'} />
                <span>{activeActionLoading === 'continue' ? 'Đang viết...' : '✨ AI viết tiếp'}</span>
              </button>

              {/* ✨ Viết lại đoạn này */}
              <button
                onClick={() => handleRunAction('rewrite')}
                disabled={activeActionLoading !== null}
                className="p-2 rounded-xl bg-slate-900/90 hover:bg-blue-950/70 border border-blue-900/50 text-blue-200 text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
                title={selectedText ? `Viết lại: "${selectedText.substring(0, 20)}..."` : 'Viết lại lời hiện tại'}
              >
                <RotateCcw size={12} className={activeActionLoading === 'rewrite' ? 'animate-spin text-blue-400' : 'text-blue-400'} />
                <span>{activeActionLoading === 'rewrite' ? 'Đang viết lại...' : selectedText ? '✨ Viết lại đoạn bôi' : '✨ Viết lại đoạn này'}</span>
              </button>

              {/* ✨ Thêm điệp khúc */}
              <button
                onClick={() => handleRunAction('add_chorus')}
                disabled={activeActionLoading !== null}
                className="p-2 rounded-xl bg-slate-900/90 hover:bg-pink-950/70 border border-pink-900/50 text-pink-200 text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
              >
                <Sparkles size={12} className={activeActionLoading === 'add_chorus' ? 'animate-spin text-pink-400' : 'text-pink-400'} />
                <span>{activeActionLoading === 'add_chorus' ? 'Đang sáng tác...' : '✨ Thêm điệp khúc'}</span>
              </button>

              {/* ✨ Viết Verse 2 */}
              <button
                onClick={() => handleRunAction('verse_2')}
                disabled={activeActionLoading !== null}
                className="p-2 rounded-xl bg-slate-900/90 hover:bg-indigo-950/70 border border-indigo-900/50 text-indigo-200 text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
              >
                <PlusCircle size={12} className={activeActionLoading === 'verse_2' ? 'animate-spin text-indigo-400' : 'text-indigo-400'} />
                <span>{activeActionLoading === 'verse_2' ? 'Đang viết...' : '✨ Viết Verse 2'}</span>
              </button>

              {/* ✨ Viết Bridge */}
              <button
                onClick={() => handleRunAction('bridge')}
                disabled={activeActionLoading !== null}
                className="p-2 rounded-xl bg-slate-900/90 hover:bg-amber-950/70 border border-amber-900/50 text-amber-200 text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 col-span-2 sm:col-span-1"
              >
                <Sparkles size={12} className={activeActionLoading === 'bridge' ? 'animate-spin text-amber-400' : 'text-amber-400'} />
                <span>{activeActionLoading === 'bridge' ? 'Đang viết...' : '✨ Viết Bridge'}</span>
              </button>
            </div>
          </div>

          {/* AI Result Preview Panel (if generated) */}
          {aiGeneratedPreview && (
            <div className="p-3.5 rounded-2xl bg-linear-to-b from-purple-950/50 to-slate-900/90 border border-purple-600/50 space-y-2 shadow-xl animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-purple-300 flex items-center gap-1">
                  <Sparkles size={12} className="text-pink-400" />
                  Gợi ý ca từ vừa tạo ({aiGeneratedPreview.action}):
                </span>
                <button
                  onClick={handleCopyPreview}
                  className="p-1 text-slate-400 hover:text-white transition-colors"
                  title="Sao chép"
                  aria-label="Sao chép"
                >
                  {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                </button>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950/80 border border-purple-900/40 text-xs text-white whitespace-pre-line leading-relaxed font-serif">
                {aiGeneratedPreview.text}
              </div>

              <div className="flex items-center justify-end gap-2 pt-1 text-xs">
                <button
                  onClick={() => setAiGeneratedPreview(null)}
                  className="px-2.5 py-1 text-slate-400 hover:text-white transition-colors text-[11px]"
                >
                  Bỏ qua
                </button>
                {selectedText && aiGeneratedPreview.action === 'rewrite' && (
                  <button
                    onClick={() => handleApplyGenerated('replace')}
                    className="px-3 py-1 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-[11px] transition-colors"
                  >
                    Thay thế đoạn bôi
                  </button>
                )}
                <button
                  onClick={() => handleApplyGenerated('append')}
                  className="px-3 py-1 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-[11px] transition-colors flex items-center gap-1"
                >
                  <Check size={12} />
                  <span>Chèn vào lời bài hát</span>
                </button>
              </div>
            </div>
          )}

          {/* Lyrics Textarea */}
          <div className="space-y-1.5">
            <textarea
              rows={6}
              value={developedLyric}
              onChange={(e) => onChangeDevelopedLyric(e.target.value)}
              onSelect={handleSelectText}
              placeholder="Bản thảo lời ca phát triển... Bạn có thể tự do gõ, sửa, hoặc dùng các nút AI bên trên để hỗ trợ viết tiếp, thêm điệp khúc, bridge."
              className="w-full p-3 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-hidden focus:border-purple-500 leading-relaxed font-sans"
            />
            <div className="flex items-center justify-between text-[10px] text-slate-500">
              <span>Bôi đen một câu trong ô để dùng tính năng "✨ Viết lại đoạn này"</span>
              <span>{developedLyric.length} ký tự</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
