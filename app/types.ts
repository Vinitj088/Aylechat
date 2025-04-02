export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: any[];
  completed?: boolean;
  images?: ImageData[];
}

export interface ImageData {
  mimeType: string;
  data: string;
}

export interface Model {
  id: string;
  name: string;
  provider: string;
  providerId: string;
  avatarType?: string;
  enabled: boolean;
  toolCallType: string;
  searchMode?: boolean;
  imageGenerationMode?: boolean;
}

// Define model types
export type ModelType = 'exa' | string; 