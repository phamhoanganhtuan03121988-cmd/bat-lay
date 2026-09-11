import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Share, PlusSquare, Compass, Shield, Sparkles } from 'lucide-react';

interface SafariGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SafariGuideModal: React.FC<SafariGuideModalProps> = ({ isOpen, onClose }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xs">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0"
          />

          {/* Action Sheet / Modal */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="relative w-full max-w-md bg-[#0F172A] border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl z-10 max-h-[85vh] overflow-y-auto text-slate-100"
          >
            {/* Grab handle for iOS sheet */}
            <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto mb-4 sm:hidden" />

            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-300 flex items-center justify-center">
                  <Compass size={16} />
                </div>
                <h2 className="text-sm font-bold text-white">Thêm BẮT LẤY vào màn hình chính iPhone</h2>
              </div>
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
                aria-label="Đóng"
              >
                <X size={15} />
              </button>
            </div>

            <div className="py-4 space-y-3.5 text-xs text-slate-300">
              <p className="leading-relaxed">
                Để có trải nghiệm ghi âm tức thời toàn màn hình như một ứng dụng độc lập trên iPhone Safari:
              </p>

              <div className="space-y-2.5">
                <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-900/80 border border-slate-800">
                  <div className="w-6 h-6 rounded-md bg-blue-600/30 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Share size={13} />
                  </div>
                  <div>
                    <span className="font-semibold text-white block">1. Nhấn nút Chia sẻ (Share)</span>
                    <span className="text-slate-400">Ở thanh công cụ phía dưới cùng của trình duyệt Safari.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-900/80 border border-slate-800">
                  <div className="w-6 h-6 rounded-md bg-purple-600/30 text-purple-400 flex items-center justify-center shrink-0 mt-0.5">
                    <PlusSquare size={13} />
                  </div>
                  <div>
                    <span className="font-semibold text-white block">2. Chọn &ldquo;Thêm vào MH chính&rdquo;</span>
                    <span className="text-slate-400">Cuộn xuống và chọn &ldquo;Add to Home Screen&rdquo;.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-900/80 border border-slate-800">
                  <div className="w-6 h-6 rounded-md bg-pink-600/30 text-pink-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles size={13} />
                  </div>
                  <div>
                    <span className="font-semibold text-white block">3. Mở BẮT LẤY mọi lúc</span>
                    <span className="text-slate-400">Ứng dụng sẽ khởi chạy toàn màn hình, không có thanh địa chỉ Safari, lưu trữ offline qua IndexedDB.</span>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-purple-950/40 border border-purple-800/40 flex items-center gap-2.5 text-purple-200">
                <Shield size={16} className="text-purple-400 shrink-0" />
                <span>Hoàn toàn riêng tư: Không yêu cầu tài khoản, dữ liệu âm thanh ở lại trên máy bạn.</span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 font-semibold text-white text-xs transition-colors shadow-md shadow-purple-900/30"
            >
              Đã hiểu
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
