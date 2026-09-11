import React, { useState } from 'react';
import {
  Music2,
  Heart,
  Trash2,
  Edit2,
  ExternalLink,
  Search,
  Filter,
  AlertTriangle,
  Play,
  Calendar,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { AudioIdea } from '../types';
import { formatDateTime, formatDuration } from '../lib/formatters';
import { AudioPlayer } from './AudioPlayer';

interface LibraryScreenProps {
  ideas: AudioIdea[];
  onOpenIdea: (idea: AudioIdea) => void;
  onRenameIdea: (id: string, newTitle: string) => Promise<void>;
  onToggleFavorite: (id: string) => Promise<void>;
  onDeleteIdea: (id: string) => Promise<void>;
  onStartNewRecording: () => void;
}

export const LibraryScreen: React.FC<LibraryScreenProps> = ({
  ideas,
  onOpenIdea,
  onRenameIdea,
  onToggleFavorite,
  onDeleteIdea,
  onStartNewRecording,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterFavorite, setFilterFavorite] = useState<boolean>(false);

  // Rename modal state
  const [editingIdea, setEditingIdea] = useState<AudioIdea | null>(null);
  const [newTitle, setNewTitle] = useState<string>('');

  // Delete confirmation modal state
  const [deletingIdea, setDeletingIdea] = useState<AudioIdea | null>(null);

  const filteredIdeas = ideas.filter((idea) => {
    const matchesSearch = idea.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFav = filterFavorite ? idea.favorite : true;
    return matchesSearch && matchesFav;
  });

  const handleOpenRename = (idea: AudioIdea, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingIdea(idea);
    setNewTitle(idea.title);
  };

  const handleSaveRename = async () => {
    if (!editingIdea || !newTitle.trim()) return;
    await onRenameIdea(editingIdea.id, newTitle.trim());
    setEditingIdea(null);
  };

  const handleOpenDelete = (idea: AudioIdea, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingIdea(idea);
  };

  const handleConfirmDelete = async () => {
    if (!deletingIdea) return;
    await onDeleteIdea(deletingIdea.id);
    setDeletingIdea(null);
  };

  return (
    <div className="flex-1 flex flex-col px-5 py-6 max-w-md mx-auto w-full space-y-5 pb-28">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center">
              <Music2 size={18} />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">Thư Viện Ý Tưởng</h1>
          </div>
          <span className="text-xs font-mono text-purple-300 bg-purple-950/60 px-2.5 py-1 rounded-full border border-purple-800/60">
            {ideas.length} bản ghi
          </span>
        </div>
        <p className="text-xs text-slate-400">
          Nơi lưu giữ mọi giai điệu thoáng qua bạn từng bắt lấy.
        </p>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên ý tưởng..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-hidden focus:border-purple-500 transition-colors"
          />
        </div>
        <button
          onClick={() => setFilterFavorite(!filterFavorite)}
          className={`px-3 py-2 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-all ${
            filterFavorite
              ? 'bg-pink-600 text-white border-pink-500 shadow-sm shadow-pink-900/40'
              : 'bg-slate-900/80 text-slate-400 hover:text-white border-slate-800'
          }`}
          title="Lọc mục yêu thích"
        >
          <Heart size={14} className={filterFavorite ? 'fill-white' : ''} />
          <span>Yêu thích</span>
        </button>
      </div>

      {/* Ideas Card List */}
      <div className="space-y-4">
        {filteredIdeas.length === 0 ? (
          <div className="p-8 rounded-3xl bg-slate-900/40 border border-slate-800/80 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mx-auto">
              <Music2 size={22} />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-white">
                {ideas.length === 0
                  ? 'Chưa có bản ghi âm nào'
                  : 'Không tìm thấy ý tưởng phù hợp'}
              </p>
              <p className="text-[11px] text-slate-400 italic">
                {ideas.length === 0
                  ? 'Những giai điệu chưa được gọi tên sẽ bắt đầu từ đây.'
                  : 'Hãy thử tìm bằng từ khóa khác hoặc tắt bộ lọc.'}
              </p>
            </div>
            {ideas.length === 0 && (
              <button
                onClick={onStartNewRecording}
                className="mt-2 py-2 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium transition-colors inline-flex items-center gap-1.5"
              >
                <Sparkles size={13} />
                <span>Ghi lại ý tưởng đầu tiên</span>
              </button>
            )}
          </div>
        ) : (
          filteredIdeas.map((idea) => (
            <div
              key={idea.id}
              className="p-4 rounded-3xl bg-[#0F172A]/80 border border-slate-800/80 shadow-md space-y-3 transition-all hover:border-slate-700"
            >
              {/* Card Top: Title & Actions */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3
                    onClick={() => onOpenIdea(idea)}
                    className="text-sm font-bold text-white hover:text-purple-300 transition-colors cursor-pointer truncate"
                  >
                    {idea.title}
                  </h3>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                    <span className="flex items-center gap-1">
                      <Calendar size={11} />
                      {formatDateTime(idea.createdAt)}
                    </span>
                    {idea.context && (
                      <>
                        <span>•</span>
                        <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] text-purple-300">
                          {idea.context}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Card Action icons */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(idea.id);
                    }}
                    className={`p-1.5 rounded-lg transition-colors ${
                      idea.favorite
                        ? 'text-pink-400 hover:text-pink-300'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                    title={idea.favorite ? 'Bỏ thích' : 'Yêu thích'}
                  >
                    <Heart size={16} className={idea.favorite ? 'fill-pink-400' : ''} />
                  </button>

                  <button
                    onClick={(e) => handleOpenRename(idea, e)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 transition-colors"
                    title="Đổi tên"
                  >
                    <Edit2 size={15} />
                  </button>

                  <button
                    onClick={(e) => handleOpenDelete(idea, e)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 transition-colors"
                    title="Xóa ý tưởng"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {/* Real Audio Player with Waveform Scrubber */}
              <AudioPlayer
                blob={idea.audioBlob}
                waveform={idea.waveformData}
                duration={idea.duration}
              />

              {/* Bottom Quick Open Button */}
              <div className="flex items-center justify-between pt-1 text-xs">
                <span className="text-[11px] text-slate-500 font-mono">
                  {idea.analysisStatus === 'completed' ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <Sparkles size={11} /> Đã phân tích
                    </span>
                  ) : (
                    'Ý tưởng gốc'
                  )}
                </span>
                <button
                  onClick={() => onOpenIdea(idea)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-400 hover:text-purple-300 transition-colors"
                >
                  <span>Mở chi tiết & phát triển</span>
                  <ArrowRight size={12} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Rename Dialog Modal */}
      {editingIdea && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-700/80 rounded-3xl p-5 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-white">Đổi tên ý tưởng</h3>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-hidden focus:border-purple-500"
              autoFocus
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setEditingIdea(null)}
                className="py-2 px-3 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:text-white"
              >
                Hủy
              </button>
              <button
                onClick={handleSaveRename}
                className="py-2 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold"
              >
                Lưu tên mới
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal (Rule 8: Deleting must require confirmation) */}
      {deletingIdea && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-slate-900 border border-rose-900/50 rounded-3xl p-5 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center mx-auto">
              <AlertTriangle size={24} />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-sm font-bold text-white">Xác nhận xóa ý tưởng?</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Bạn có chắc chắn muốn xóa <strong className="text-white">&ldquo;{deletingIdea.title}&rdquo;</strong>?
                Hành động này không thể hoàn tác, bản thu âm sẽ bị xóa vĩnh viễn khỏi thiết bị.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setDeletingIdea(null)}
                className="flex-1 py-2.5 px-3 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:text-white"
              >
                Giữ lại
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-md shadow-rose-900/40"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
