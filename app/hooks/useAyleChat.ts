'use client';

import { useChat, Message as AIMessage } from '@ai-sdk/react';
import { useCallback, useRef, useEffect, useState } from 'react';
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
  const isNewThread = useRef(!initialThreadId);
  const currentThreadId = useRef(initialThreadId || id());
  const [citations, setCitations] = useState<Citation[]>([]);
  const [mediaData, setMediaData] = useState<MediaData | null>(null);
  const [weatherData, setWeatherData] = useState<any>(null);
  const startTimeRef = useRef<number | null>(null);

  // Determine API endpoint based on model
  const apiEndpoint = selectedModel === 'exa' ? '/api/chat/exa' : '/api/chat';

  const chat = useChat({
    api: apiEndpoint,
    id: currentThreadId.current, // Use thread ID for chat state isolation
    body: {
      model: selectedModel,
    },
    initialMessages: initialMessages.map(convertToAIMessage),

    onResponse: () => {
      // Track when streaming starts
      startTimeRef.current = Date.now();
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

  // Convert AI SDK messages to our Message format with extra data
  const messages: Message[] = chat.messages.map((msg, index) => {
    const isLastAssistant = msg.role === 'assistant' && index === chat.messages.length - 1;

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
      citations: isLastAssistant ? citations : undefined,
      mediaData: toolMediaData || (isLastAssistant && mediaData ? mediaData : undefined),
      weatherData: toolWeatherData || (isLastAssistant ? weatherData : undefined),
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
    threadId: currentThreadId.current,
    handleInputChange: chat.handleInputChange,
  };
}
