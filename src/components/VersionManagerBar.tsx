import React, { useState } from 'react';
import { History, Plus, Check, ChevronDown, BookmarkCheck, Sparkles } from 'lucide-react';
import { ProjectVersion, ProjectStatus } from '../types';
import { formatDateTime } from '../lib/formatters';

interface VersionManagerBarProps {
  versions: ProjectVersion[];
  activeVersionId?: string;
  status: ProjectStatus;
  onSwitchVersion: (versionId: string) => void;
  onCreateSnapshot: (name: string, note?: string) => Promise<void>;
  onChangeStatus: (status: ProjectStatus) => void;
}

export const VersionManagerBar: React.FC<VersionManagerBarProps> = ({
  versions,
  activeVersionId,
  status,
  onSwitchVersion,
  onCreateSnapshot,
  onChangeStatus,
}) => {
  const [isOpenMenu, setIsOpenMenu] = useState<boolean>(false);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [snapshotName, setSnapshotName] = useState<string>('');
  const [snapshotNote, setSnapshotNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const activeVersion = versions.find((v) => v.id === activeVersionId);

  const handleSaveSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!snapshotName.trim()) return;
    setIsSubmitting(true);
    try {
      await onCreateSnapshot(snapshotName.trim(), snapshotNote.trim() || undefined);
      setSnapshotName('');
      setSnapshotNote('');
      setIsCreating(false);
      setIsOpenMenu(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (st: ProjectStatus) => {
    switch (st) {
      case 'completed':
        return { label: 'Đã hoàn thiện', color: 'bg-emerald-950/80 text-emerald-300 border-emerald-800/80' };
      case 'in_progress':
        return { label: 'Đang phát triển', color: 'bg-blue-950/80 text-blue-300 border-blue-800/80' };
      default:
        return { label: 'Bản nháp', color: 'bg-slate-800/80 text-slate-300 border-slate-700' };
    }
  };

  const statusBadge = getStatusBadge(status);

  return (
    <div className="p-3 rounded-2xl bg-[#0F172A]/90 border border-slate-800/80 shadow-md space-y-2">
      {/* Top Bar: Active Version & Status Selector */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-purple-300 font-semibold">
            <History size={14} />
            <span>Phiên bản:</span>
          </div>

          {/* Version Dropdown Button */}
          <button
            onClick={() => setIsOpenMenu(!isOpenMenu)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium border border-slate-700 transition-colors"
          >
            <span>{activeVersion?.name || 'V1 (Ý tưởng gốc)'}</span>
            <ChevronDown size={13} className={`text-slate-400 transition-transform ${isOpenMenu ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Project Status Selector */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10.5px] text-slate-400 hidden sm:inline">Trạng thái:</span>
          <select
            value={status}
            onChange={(e) => onChangeStatus(e.target.value as ProjectStatus)}
            className={`text-[11px] font-medium px-2.5 py-1 rounded-xl border ${statusBadge.color} bg-transparent cursor-pointer focus:outline-hidden`}
          >
            <option value="draft" className="bg-slate-900 text-slate-300">Bản nháp</option>
            <option value="in_progress" className="bg-slate-900 text-blue-300">Đang phát triển</option>
            <option value="completed" className="bg-slate-900 text-emerald-300">Đã hoàn thiện</option>
          </select>
        </div>
      </div>

      {/* Expanded Version Menu & Snapshot Creator */}
      {isOpenMenu && (
        <div className="pt-2 border-t border-slate-800 space-y-3 animate-in fade-in duration-150 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase text-slate-400">
              Lịch sử phiên bản ({versions.length + 1})
            </span>
            <button
              onClick={() => {
                setIsCreating(!isCreating);
                setSnapshotName(`Phiên bản V${versions.length + 2}`);
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-purple-600/80 hover:bg-purple-600 text-white text-[11px] font-semibold transition-colors"
            >
              <Plus size={12} />
              <span>Lưu snapshot mới</span>
            </button>
          </div>

          {/* New Snapshot Form */}
          {isCreating && (
            <form onSubmit={handleSaveSnapshot} className="p-3 rounded-2xl bg-slate-950/90 border border-purple-800/60 space-y-2">
              <span className="text-[11px] font-bold text-purple-300 block">
                Tạo bản lưu giữ (Snapshot)
              </span>
              <input
                type="text"
                value={snapshotName}
                onChange={(e) => setSnapshotName(e.target.value)}
                placeholder="Tên phiên bản (vd: V2 - Thêm Chorus, V3 - Bản Acoustic)"
                className="w-full p-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white"
                required
              />
              <input
                type="text"
                value={snapshotNote}
                onChange={(e) => setSnapshotNote(e.target.value)}
                placeholder="Ghi chú thêm (tùy chọn)..."
                className="w-full p-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder:text-slate-500"
              />
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-3 py-1 rounded-xl text-slate-400 hover:text-white"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-3.5 py-1 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold flex items-center gap-1"
                >
                  <BookmarkCheck size={13} />
                  <span>{isSubmitting ? 'Đang lưu...' : 'Lưu phiên bản'}</span>
                </button>
              </div>
            </form>
          )}

          {/* Versions List */}
          <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
            {/* Original Snapshot */}
            <button
              onClick={() => {
                onSwitchVersion('original');
                setIsOpenMenu(false);
              }}
              className={`w-full p-2 rounded-xl flex items-center justify-between text-left transition-colors ${
                !activeVersionId || activeVersionId === 'original'
                  ? 'bg-purple-950/60 border border-purple-800/60 text-purple-200'
                  : 'bg-slate-900/60 hover:bg-slate-800 text-slate-300'
              }`}
            >
              <div>
                <span className="font-semibold text-xs block">V1 - Ý tưởng gốc</span>
                <span className="text-[10px] text-slate-500">Bản ghi âm & cảm xúc ban đầu (Bảo tồn vĩnh viễn)</span>
              </div>
              {(!activeVersionId || activeVersionId === 'original') && (
                <Check size={14} className="text-purple-400" />
              )}
            </button>

            {/* Custom Snapshots */}
            {versions.map((ver) => {
              const isSelected = activeVersionId === ver.id;
              return (
                <button
                  key={ver.id}
                  onClick={() => {
                    onSwitchVersion(ver.id);
                    setIsOpenMenu(false);
                  }}
                  className={`w-full p-2 rounded-xl flex items-center justify-between text-left transition-colors ${
                    isSelected
                      ? 'bg-purple-950/60 border border-purple-800/60 text-purple-200'
                      : 'bg-slate-900/60 hover:bg-slate-800 text-slate-300'
                  }`}
                >
                  <div>
                    <span className="font-semibold text-xs block">{ver.name}</span>
                    <span className="text-[10px] text-slate-500">
                      {formatDateTime(ver.createdAt)} {ver.note ? `• ${ver.note}` : ''}
                    </span>
                  </div>
                  {isSelected && <Check size={14} className="text-purple-400" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
