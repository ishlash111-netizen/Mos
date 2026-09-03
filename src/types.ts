export interface SourceItem {
  id: number;
  title: string;
  url: string;
  snippet: string;
  domain: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  sources?: SourceItem[];
  reasoningSteps?: string[];
  resolvedQuery?: string;
  searchedWeb?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  lastEntity?: string | null;
}

export interface IntentInfo {
  needsWeb: boolean;
  reason: string;
  keywords: string[];
}

export interface PythonFileItem {
  filename: string;
  path: string;
  category: 'Backend' | 'Agent Core' | 'Web Search' | 'Database' | 'Frontend' | 'Config';
  description: string;
  content: string;
}

export interface LocalModelInfo {
  name: string;
  tag: string;
  size: string;
  ramNeeded: string;
  speed: string;
  uzbekQuality: string;
  useCase: string;
  installCommand: string;
  recommended: boolean;
}
