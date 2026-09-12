import React, { useState, useEffect, useCallback } from 'react';
import { Wifi, Battery, Key } from 'lucide-react';
import { NavigationTab, AudioIdea } from './types';
import {
  getAllIdeas,
  saveIdea,
  deleteIdea,
  updateIdea,
  toggleFavorite,
} from './lib/db';
import { IPhoneFrame } from './components/IPhoneFrame';
import { BottomNav } from './components/BottomNav';
import { HomeScreen } from './components/HomeScreen';
import { LibraryScreen } from './components/LibraryScreen';
import { ProjectDetailView } from './components/ProjectDetailView';
import { InspirationScreen } from './components/InspirationScreen';
import { VoiceScreen } from './components/VoiceScreen';
import { RecordingView } from './components/RecordingView';
import { SafariGuideModal } from './components/SafariGuideModal';
import { AiSettingsModal } from './components/AiSettingsModal';
import { hasApiKeyConfigured } from './services/audioAnalysis/apiKeyStorage';

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavigationTab>('home');
  const [ideas, setIdeas] = useState<AudioIdea[]>([]);
  const [selectedIdea, setSelectedIdea] = useState<AudioIdea | null>(null);
  const [isRecordingOpen, setIsRecordingOpen] = useState<boolean>(false);
  const [isPwaGuideOpen, setIsPwaGuideOpen] = useState<boolean>(false);
  const [isAiSettingsOpen, setIsAiSettingsOpen] = useState<boolean>(false);
  const [isSimulatorMode, setIsSimulatorMode] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<string>('9:41');
  const [hasAiKey, setHasAiKey] = useState<boolean>(hasApiKeyConfigured());

  // Load all ideas from IndexedDB
  const refreshIdeas = useCallback(async () => {
    try {
      const list = await getAllIdeas();
      setIdeas(list);
    } catch (e) {
      console.warn('Could not load ideas from IndexedDB:', e);
    }
  }, []);

  useEffect(() => {
    refreshIdeas();
  }, [refreshIdeas]);

  // Reactive listener for API key changes
  useEffect(() => {
    const handleKeyChange = () => {
      setHasAiKey(hasApiKeyConfigured());
    };
    window.addEventListener('bat_lay_api_key_updated', handleKeyChange);
    return () => window.removeEventListener('bat_lay_api_key_updated', handleKeyChange);
  }, []);

  // Live status bar clock
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const h = now.getHours().toString().padStart(2, '0');
      const m = now.getMinutes().toString().padStart(2, '0');
      setCurrentTime(`${h}:${m}`);
    };
    updateClock();
    const timer = setInterval(updateClock, 30000);
    return () => clearInterval(timer);
  }, []);

  // Save new idea from recording session
  const handleSaveNewIdea = async (
    ideaData: Omit<AudioIdea, 'id'>,
    analyzeNow: boolean = false
  ) => {
    const newId = `idea_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const fullIdea: AudioIdea = {
      ...ideaData,
      id: newId,
    };

    await saveIdea(fullIdea);
    await refreshIdeas();
    setIsRecordingOpen(false);

    // If user tapped "Phân tích sau / Khám phá phát triển", open project detail directly
    if (analyzeNow) {
      setSelectedIdea(fullIdea);
    }
  };

  const handleRenameIdea = async (id: string, newTitle: string) => {
    const updated = await updateIdea(id, { title: newTitle });
    await refreshIdeas();
    if (selectedIdea && selectedIdea.id === id) {
      setSelectedIdea(updated);
    }
  };

  const handleToggleFav = async (id: string) => {
    const isFav = await toggleFavorite(id);
    await refreshIdeas();
    if (selectedIdea && selectedIdea.id === id) {
      setSelectedIdea({ ...selectedIdea, favorite: isFav });
    }
  };

  const handleDeleteIdea = async (id: string) => {
    await deleteIdea(id);
    await refreshIdeas();
    if (selectedIdea && selectedIdea.id === id) {
      setSelectedIdea(null);
    }
  };

  const handleUpdateIdeaData = async (id: string, updates: Partial<AudioIdea>): Promise<AudioIdea> => {
    const updated = await updateIdea(id, updates);
    await refreshIdeas();
    if (selectedIdea && selectedIdea.id === id) {
      setSelectedIdea(updated);
    }
    return updated;
  };

  return (
    <IPhoneFrame
      isSimulatorMode={isSimulatorMode}
      setIsSimulatorMode={setIsSimulatorMode}
    >
      <div className="flex-1 flex flex-col bg-[#070B14] text-slate-100 min-h-full relative select-none">
        {/* iOS Mobile Status Bar */}
        <header className="pt-safe px-6 py-2 flex items-center justify-between text-xs font-semibold text-slate-300 select-none bg-[#070B14]/80 backdrop-blur-md sticky top-0 z-30 border-b border-slate-900/60">
          <span className="tracking-tight text-white font-mono">{currentTime}</span>
          <div className="flex items-center gap-2 text-slate-400">
            <button
              onClick={() => setIsAiSettingsOpen(true)}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-md hover:bg-slate-800 transition-colors"
              title="Cài đặt Gemini AI (BYOK)"
              aria-label="Cài đặt Gemini AI"
            >
              <Key size={11} className={hasAiKey ? 'text-emerald-400' : 'text-slate-500'} />
              <span className={`text-[10px] font-mono ${hasAiKey ? 'text-emerald-300' : 'text-slate-500'}`}>
                {hasAiKey ? 'AI' : 'BYOK'}
              </span>
            </button>
            <Wifi size={13} className="text-slate-300" />
            <span className="text-[10px] font-mono tracking-tighter text-slate-300">5G</span>
            <Battery size={15} className="text-slate-200 fill-slate-200" />
          </div>
        </header>

        {/* Main Viewport Content */}
        <main className="flex-1 flex flex-col min-h-0 overflow-y-auto">
          {selectedIdea ? (
            <ProjectDetailView
              idea={selectedIdea}
              onBack={() => setSelectedIdea(null)}
              onUpdateIdea={handleUpdateIdeaData}
            />
          ) : currentTab === 'home' ? (
            <HomeScreen
              recentIdeas={ideas}
              onStartRecording={() => setIsRecordingOpen(true)}
              onOpenIdea={(idea) => setSelectedIdea(idea)}
              onViewAllLibrary={() => setCurrentTab('library')}
              onOpenPwaGuide={() => setIsPwaGuideOpen(true)}
              onOpenAiSettings={() => setIsAiSettingsOpen(true)}
            />
          ) : currentTab === 'library' ? (
            <LibraryScreen
              ideas={ideas}
              onOpenIdea={(idea) => setSelectedIdea(idea)}
              onRenameIdea={handleRenameIdea}
              onToggleFavorite={handleToggleFav}
              onDeleteIdea={handleDeleteIdea}
              onStartNewRecording={() => setIsRecordingOpen(true)}
            />
          ) : currentTab === 'inspiration' ? (
            <InspirationScreen />
          ) : (
            <VoiceScreen />
          )}
        </main>

        {/* Bottom Fixed Navigation (Hidden when in recording modal or viewing project detail) */}
        {!selectedIdea && (
          <BottomNav
            currentTab={currentTab}
            onSelectTab={(tab) => {
              setSelectedIdea(null);
              setCurrentTab(tab);
            }}
          />
        )}

        {/* Real Microphone Recording Screen (Only requested upon user clicking "Ghi lại cảm xúc") */}
        {isRecordingOpen && (
          <RecordingView
            onCancel={() => setIsRecordingOpen(false)}
            onSave={handleSaveNewIdea}
          />
        )}

        {/* Safari Add to Home Screen Modal */}
        <SafariGuideModal
          isOpen={isPwaGuideOpen}
          onClose={() => setIsPwaGuideOpen(false)}
        />

        {/* AI BYOK Settings Modal */}
        <AiSettingsModal
          isOpen={isAiSettingsOpen}
          onClose={() => setIsAiSettingsOpen(false)}
          onKeyChanged={() => setHasAiKey(hasApiKeyConfigured())}
        />
      </div>
    </IPhoneFrame>
  );
}
