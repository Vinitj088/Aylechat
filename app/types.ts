// Remove the old Message interface
// export interface Message {
//   id: string;
//   role: 'user' | 'assistant';
//   content: string;
//   citations?: any[];
//   completed?: boolean;
//   images?: ImageData[];
// }

// Keep ImageData if used elsewhere (e.g., for Gemini image results)
export interface ImageData {
  mimeType: string;
  data: string;  // Base64 data for immediate display or URL for remote images
  url?: string | null;  // URL if the image is stored in Supabase, now allows null for compatibility
}

// Keep Model interface
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