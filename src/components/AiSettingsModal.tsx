import React, { useState, useEffect } from 'react';
import {
  X,
  Key,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  Trash2,
  ExternalLink,
  Sparkles,
  Eye,
  EyeOff,
  Cpu,
  RefreshCw,
} from 'lucide-react';
import {
  getStoredApiKey,
  setStoredApiKey,
  removeStoredApiKey,
  testApiKeyConnection,
} from '../services/audioAnalysis/apiKeyStorage';

interface AiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeyChanged?: () => void;
}

export const AiSettingsModal: React.FC<AiSettingsModalProps> = ({
  isOpen,
  onClose,
  onKeyChanged,
}) => {
  const [apiKeyInput, setApiKeyInput] = useState<string>('');
  const [showKey, setShowKey] = useState<boolean>(false);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [savedSuccessMsg, setSavedSuccessMsg] = useState<string | null>(null);
  const [hasExistingKey, setHasExistingKey] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      const stored = getStoredApiKey();
      if (stored) {
        setApiKeyInput(stored);
        setHasExistingKey(true);
      } else {
        setApiKeyInput('');
        setHasExistingKey(false);
      }
      setTestResult(null);
      setSavedSuccessMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    const trimmed = apiKeyInput.trim();
    if (!trimmed) {
      removeStoredApiKey();
      setHasExistingKey(false);
      setSavedSuccessMsg('Đã xóa khóa khỏi thiết bị.');
      onKeyChanged?.();
      return;
    }

    try {
      setStoredApiKey(trimmed);
      setHasExistingKey(true);
      setSavedSuccessMsg('Đã lưu API Key vào bộ nhớ thiết bị thành công.');
      setTestResult(null);
      onKeyChanged?.();
      setTimeout(() => setSavedSuccessMsg(null), 3000);
    } catch (err: unknown) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : 'Không thể lưu khóa vào thiết bị.',
      });
    }
  };

  const handleTestConnection = async () => {
    const trimmed = apiKeyInput.trim();
    if (!trimmed) {
      setTestResult({
        success: false,
        message: 'Vui lòng nhập API Key trước khi kiểm tra.',
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    setSavedSuccessMsg(null);

    const result = await testApiKeyConnection(trimmed);
    setIsTesting(false);
    setTestResult(result);
  };

  const handleRemove = () => {
    removeStoredApiKey();
    setApiKeyInput('');
    setHasExistingKey(false);
    setTestResult(null);
    setSavedSuccessMsg('Đã xóa API Key khỏi thiết bị này.');
    onKeyChanged?.();
  };

  const maskKey = (key: string) => {
    if (key.length <= 8) return '••••••••';
    return `${key.slice(0, 4)}••••••••${key.slice(-4)}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-md rounded-3xl bg-[#0B1120] border border-slate-800 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/80 bg-slate-900/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
              <Key size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">Cài đặt Gemini AI (BYOK)</h2>
              <p className="text-[11px] text-slate-400">Bring Your Own Key cho ứng dụng cá nhân</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto no-scrollbar text-xs">
          {/* Status Banner */}
          <div
            className={`p-3 rounded-2xl border flex items-center justify-between gap-2 ${
              hasExistingKey
                ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-200'
                : 'bg-amber-950/30 border-amber-800/50 text-amber-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  hasExistingKey ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
              <span className="font-medium text-[11px]">
                {hasExistingKey
                  ? 'AI đã được kết nối (Gemini 3.6 Flash)'
                  : 'AI chưa được kết nối'}
              </span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-black/40 text-slate-300">
              Model: gemini-3.6-flash
            </span>
          </div>

          {/* API Key Input Section */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
              Google Gemini API Key
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full px-3.5 py-2.5 pr-10 rounded-2xl bg-slate-900 border border-slate-700/80 text-xs text-white placeholder:text-slate-600 focus:outline-hidden focus:border-purple-500 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                aria-label={showKey ? 'Ẩn khóa' : 'Hiện khóa'}
              >
                {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {hasExistingKey && (
              <p className="text-[10px] text-slate-500 font-mono">
                Đang lưu trên thiết bị: {maskKey(getStoredApiKey() || '')}
              </p>
            )}
          </div>

          {/* Action Buttons: Save, Test, Remove */}
          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <button
              onClick={handleSave}
              className="flex-1 py-2 px-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 active:scale-95 text-white font-semibold text-xs transition-all shadow-md shadow-purple-900/30 flex items-center justify-center gap-1.5"
            >
              <Key size={13} />
              <span>Lưu khóa</span>
            </button>

            <button
              onClick={handleTestConnection}
              disabled={isTesting || !apiKeyInput.trim()}
              className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-medium text-xs transition-all border border-slate-700 disabled:opacity-50 flex items-center gap-1.5"
            >
              {isTesting ? (
                <RefreshCw size={13} className="animate-spin text-purple-400" />
              ) : (
                <Sparkles size={13} className="text-amber-400" />
              )}
              <span>{isTesting ? 'Đang kiểm tra...' : 'Kiểm tra kết nối'}</span>
            </button>

            {hasExistingKey && (
              <button
                onClick={handleRemove}
                className="py-2 px-2.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 active:scale-95 text-rose-300 font-medium text-xs transition-all border border-rose-800/50 flex items-center gap-1"
                title="Xóa khóa khỏi thiết bị"
              >
                <Trash2 size={13} />
                <span>Xóa</span>
              </button>
            )}
          </div>

          {/* Feedback banners */}
          {savedSuccessMsg && (
            <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-[11px] flex items-center gap-2">
              <CheckCircle2 size={14} className="shrink-0" />
              <span>{savedSuccessMsg}</span>
            </div>
          )}

          {testResult && (
            <div
              className={`p-2.5 rounded-xl border text-[11px] flex items-start gap-2 ${
                testResult.success
                  ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-800/60 text-rose-300'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
              ) : (
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
              )}
              <span className="leading-snug">{testResult.message}</span>
            </div>
          )}

          {/* API Key Guidance & Restrictions Notice */}
          <div className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800/80 space-y-2 text-[11px] text-slate-300">
            <div className="flex items-center gap-1.5 text-purple-300 font-semibold">
              <Cpu size={13} />
              <span>Hướng dẫn & Khuyến nghị bảo mật API Key</span>
            </div>
            <ul className="space-y-1.5 text-[10.5px] text-slate-400 list-disc list-inside leading-relaxed">
              <li>
                <strong className="text-slate-200">Khuyến nghị tạo một key riêng:</strong> Bạn nên tạo một API Key riêng dành riêng cho BẮT LẤY tại{' '}
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-400 hover:underline inline-flex items-center gap-0.5"
                >
                  Google AI Studio <ExternalLink size={10} />
                </a>.
              </li>
              <li>
                <strong className="text-slate-200">Giới hạn API (API restriction):</strong> Trong Google Cloud Console, chỉ cho phép khóa truy cập dịch vụ <em>Generative Language API (Gemini API)</em>.
              </li>
              <li>
                <strong className="text-slate-200">Giới hạn Website Origin:</strong> Nếu cấu hình trên Google Cloud API Key, bạn có thể thiết lập HTTP Referrer giới hạn cho domain GitHub Pages cá nhân của bạn: <code className="text-purple-300 font-mono">phamhoanganhtuan03121988-cmd.github.io</code>.
              </li>
            </ul>
          </div>

          {/* Honest Security Disclaimer */}
          <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-[10.5px] text-slate-400 space-y-1">
            <div className="flex items-center gap-1.5 text-amber-400/90 font-medium">
              <ShieldAlert size={12} />
              <span>Lưu ý về quyền riêng tư & bảo mật:</span>
            </div>
            <p className="leading-relaxed">
              Khóa được lưu cục bộ trên thiết bị này (localStorage). Không lưu trong mã nguồn BẮT LẤY. Ứng dụng không sử dụng bất kỳ máy chủ trung gian nào.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-800/80 bg-slate-900/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
