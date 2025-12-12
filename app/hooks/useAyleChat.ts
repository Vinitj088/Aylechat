'use client';

import { useChat, Message as AIMessage } from '@ai-sdk/react';
import { useCallback, useRef, useEffect, useState, useMemo } from 'react';
import { db } from '@/lib/db';
import { id } from '@instantdb/react';
import { Message, MediaData } from '../types';

interface UseAyleChatOptions {
  threadId?: string | null;
  userId?: string | null;
  selectedModel: string;
  initialMessages?: Message[];
  onThreadCreated?: (threadId: string) => void;
}

interface Citation {
  url: string;
  title?: string;
  snippet?: string;
  favicon?: string;
  id?: string;
}

// Convert AI SDK message to our Message type
function convertToAppMessage(msg: AIMessage, extra?: Partial<Message>): Message {
  return {
    id: msg.id,
    role: msg.role as 'user' | 'assistant' | 'system',
    content: msg.content,
    createdAt: msg.createdAt ? new Date(msg.createdAt) : new Date(),
    completed: true,
    ...extra,
  };
}

// Convert our Message type to AI SDK format
function convertToAIMessage(msg: Message): AIMessage {
  return {
    id: msg.id,
    role: msg.role,
    content: msg.content,
    createdAt: msg.createdAt instanceof Date
      ? msg.createdAt
      : msg.createdAt
        ? new Date(msg.createdAt)
        : undefined,
  };
}

// Helper to convert File to data URL
async function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function useAyleChat({
  threadId: initialThreadId,
  userId,
  selectedModel,
  initialMessages = [],
  onThreadCreated,
}: UseAyleChatOptions) {
  // Generate a new ID each time the hook is called with no threadId
  // This ensures a fresh thread when navigating to homepage
  const [chatKey, setChatKey] = useState(() => initialThreadId || id());
  const isNewThread = useRef(!initialThreadId);
  const currentThreadId = useRef(chatKey);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [mediaData, setMediaData] = useState<MediaData | null>(null);
  const [weatherData, setWeatherData] = useState<any>(null);
  const startTimeRef = useRef<number | null>(null);

  // Store initial message extras (citations, mediaData, etc.) by message ID
  const initialMessageExtrasRef = useRef<Map<string, Partial<Message>>>(new Map());

  // Populate extras from initial messages
  useEffect(() => {
    const extras = new Map<string, Partial<Message>>();
    for (const msg of initialMessages) {
      if (msg.citations || msg.mediaData || msg.weatherData || msg.tps || msg.startTime || msg.endTime || msg.quotedText || msg.attachments || msg.images) {
        extras.set(msg.id, {
          citations: msg.citations,
          mediaData: msg.mediaData,
          weatherData: msg.weatherData,
          tps: msg.tps,
          startTime: msg.startTime,
          endTime: msg.endTime,
          quotedText: msg.quotedText,
          attachments: msg.attachments,
          images: msg.images,
          provider: msg.provider,
        });
      }
    }
    initialMessageExtrasRef.current = extras;
  }, [initialMessages]);

  // Update refs when chatKey changes
  useEffect(() => {
    currentThreadId.current = chatKey;
    isNewThread.current = !initialThreadId;
  }, [chatKey, initialThreadId]);

  // Determine API endpoint based on model
  const apiEndpoint = selectedModel === 'exa' ? '/api/chat/exa' : '/api/chat';

  // Track whether we've done the initial sync for this thread
  // This prevents DB live query updates from re-syncing messages after user sends a new message
  const initializedChatKeyRef = useRef<string | null>(null);
  const hasInitialSyncRef = useRef(false);

  // Reset sync tracking when navigating to a different thread
  if (initializedChatKeyRef.current !== chatKey) {
    initializedChatKeyRef.current = chatKey;
    hasInitialSyncRef.current = false;
  }

  const chat = useChat({
    api: apiEndpoint,
    id: chatKey, // Use chatKey for chat state isolation - ensures fresh state on new chats
    streamProtocol: 'data', // Use data stream protocol for streaming
    body: {
      model: selectedModel,
    },
    // Don't pass initialMessages - we'll sync via setMessages to have better control
    initialMessages: [],
    // Experimental: Keep the last message while streaming for smoother updates
    experimental_throttle: 50, // Throttle updates to reduce re-renders

    onResponse: (response) => {
      // Track when streaming starts
      startTimeRef.current = Date.now();
      // Check for streaming headers
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('text/plain')) {
        console.log('[Streaming] Started with data stream');
      }
    },

    onFinish: async (message) => {
      if (!userId) return;

      const endTime = Date.now();
      const startTime = startTimeRef.current || endTime;
      const durationSeconds = (endTime - startTime) / 1000;
      const estimatedTokens = message.content.length / 4;
      const tps = durationSeconds > 0 ? estimatedTokens / durationSeconds : 0;

      // Persist assistant message to InstantDB
      const msgId = id();
      try {
        await db.transact([
          db.tx.messages[msgId].update({
            role: 'assistant',
            content: message.content,
            createdAt: new Date().toISOString(),
            completed: true,
            startTime: startTime,
            endTime: endTime,
            tps: tps,
            citations: citations.length > 0 ? citations : undefined,
            mediaData: mediaData || undefined,
            weatherData: weatherData || undefined,
          }).link({ thread: currentThreadId.current }),
          db.tx.threads[currentThreadId.current].update({
            updatedAt: new Date().toISOString(),
          }),
        ]);
      } catch (error) {
        console.error('Failed to persist assistant message:', error);
      }

      // Reset state
      startTimeRef.current = null;
      setCitations([]);
      setMediaData(null);
      setWeatherData(null);
    },

    onError: (error) => {
      console.error('Chat error:', error);
    },
  });

  // Sync initial messages from DB only once when they first become available
  // This prevents duplicate messages when DB live query updates after user sends a message
  useEffect(() => {
    if (!hasInitialSyncRef.current && initialMessages.length > 0 && chat.messages.length === 0) {
      hasInitialSyncRef.current = true;
      chat.setMessages(initialMessages.map(convertToAIMessage));
    }
  }, [initialMessages, chat]);

  // Extract citations and tool results from data stream
  useEffect(() => {
    if (chat.data && Array.isArray(chat.data)) {
      for (const item of chat.data) {
        if (item && typeof item === 'object') {
          const dataItem = item as Record<string, unknown>;
          // Handle citations
          if (dataItem.type === 'citations' && Array.isArray(dataItem.citations)) {
            setCitations(dataItem.citations as Citation[]);
          }
          // Handle tool results (weather, media)
          if (dataItem.toolName) {
            const toolResult = dataItem as { toolName: string; result?: Record<string, unknown> };
            if (toolResult.toolName === 'weather' && toolResult.result?.weatherData) {
              setWeatherData(toolResult.result.weatherData);
            }
            if ((toolResult.toolName === 'movies' || toolResult.toolName === 'tv') && toolResult.result?.success) {
              setMediaData(toolResult.result as unknown as MediaData);
            }
          }
        }
      }
    }
  }, [chat.data]);

  // Custom submit handler with InstantDB persistence
  const submit = useCallback(async (
    input: string,
    options?: {
      attachments?: File[];
      quotedText?: string;
    }
  ) => {
    if (!userId || !input.trim()) return;

    const userMsgId = id();
    const now = new Date();

    // Create thread on first message
    if (isNewThread.current) {
      try {
        await db.transact([
          db.tx.threads[currentThreadId.current].update({
            title: input.substring(0, 50),
            model: selectedModel,
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
          }).link({ user: userId }),
        ]);
        isNewThread.current = false;
        onThreadCreated?.(currentThreadId.current);
      } catch (error) {
        console.error('Failed to create thread:', error);
        return;
      }
    }

    // Persist user message to InstantDB
    try {
      await db.transact([
        db.tx.messages[userMsgId].update({
          role: 'user',
          content: input,
          createdAt: now.toISOString(),
          quotedText: options?.quotedText,
          attachments: options?.attachments?.map(f => ({
            name: f.name,
            type: f.type,
            size: f.size,
          })),
        }).link({ thread: currentThreadId.current }),
      ]);
    } catch (error) {
      console.error('Failed to persist user message:', error);
    }

    // Prepare attachments for AI SDK
    let experimentalAttachments: { name: string; contentType: string; url: string }[] | undefined;
    if (options?.attachments && options.attachments.length > 0) {
      experimentalAttachments = await Promise.all(
        options.attachments.map(async (file) => ({
          name: file.name,
          contentType: file.type,
          url: await fileToDataURL(file),
        }))
      );
    }

    // Submit to AI
    chat.handleSubmit(new Event('submit') as any, {
      body: { model: selectedModel },
      ...(experimentalAttachments && {
        experimental_attachments: experimentalAttachments,
      }),
    });
  }, [chat, userId, selectedModel, onThreadCreated]);

  // Append a message (for compatibility with old code)
  const append = useCallback(async (message: Partial<Message>) => {
    if (!message.content) return;
    await submit(message.content);
  }, [submit]);

  // Reset chat to start a fresh conversation
  const reset = useCallback(() => {
    const newId = id();
    setChatKey(newId);
    setCitations([]);
    setMediaData(null);
    setWeatherData(null);
    chat.setMessages([]);
    chat.setInput('');
  }, [chat]);

  // Convert AI SDK messages to our Message format with extra data
  const messages: Message[] = chat.messages.map((msg, index) => {
    const isLastAssistant = msg.role === 'assistant' && index === chat.messages.length - 1;

    // Get stored extras from initial messages (preserves citations, mediaData, etc. from DB)
    const storedExtras = initialMessageExtrasRef.current.get(msg.id) || {};

    // Extract tool results if available
    let toolMediaData: MediaData | undefined;
    let toolWeatherData: unknown;

    if (msg.toolInvocations) {
      for (const invocation of msg.toolInvocations) {
        if (invocation.state === 'result') {
          const result = (invocation as { state: 'result'; result: Record<string, unknown> }).result;
          if ((invocation.toolName === 'movies' || invocation.toolName === 'tv') && result?.success) {
            toolMediaData = result as unknown as MediaData;
          }
          if (invocation.toolName === 'weather' && result?.weatherData) {
            toolWeatherData = result.weatherData;
          }
        }
      }
    }

    return convertToAppMessage(msg, {
      completed: !chat.isLoading || !isLastAssistant,
      // Use stored citations from DB, or current streaming citations for last message
      citations: storedExtras.citations || (isLastAssistant ? citations : undefined),
      // Use stored mediaData/weatherData from DB, or current tool results, or streaming data
      mediaData: storedExtras.mediaData || toolMediaData || (isLastAssistant && mediaData ? mediaData : undefined),
      weatherData: storedExtras.weatherData || toolWeatherData || (isLastAssistant ? weatherData : undefined),
      // Preserve other extras from DB
      tps: storedExtras.tps,
      startTime: storedExtras.startTime,
      endTime: storedExtras.endTime,
      quotedText: storedExtras.quotedText,
      attachments: storedExtras.attachments,
      images: storedExtras.images,
      provider: storedExtras.provider,
    });
  });

  return {
    messages,
    input: chat.input,
    setInput: chat.setInput,
    isLoading: chat.isLoading,
    error: chat.error,
    stop: chat.stop,
    reload: chat.reload,
    data: chat.data,
    citations,
    mediaData,
    weatherData,
    submit,
    append,
    reset,
    threadId: currentThreadId.current,
    handleInputChange: chat.handleInputChange,
  };
}
