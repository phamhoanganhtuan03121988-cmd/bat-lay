import React from 'react';
import { Smartphone, Monitor } from 'lucide-react';

interface IPhoneFrameProps {
  children: React.ReactNode;
  isSimulatorMode: boolean;
  setIsSimulatorMode: (val: boolean) => void;
}

export const IPhoneFrame: React.FC<IPhoneFrameProps> = ({
  children,
  isSimulatorMode,
  setIsSimulatorMode,
}) => {
  return (
    <div className="min-h-[100dvh] bg-[#03060C] text-slate-100 flex flex-col items-center justify-start sm:p-4 md:p-6 transition-colors">
      {/* Desktop Toolbar (visible only on desktop screens) */}
      <div className="hidden sm:flex items-center justify-between w-full max-w-md mb-3 px-3 py-1.5 bg-slate-900/90 border border-slate-800 rounded-full backdrop-blur-md text-xs">
        <div className="flex items-center gap-2 text-slate-300 font-medium">
          <span className="w-2 h-2 rounded-full bg-pink-400 animate-pulse"></span>
          <span className="font-semibold tracking-wide">BẮT LẤY • iPhone Safari</span>
        </div>
        <div className="flex items-center gap-1 bg-slate-950/80 rounded-full p-0.5 border border-slate-800">
          <button
            id="view-iphone-btn"
            onClick={() => setIsSimulatorMode(true)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
              isSimulatorMode
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="iPhone Viewport Frame"
          >
            <Smartphone size={12} />
            <span>Khung iPhone</span>
          </button>
          <button
            id="view-fluid-btn"
            onClick={() => setIsSimulatorMode(false)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
              !isSimulatorMode
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Fluid Web Viewport"
          >
            <Monitor size={12} />
            <span>Màn hình rộng</span>
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div
        className={`w-full transition-all duration-300 ${
          isSimulatorMode
            ? 'max-w-[420px] rounded-[50px] border-[10px] border-[#182030] shadow-2xl shadow-purple-950/40 overflow-hidden bg-[#070B14] min-h-[852px] relative flex flex-col'
            : 'max-w-xl bg-[#070B14] sm:rounded-3xl border border-slate-800/80 shadow-2xl overflow-hidden min-h-[100dvh] sm:min-h-0 flex flex-col'
        }`}
      >
        {/* Dynamic Island Notch (Only in Simulator Mode on Desktop) */}
        {isSimulatorMode && (
          <div className="hidden sm:flex justify-center pt-3 pb-1 bg-[#070B14] z-50 select-none">
            <div className="w-28 h-6 bg-black rounded-full flex items-center justify-between px-2.5 shadow-inner border border-slate-900">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-950 border border-slate-800"></div>
              <div className="w-2 h-2 rounded-full bg-blue-950/80"></div>
            </div>
          </div>
        )}

        {/* Inner Content Body */}
        <div className="flex-1 flex flex-col w-full h-full min-h-0 overflow-y-auto">
          {children}
        </div>

        {/* Home Indicator Bar (Simulated on desktop iPhone mode) */}
        {isSimulatorMode && (
          <div className="hidden sm:flex justify-center py-2 bg-[#070B14] select-none">
            <div className="w-32 h-1 bg-slate-700/60 rounded-full"></div>
          </div>
        )}
      </div>
    </div>
  );
};
