import { NextRequest, NextResponse } from 'next/server';
import { MediaData } from '@/app/types'; // Adjusted import path
import { searchTmdb } from '@/lib/tmdb'; // Adjusted import path

// Helper function to call Groq API for title extraction (Reverted)
async function extractMediaTitle(query: string, commandType: 'movies' | 'tv', reqUrl: string): Promise<string | null> {
  const itemType = commandType === 'movies' ? 'movie' : 'TV show';
  const model = 'llama3-8b-8192'; // Use Groq Llama3 8b for extraction

  // Extraction prompt
  const systemPrompt = `You are an AI specialized in extracting ${itemType} titles from user queries. 
Given the user query: "${query}", identify and extract the most likely ${itemType} title the user is asking about. 
Respond ONLY with the extracted title. Do not include explanations, apologies, or any other text. 
If no specific title can be identified, respond with "NULL".

Examples:

User Query: "main actor in titanic"
Response: titanic

User Query: "rating for The Matrix Reloaded"
Response: The Matrix Reloaded

User Query: "tbbt ending?"
Response: The Big Bang Theory

User Query: "tell me about star wars"
Response: star wars

User Query: "latest action movie"
Response: NULL

User Query: "how good was captain america brave new world"
Response: Captain America: Brave New World`;

  // Construct absolute URL for the Groq API call
  const groqApiUrl = new URL('/api/groq', reqUrl).toString();
  console.log(`Using Groq endpoint for extraction: ${groqApiUrl} with model ${model}`);

  try {
    console.log(`Extracting title for ${itemType} from query: "${query}" using ${model}`);
    const response = await fetch(groqApiUrl, { 
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      },
      body: JSON.stringify({
        query: query, // Pass original query for context
        model: model,
        systemPrompt: systemPrompt,
        temperature: 0.0, // Keep low temp for extraction
        max_tokens: 50, // Limit response size
        stream: true, 
      })
    });

    if (!response.ok || !response.body) {
      const errorText = await response.text();
      console.error(`Groq API error for extraction: ${response.status} ${response.statusText}`, errorText);
      return null;
    }

    // Process stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line.trim());
      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (data.choices && data.choices[0]?.delta?.content) {
            fullResponse += data.choices[0].delta.content;
          }
        } catch { /* Ignore parsing errors */ }
      }
    }

    console.log("LLM (Groq) Extraction Full Response:", fullResponse);

    const extractedTitle = fullResponse.trim();

    if (!extractedTitle || extractedTitle.toUpperCase() === 'NULL' || extractedTitle.length === 0) {
      console.log('LLM (Groq) could not extract a specific title.');
      return null;
    }
    
    const cleanedTitle = extractedTitle.replace(/^[\"\'\s]+|[\"\'\s]+$/g, '');
    console.log(`Extracted Title (Groq): "${cleanedTitle}"`);
    return cleanedTitle;

  } catch (error) {
    console.error('Error calling Groq for title extraction:', error);
    return null;
  }
}

// Helper function to get a concise answer based on media context using Gemini
async function getAnswerFromContext(mediaData: MediaData, originalQuery: string, reqUrl: string): Promise<string | null> {
  const model = 'gemini-1.5-flash-latest';
  const maxContextTokens = 3000; // Keep a limit to avoid overly long contexts

  // --- Construct Enhanced Context String --- 
  let contextString = `Title: ${mediaData.title}\n`;
  if (mediaData.mediaType === 'movie' && mediaData.releaseDate) {
    contextString += `Release Date: ${mediaData.releaseDate}\n`;
  }
  if (mediaData.mediaType === 'tv' && mediaData.firstAirDate) {
    contextString += `First Air Date: ${mediaData.firstAirDate}\n`;
  }
  if (mediaData.voteAverage) {
    contextString += `Rating: ${mediaData.voteAverage.toFixed(1)}/10\n`;
  }
  // Add Genres if available
  if (mediaData.genres && mediaData.genres.length > 0) {
    contextString += `Genres: ${mediaData.genres.map(g => g.name).join(', ' )}\n`;
  }
  // Add Cast if available
  if (mediaData.cast && mediaData.cast.length > 0) {
    contextString += `Main Cast: ${mediaData.cast.map(a => `${a.name} as ${a.character}`).join('; ' )}\n`;
  }
  // Add Overview (truncated)
  if (mediaData.overview) {
    const overviewTokens = Math.floor(mediaData.overview.length / 4);
    const availableTokens = maxContextTokens - Math.floor(contextString.length / 4);
    // Ensure availableTokens is not negative before substring
    if (availableTokens > 0) { 
      const truncatedOverview = mediaData.overview.substring(0, Math.min(mediaData.overview.length, availableTokens * 3));
      contextString += `Overview: ${truncatedOverview}${mediaData.overview.length > truncatedOverview.length ? '...' : ''}\n`;
    } else {
      contextString += `Overview: (Too long to include fully)\n`;
    }
  }
  // --- End Context String ---

  // --- Construct Updated Prompt for Gemini --- 
  const fullPrompt = `You are a helpful assistant answering questions about movies and TV shows. 
Use ONLY the provided context below to answer the user's question in an informative and helpful way. 
Do not use any outside knowledge. If the answer cannot be found in the context, say so politely. 
Focus on directly addressing the user's question based on the details given.

Context:
---
${contextString}---

User Question: "${originalQuery}"

Answer:`;

  // Construct absolute URL for the Gemini API call
  const geminiApiUrl = new URL('/api/gemini', reqUrl).toString();
  console.log(`Using Gemini endpoint for answering: ${geminiApiUrl} with model ${model}`);

  try {
    console.log(`Generating answer for query: "${originalQuery}" using context for "${mediaData.title}" with Gemini`);
    
    const response = await fetch(geminiApiUrl, { 
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      },
      body: JSON.stringify({
        query: fullPrompt, 
        model: model,
        messages: [], 
        // Add parameters for more detailed response (adjust as needed for Gemini API)
        temperature: 0.5, // Allow for a bit more creativity/natural language
        // max_tokens: 400, // Increase max tokens if longer answers are desired and supported
      })
    });

    if (!response.ok || !response.body) {
      const errorText = await response.text();
      console.error(`Gemini API error for answering: ${response.status} ${response.statusText}`, errorText);
      let errorDetail = response.statusText;
      try {
        const errorJson = JSON.parse(errorText);
        errorDetail = errorJson.message || errorJson.error || errorDetail;
      } catch (e) { /* ignore json parse error */ }
      return `(Error getting answer from LLM: ${errorDetail})`;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line.trim());
      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (data.choices && data.choices[0]?.delta?.content) {
            fullResponse += data.choices[0].delta.content;
          }
        } catch { /* Ignore parsing errors */ }
      }
    }

    const finalAnswer = fullResponse.trim();
    console.log(`Generated Gemini Answer: "${finalAnswer}"`);
    return finalAnswer || "(Could not generate an answer...)";

  } catch (error) {
    console.error('Error calling Gemini for contextual answering:', error);
    return "(An error occurred...)";
  }
}

export async function POST(req: NextRequest) {
  // Get the request URL to build absolute paths for internal API calls
  const requestUrl = req.url;

  try {
    const body = await req.json();
    // Explicitly type the body structure for clarity
    const { command, query } = body as { command: '/movies' | '/tv', query: string }; 

    if (!command || !query || (command !== '/movies' && command !== '/tv')) {
      return NextResponse.json({ type: 'error', message: 'Invalid command or query.' }, { status: 400 });
    }

    console.log(`Received command: ${command}, Query: ${query}`);

    // 1. Extract Title
    const commandType = command === '/movies' ? 'movies' : 'tv';
    const extractedTitle = await extractMediaTitle(query, commandType, requestUrl);
    if (!extractedTitle) {
      return NextResponse.json({ 
        type: 'no_result', 
        message: `Sorry, I couldn't identify a specific ${commandType === 'movies' ? 'movie' : 'TV show'} title from your query: "${query}". Please try rephrasing.` 
      }, { status: 200 });
    }

    // 2. Search TMDB
    const mediaType = command === '/movies' ? 'movie' : 'tv';
    const mediaData = await searchTmdb(extractedTitle, mediaType);
    if (!mediaData) {
      return NextResponse.json({ 
        type: 'no_result', 
        message: `Sorry, I couldn't find details for \"${extractedTitle}\" on TMDB.` 
      }, { status: 200 });
    }

    // 3. Get Answer from Context
    const finalAnswer = await getAnswerFromContext(mediaData, query, requestUrl);

    // Return combined data
    return NextResponse.json({ 
      type: 'media_result', 
      data: mediaData, 
      answer: finalAnswer || "(Could not generate an answer.)" // Ensure answer is never null
    });

  } catch (error) {
    console.error('Error in command handler:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ type: 'error', message: `Internal server error: ${errorMessage}` }, { status: 500 });
  }
} 