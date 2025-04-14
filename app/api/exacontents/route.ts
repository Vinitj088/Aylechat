import { NextRequest } from 'next/server';
import Exa from "exa-js";
import { Message } from '@/app/types';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

interface ExaSearchResult {
  url: string;
  title?: string;
  text?: string;
  favicon?: string;
  id?: string;
}

interface ExaSearchResponse {
  results: ExaSearchResult[];
}

const exa = new Exa(process.env.EXA_API_KEY as string);

export async function POST(req: NextRequest) {
  try {
    // Parse request body first
    const body = await req.json();
    const { query, messages } = body;
    
    if (!query) {
      return new Response(JSON.stringify({ error: 'query is required' }), { status: 400 });
    }

    // Add timeout promise to avoid hanging requests
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timed out')), 60000); // 60 seconds timeout
    });

    // Format previous messages for context if they exist
    let enhancedQuery = query;
    if (messages && messages.length > 0) {
      // Take only the last 3 messages to limit context window size
      const recentMessages = messages.slice(-3);
      
      // Convert messages to a conversation context string
      const conversationContext = recentMessages
        .map((msg: Message) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
        .join('\n\n');
      
      // Enhance the query with conversation context
      enhancedQuery = `Based on this conversation:\n\n${conversationContext}\n\nAnswer this follow-up question: ${query}`;
    }

    // Get search results and contents using Exa
    const searchPromise = exa.searchAndContents(enhancedQuery, {
      type: "neural",
      numResults: 5,
      text: true,
    });
    
    // Use Promise.race to implement timeout
    const searchResults = await Promise.race([searchPromise, timeoutPromise]) as ExaSearchResponse;

    // Extract citations and prepare content for Gemini
    const citations = searchResults.results.map((result: ExaSearchResult) => ({
      url: result.url,
      title: result.title || result.url,
      snippet: result.text?.slice(0, 200) + '...',
      favicon: result.favicon,
      id: result.id
    }));

    // Prepare context for Gemini from search results
    const context = searchResults.results
      .map((result: ExaSearchResult) => `Source: ${result.title || result.url}\n${result.text}\n---`)
      .join('\n\n');

    // Create prompt for Gemini
    const prompt = `Based on the following search results, please provide a comprehensive and accurate answer to the question: "${query}"\n\nSearch Results:\n${context}`;

    // Call our Gemini API route with absolute URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const geminiResponse = await fetch(`${baseUrl}/api/gemini`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: prompt,
        model: 'gemini-2.0-flash',
        stream: true
      })
    });

    if (!geminiResponse.ok) {
      throw new Error('Failed to get response from Gemini API');
    }

    // Create a new ReadableStream for the response
    const encoder = new TextEncoder();
    const streamResponse = new ReadableStream({
      async start(controller) {
        try {
          // Send citations first
          controller.enqueue(encoder.encode(JSON.stringify({ citations }) + '\n'));

          // Stream the Gemini response
          const reader = geminiResponse.body?.getReader();
          if (!reader) throw new Error('No reader available from Gemini response');

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // Forward the chunks
            controller.enqueue(value);
          }

          controller.close();
        } catch (error) {
          console.error('Error during stream processing:', error);
          controller.enqueue(encoder.encode(JSON.stringify({
            choices: [{ delta: { content: "\n\nI apologize, but I encountered an issue processing your request. Please try again." } }]
          }) + '\n'));
          controller.close();
        }
      },
    });

    return new Response(streamResponse, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('API error:', error);
    return new Response(
      JSON.stringify({ 
        error: `Failed to process request | ${errorMessage}`,
        message: "There was an issue with your request. Please try again."
      }), 
      { status: 500 }
    );
  }
} 