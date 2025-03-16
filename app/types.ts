export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: any[];
}

export interface Model {
  id: string;
  name: string;
  provider: string;
  providerId: string;
  enabled: boolean;
  toolCallType: string;
  searchMode?: boolean;
}

// Define model types
export type ModelType = 'exa' | string; 