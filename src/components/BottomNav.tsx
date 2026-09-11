import React from 'react';
import { Home, Music2, Sparkles, Mic2 } from 'lucide-react';
import { NavigationTab } from '../types';

interface BottomNavProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onSelectTab }) => {
  const tabs: { id: NavigationTab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'home',
      label: 'Bắt lấy',
      icon: <Home size={20} />,
    },
    {
      id: 'library',
      label: 'Thư viện',
      icon: <Music2 size={20} />,
    },
    {
      id: 'inspiration',
      label: 'Gợi ý',
      icon: <Sparkles size={20} />,
    },
    {
      id: 'voice',
      label: 'Giọng của tôi',
      icon: <Mic2 size={20} />,
    },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-[#070B14]/90 backdrop-blur-xl border-t border-slate-900/80 pb-safe transition-all select-none"
      aria-label="Thanh điều hướng ứng dụng"
    >
      <div className="max-w-md mx-auto flex items-center justify-around px-2 py-2">
        {tabs.map((tab) => {
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`flex-1 flex flex-col items-center justify-center py-1.5 px-2 rounded-2xl transition-all duration-200 active:scale-95 ${
                isActive
                  ? 'text-purple-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div
                className={`relative flex items-center justify-center p-1 rounded-xl transition-all ${
                  isActive
                    ? 'bg-purple-500/20 text-purple-300 shadow-sm shadow-purple-500/20'
                    : ''
                }`}
              >
                {tab.icon}
                {isActive && (
                  <span className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-pink-400 shadow-xs shadow-pink-400" />
                )}
              </div>
              <span
                className={`text-[11px] mt-1 font-medium transition-all ${
                  isActive ? 'font-semibold text-white' : 'text-slate-400'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
