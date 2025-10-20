import { Pinecone } from '@pinecone-database/pinecone';

// Initialize Pinecone client
let pineconeClient: Pinecone | null = null;

export const getPineconeClient = async () => {
  if (pineconeClient) {
    return pineconeClient;
  }

  const apiKey = process.env.PINECONE_API_KEY;

  if (!apiKey) {
    console.warn('PINECONE_API_KEY not set, vector memory disabled');
    return null;
  }

  try {
    pineconeClient = new Pinecone({
      apiKey,
    });

    console.log('Pinecone client initialized successfully');
    return pineconeClient;
  } catch (error) {
    console.error('Failed to initialize Pinecone:', error);
    return null;
  }
};

export const getOrCreateIndex = async () => {
  const client = await getPineconeClient();
  if (!client) return null;

  const indexName = process.env.PINECONE_INDEX_NAME || 'aylechat-memory';

  try {
    // Check if index exists
    const indexes = await client.listIndexes();
    const indexExists = indexes.indexes?.some((idx) => idx.name === indexName);

    if (!indexExists) {
      console.log(`Creating Pinecone index: ${indexName}`);

      // Create index with 1536 dimensions (OpenAI text-embedding-3-small)
      await client.createIndex({
        name: indexName,
        dimension: 1536,
        metric: 'cosine',
        spec: {
          serverless: {
            cloud: 'aws',
            region: 'us-east-1',
          },
        },
      });

      console.log('Index created successfully, waiting for initialization...');

      // Wait for index to be ready
      await new Promise(resolve => setTimeout(resolve, 10000));
    }

    return client.index(indexName);
  } catch (error) {
    console.error('Error getting/creating Pinecone index:', error);
    return null;
  }
};

export type EmbeddingResult = {
  embedding: number[];
  method: 'openai' | 'google' | 'fallback';
};

// Generate embeddings using OpenAI or Google
export async function generateEmbedding(text: string): Promise<number[] | null> {
  const result = await generateEmbeddingWithMethod(text);
  return result?.embedding || null;
}

// Generate embeddings with method tracking
export async function generateEmbeddingWithMethod(text: string): Promise<EmbeddingResult | null> {
  const openaiKey = process.env.OPENAI_API_KEY;
  const googleKey = process.env.GOOGLE_AI_API_KEY;

  // Try OpenAI first if available
  if (openaiKey) {
    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: text,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Using OpenAI embeddings');
        return { embedding: data.data[0].embedding, method: 'openai' };
      }
    } catch (error) {
      console.warn('OpenAI embedding failed:', error);
    }
  }

  // Try Google AI embedding API if available
  if (googleKey) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${googleKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'models/text-embedding-004',
            content: { parts: [{ text }] },
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const embedding = data.embedding?.values;
        if (embedding) {
          console.log(`✅ Using Google AI embeddings (${embedding.length}d → 1536d)`);
          // Google embeddings are 768 dimensions, pad to 1536 for Pinecone
          return { embedding: padEmbedding(embedding, 1536), method: 'google' };
        }
      }
    } catch (error) {
      console.warn('Google AI embedding failed:', error);
    }
  }

  // Fallback to simple embedding
  console.warn('All embedding APIs failed, using simple fallback...');
  return { embedding: generateSimpleEmbedding(text), method: 'fallback' };
}

// Pad embedding to target dimensions
function padEmbedding(embedding: number[], targetDim: number): number[] {
  if (embedding.length === targetDim) {
    return embedding;
  }

  if (embedding.length > targetDim) {
    // Truncate if larger
    return embedding.slice(0, targetDim);
  }

  // Pad with zeros if smaller
  const padded = [...embedding];
  while (padded.length < targetDim) {
    padded.push(0);
  }

  // Normalize after padding
  const magnitude = Math.sqrt(padded.reduce((sum, val) => sum + val * val, 0));
  return padded.map(val => val / (magnitude || 1));
}

// Simple embedding fallback (TF-IDF-like)
function generateSimpleEmbedding(text: string): number[] {
  const words = text.toLowerCase().split(/\s+/);
  const embedding = new Array(1536).fill(0);

  // Simple hash-based embedding
  words.forEach((word, idx) => {
    const hash = word.split('').reduce((acc, char) => {
      return ((acc << 5) - acc + char.charCodeAt(0)) | 0;
    }, 0);

    const index = Math.abs(hash) % 1536;
    embedding[index] += 1 / (idx + 1); // Weight by position
  });

  // Normalize
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map(val => val / (magnitude || 1));
}
