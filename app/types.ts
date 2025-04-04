export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: any[];
  completed?: boolean;
  images?: ImageData[];
  attachments?: FileAttachment[];
}

export interface ImageData {
  mimeType: string;
  data: string;  // Base64 data for immediate display or URL for remote images
  url?: string | null;  // URL if the image is stored in Supabase, now allows null for compatibility
}

export interface FileAttachment {
  name: string;
  type: string; // MIME type
  data: string; // Base64 encoded data
  url?: string; // Optional URL if stored remotely
  size: number; // File size in bytes
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