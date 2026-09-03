import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { ChatInterface } from './components/ChatInterface';
import { ArchitectureViewer } from './components/ArchitectureViewer';
import { CodebaseExplorer } from './components/CodebaseExplorer';
import { LocalLLMComparison } from './components/LocalLLMComparison';
import { MemoryInspector } from './components/MemoryInspector';
import { ChatMessage, ChatSession } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<'chat' | 'architecture' | 'codebase' | 'models' | 'memory'>('chat');
  const [sessionId, setSessionId] = useState<string>('default-uzunited-session');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-0',
      role: 'assistant',
      content: "Assalomu alaykum! Men **UZUNITED AI** — mustaqil, lokal AI model va erkin Web Search integratsiyasiga ega aqlli assistentman.\n\nMenga har qanday savol berishingiz mumkin: umumiy suhbat, dasturlash kodlari, yoki hozirgi kun yangiliklari va real-time ma'lumotlarni qidirish. Oldingi suhbat kontekstini va «u», «bu», «birinchisi» kabi olmoshlarni eslab qolaman!",
      timestamp: new Date().toISOString(),
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeReasoningSteps, setActiveReasoningSteps] = useState<string[]>([]);
  const [ollamaConnected, setOllamaConnected] = useState(false);
  const [selectedModel, setSelectedModel] = useState('Llama 3.2 (3B) / Local Agent');
  const [sessions, setSessions] = useState<ChatSession[]>([]);

  // Initial check
  useEffect(() => {
    fetch('/api/health')
      .then(res => res.json())
      .then(data => {
        if (data.status === 'ok') {
          console.log('UZUNITED AI server online');
        }
      })
      .catch(() => {});
  }, []);

  const handleSendMessage = async (text: string, isDeepSearch: boolean) => {
    const userMsgId = `msg-${Date.now()}-u`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);
    setActiveReasoningSteps([
      `1. Savol qabul qilindi: "${text}"`,
      `2. Kontekst va olmoshlar («u», «bu») tekshirilmoqda...`
    ]);

    try {
      const executeRequest = async (isRetry = false): Promise<any> => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 20000);

          const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId,
              message: text,
              isDeepSearch,
            }),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (!res.ok) {
            const errJson = await res.json().catch(() => ({}));
            throw new Error(errJson.error || `Server xatosi (${res.status})`);
          }

          return await res.json();
        } catch (fetchErr: any) {
          if (!isRetry && (fetchErr.name === 'AbortError' || fetchErr.message?.includes('fetch') || fetchErr.name === 'TypeError')) {
            // Wait 600ms and retry once
            await new Promise(r => setTimeout(r, 600));
            return executeRequest(true);
          }
          throw fetchErr;
        }
      };

      const data = await executeRequest();
      
      if (data.reasoningSteps) {
        setActiveReasoningSteps(data.reasoningSteps);
      }

      if (data.assistantMessage) {
        setMessages(prev => [...prev, data.assistantMessage]);
      }
    } catch (err: any) {
      console.warn('Chat request notice:', err);
      const isAbort = err.name === 'AbortError' || err.message?.includes('aborted');
      const errorMsg: ChatMessage = {
        id: `msg-${Date.now()}-err`,
        role: 'assistant',
        content: isAbort 
          ? "⚠️ So'rov vaqti tugadi (server band bo'lishi mumkin). Iltimos, qaytadan yuboring." 
          : `⚠️ Xabar yetkazishda vaqtinchalik uzilish yuz berdi: ${err.message || "Aloqa uzildi."}. Qaytadan urinib ko'ring.`,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewSession = async () => {
    try {
      const res = await fetch('/api/memory/new-session', { method: 'POST' });
      const data = await res.json();
      if (data.session) {
        setSessionId(data.session.id);
        setMessages(data.session.messages);
        setActiveReasoningSteps([]);
      }
    } catch (e) {
      setSessionId(`session-${Date.now()}`);
      setMessages([
        {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: 'Yangi suhbat boshlandi! Savolingizni berishingiz mumkin.',
          timestamp: new Date().toISOString(),
        }
      ]);
    }
  };

  const handleClearSession = () => {
    handleNewSession();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        ollamaConnected={ollamaConnected}
        selectedModel={selectedModel}
      />

      {/* Main Container */}
      <main className="flex-1 flex flex-col">
        {activeTab === 'chat' && (
          <ChatInterface
            messages={messages}
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            activeReasoningSteps={activeReasoningSteps}
            onNewSession={handleNewSession}
            selectedModel={selectedModel}
          />
        )}

        {activeTab === 'architecture' && (
          <ArchitectureViewer />
        )}

        {activeTab === 'codebase' && (
          <CodebaseExplorer />
        )}

        {activeTab === 'models' && (
          <LocalLLMComparison />
        )}

        {activeTab === 'memory' && (
          <MemoryInspector
            sessions={sessions}
            currentSessionId={sessionId}
            messages={messages}
            onClearSession={handleClearSession}
          />
        )}
      </main>
    </div>
  );
}
