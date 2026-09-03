import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Search, 
  Globe, 
  Sparkles, 
  Layers, 
  ChevronDown, 
  ChevronUp, 
  ExternalLink, 
  Bot, 
  User, 
  RefreshCw,
  Clock,
  Compass,
  CheckCircle2,
  Cpu,
  Brain,
  MessageSquare
} from 'lucide-react';
import { marked } from 'marked';
import { ChatMessage, SourceItem } from '../types';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (text: string, isDeepSearch: boolean) => Promise<void>;
  isLoading: boolean;
  activeReasoningSteps: string[];
  onNewSession: () => void;
  selectedModel: string;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  messages,
  onSendMessage,
  isLoading,
  activeReasoningSteps,
  onNewSession,
  selectedModel,
}) => {
  const [input, setInput] = useState('');
  const [isDeepSearch, setIsDeepSearch] = useState(false);
  const [expandedReasoning, setExpandedReasoning] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, activeReasoningSteps]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    const text = input.trim();
    setInput('');
    onSendMessage(text, isDeepSearch);
  };

  const toggleReasoning = (msgId: string) => {
    setExpandedReasoning(prev => ({
      ...prev,
      [msgId]: !prev[msgId]
    }));
  };

  const quickPrompts = [
    { label: "🌤️ Ob-havo", prompt: "Bugun O'zbekistonda ob-havo qanday?" },
    { label: "👤 Shaxs haqida", prompt: "Sam Altman kim va OpenAI da nima ish qiladi?" },
    { label: "🔗 Kontekst testi", prompt: "U qachon tug'ilgan va qaysi loyihalarni boshqargan?" },
    { label: "💻 Python Kod", prompt: "Python da asinxron Web Scraper kodini yozib ber." },
    { label: "💰 Valyuta kursi", prompt: "Bugungi Markaziy Bank dollar kursi qancha?" },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-4.1rem)] max-w-5xl mx-auto w-full px-2 sm:px-4 py-3">
      {/* Top Bar / Mode Selection */}
      <div className="flex items-center justify-between py-2 px-3 bg-slate-900/60 border border-slate-800 rounded-xl mb-3 text-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsDeepSearch(!isDeepSearch)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all font-medium ${
              isDeepSearch 
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm' 
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Compass className={`w-3.5 h-3.5 ${isDeepSearch ? 'animate-spin' : ''}`} />
            <span>Deep Search {isDeepSearch ? '(Yoqilgan)' : '(O‘chiq)'}</span>
          </button>

          <span className="hidden sm:inline-flex text-slate-400 items-center gap-1">
            <Cpu className="w-3.5 h-3.5 text-blue-400" />
            Lokal AI: <strong className="text-slate-200">{selectedModel}</strong>
          </span>
        </div>

        <button
          onClick={onNewSession}
          className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors font-medium"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Yangi Suhbat</span>
        </button>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin scrollbar-thumb-slate-800">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          const hasSources = msg.sources && msg.sources.length > 0;
          const isExpanded = expandedReasoning[msg.id] ?? false;

          return (
            <div
              key={msg.id}
              className={`flex gap-3 max-w-[90%] sm:max-w-[85%] ${
                isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'
              }`}
            >
              {/* Avatar */}
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-semibold shadow-md ${
                  isUser
                    ? 'bg-blue-600 text-white'
                    : 'bg-gradient-to-tr from-slate-800 to-slate-700 text-cyan-400 border border-slate-700'
                }`}
              >
                {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              {/* Message Content */}
              <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                {/* User / Bot Name & Meta */}
                <div className={`flex items-center gap-2 text-[11px] text-slate-400 ${isUser ? 'justify-end' : ''}`}>
                  <span className="font-semibold text-slate-300">
                    {isUser ? 'Siz' : 'UZUNITED AI'}
                  </span>
                  {msg.searchedWeb && (
                    <span className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-[10px] font-medium">
                      <Globe className="w-2.5 h-2.5" /> Internetdan qidirildi
                    </span>
                  )}
                  {msg.resolvedQuery && (
                    <span className="hidden md:inline-flex text-[10px] text-slate-500 font-mono">
                      (Kontekst: {msg.resolvedQuery.slice(0, 25)}...)
                    </span>
                  )}
                </div>

                {/* Bubble */}
                <div
                  className={`p-3.5 sm:p-4 rounded-2xl text-sm leading-relaxed ${
                    isUser
                      ? 'bg-blue-600 text-white rounded-tr-none shadow-md shadow-blue-500/10'
                      : 'bg-slate-900 border border-slate-800/90 text-slate-100 rounded-tl-none shadow-md'
                  }`}
                >
                  {/* Reasoning accordion for Assistant */}
                  {!isUser && msg.reasoningSteps && msg.reasoningSteps.length > 0 && (
                    <div className="mb-3 bg-slate-950/70 border border-slate-800 rounded-xl overflow-hidden">
                      <button
                        onClick={() => toggleReasoning(msg.id)}
                        className="w-full flex items-center justify-between px-3 py-2 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 transition-colors"
                      >
                        <div className="flex items-center gap-2 font-mono">
                          <Brain className="w-3.5 h-3.5 text-blue-400" />
                          <span>AI Tahlili va Qidiruv bosqichlari ({msg.reasoningSteps.length})</span>
                        </div>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>

                      {isExpanded && (
                        <div className="p-3 border-t border-slate-800/80 bg-slate-950/90 text-[11px] font-mono text-slate-300 space-y-1.5">
                          {msg.reasoningSteps.map((step, idx) => (
                            <div key={idx} className="flex items-start gap-2">
                              <span className="text-blue-400 font-bold">›</span>
                              <span className="leading-snug">{step}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Main text formatted with Markdown */}
                  <div 
                    className="prose prose-invert prose-sm max-w-none break-words [&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:list-disc [&>ul]:ml-4 [&>pre]:bg-slate-950 [&>pre]:p-3 [&>pre]:rounded-lg [&>pre]:border [&>pre]:border-slate-800 [&>code]:bg-slate-800/80 [&>code]:px-1.5 [&>code]:py-0.5 [&>code]:rounded [&>code]:text-cyan-300"
                    dangerouslySetInnerHTML={{ __html: marked.parse(msg.content) as string }}
                  />

                  {/* Sources section */}
                  {hasSources && (
                    <div className="mt-4 pt-3 border-t border-slate-800">
                      <div className="text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Foydalanilgan manbalar ({msg.sources!.length}):</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {msg.sources!.map((s) => (
                          <a
                            key={s.id}
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group flex flex-col p-2.5 bg-slate-950/80 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 rounded-xl transition-all"
                          >
                            <div className="flex items-center justify-between text-xs font-semibold text-blue-400 group-hover:text-blue-300 line-clamp-1">
                              <span>[{s.id}] {s.title}</span>
                              <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-70 group-hover:opacity-100 ml-1" />
                            </div>
                            <p className="text-[11px] text-slate-400 line-clamp-2 mt-1">
                              {s.snippet}
                            </p>
                            <div className="mt-1.5 flex items-center gap-1 text-[10px] text-slate-500">
                              <span className="font-mono text-cyan-400/80">{s.domain}</span>
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Loading / Active Pipeline indicator */}
        {isLoading && (
          <div className="flex gap-3 max-w-[85%] mr-auto">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-slate-800 to-slate-700 text-cyan-400 border border-slate-700 flex items-center justify-center flex-shrink-0 shadow-md">
              <Bot className="w-4 h-4 animate-pulse" />
            </div>
            <div className="bg-slate-900 border border-slate-800 text-slate-200 p-4 rounded-2xl rounded-tl-none shadow-md w-full max-w-lg space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-blue-400">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>UZUNITED AI so‘rovingizni tahlil qilmoqda...</span>
              </div>

              {/* Real-time steps log */}
              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/90 text-xs font-mono space-y-1.5 text-slate-300">
                {activeReasoningSteps.length > 0 ? (
                  activeReasoningSteps.map((st, i) => (
                    <div key={i} className="flex items-start gap-2 text-slate-300">
                      <span className="text-emerald-400 font-bold">✓</span>
                      <span>{st}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-500 italic">
                    Kontekst tahlili va Web Search qidiruviga tayyorlanmoqda...
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestion Chips */}
      {messages.length <= 2 && !isLoading && (
        <div className="pt-2 pb-1">
          <div className="text-[11px] text-slate-400 mb-1.5 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>Sinab ko‘rish uchun namunaviy savollar:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {quickPrompts.map((item, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setInput(item.prompt);
                  inputRef.current?.focus();
                }}
                className="text-xs px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors flex items-center gap-1.5"
              >
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="pt-2">
        <div className="relative flex items-center bg-slate-900 border border-slate-800 focus-within:border-blue-500 rounded-2xl shadow-xl transition-all overflow-hidden p-1.5">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="UZUNITED AI ga savol bering (masalan: Bugungi yangiliklar, 'u kim', yoki Python kod)..."
            disabled={isLoading}
            className="w-full bg-transparent text-slate-100 placeholder-slate-500 px-3.5 py-2.5 text-sm focus:outline-none disabled:opacity-50"
          />

          <div className="flex items-center gap-1.5 pr-1">
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 text-white transition-all shadow-md flex items-center justify-center"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
        <p className="text-[10px] text-center text-slate-500 mt-1.5">
          UZUNITED AI erkin va lokal AI vositasi. Web Search ma‘lumotlari DuckDuckGo / Open Search orqali olinadi.
        </p>
      </form>
    </div>
  );
};
