// Tool invocation types from AI SDK
export interface ToolInvocation {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  state: 'partial-call' | 'call' | 'result';
  result?: unknown;
}

// Attachment type for AI SDK
export interface Attachment {
  name: string;
  contentType: string;
  url: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt?: Date | string;
  citations?: Citation[];
  completed?: boolean;
  startTime?: number; // Timestamp when the first chunk arrived
  endTime?: number; // Timestamp when the stream completed
  tps?: number; // Calculated tokens per second
  mediaData?: MediaData;
  weatherData?: any; // Placeholder for weather card data
  images?: ImageData[];
  attachments?: FileAttachment[];
  provider?: string;
  quotedText?: string;
  // AI SDK specific fields
  toolInvocations?: ToolInvocation[];
  experimental_attachments?: Attachment[];
}

// Citation type for Exa/Perplexity search results
export interface Citation {
  url: string;
  title?: string;
  snippet?: string;
  favicon?: string;
  id?: string;
}

export interface ImageData {
  mimeType: string;
  data: string;  // Base64 data for immediate display or URL for remote images
  url?: string | null;  // URL if the image is stored in Supabase, now allows null for compatibility
}

export interface FileAttachment {
  name: string;
  type: string; // MIME type
  data?: string; // Make data optional - might not exist for displayed user attachments
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

 

// New type for Movie/TV Show data from TMDB
export interface MediaData {
  mediaType: 'movie' | 'tv';
  id: number;
  title: string;
  overview: string | null;
  posterPath: string | null;
  releaseDate: string | null; // For movies (YYYY-MM-DD)
  firstAirDate: string | null; // For TV shows (YYYY-MM-DD)
  voteAverage: number | null;
  // Add fields for genres and cast
  genres?: Array<{ id: number; name: string }>;
  cast?: Array<{ id: number; name: string; character: string }>;
  runtime?: number | null; // Add runtime in minutes
} 