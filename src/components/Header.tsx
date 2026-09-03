import React from 'react';
import { Cpu, Globe, Server, Database, Code, BookOpen, Sparkles } from 'lucide-react';

interface HeaderProps {
  activeTab: 'chat' | 'architecture' | 'codebase' | 'models' | 'memory';
  setActiveTab: (tab: 'chat' | 'architecture' | 'codebase' | 'models' | 'memory') => void;
  ollamaConnected: boolean;
  selectedModel: string;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  ollamaConnected,
  selectedModel,
}) => {
  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white font-bold text-xl">
              ⚡
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                  UZUNITED AI
                </span>
                <span className="text-[10px] uppercase font-bold tracking-widest bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded">
                  Local + Web Search
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Mustaqil Lokal LLM va Bepul Internet Qidiruv Platformasi
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800/80">
            <button
              id="nav-chat-tab"
              onClick={() => setActiveTab('chat')}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-all ${
                activeTab === 'chat'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Chatbot</span>
            </button>

            <button
              id="nav-arch-tab"
              onClick={() => setActiveTab('architecture')}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-all ${
                activeTab === 'architecture'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span className="hidden sm:inline">Arxitektura & Qo‘llanma</span>
              <span className="sm:hidden">Qo‘llanma</span>
            </button>

            <button
              id="nav-code-tab"
              onClick={() => setActiveTab('codebase')}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-all ${
                activeTab === 'codebase'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Code className="w-4 h-4" />
              <span className="hidden sm:inline">Python Kodlar (MVP)</span>
              <span className="sm:hidden">Kodlar</span>
            </button>

            <button
              id="nav-models-tab"
              onClick={() => setActiveTab('models')}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-all ${
                activeTab === 'models'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Cpu className="w-4 h-4" />
              <span className="hidden md:inline">Lokal Modellar</span>
              <span className="md:hidden">Modellar</span>
            </button>

            <button
              id="nav-memory-tab"
              onClick={() => setActiveTab('memory')}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-all ${
                activeTab === 'memory'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Database className="w-4 h-4" />
              <span className="hidden md:inline">Xotira & DB</span>
              <span className="md:hidden">Xotira</span>
            </button>
          </nav>

          {/* Engine indicator */}
          <div className="hidden lg:flex items-center gap-2">
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-slate-300 font-mono text-[11px]">
                {selectedModel}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
