import { NextRequest, NextResponse } from 'next/server';
import { MediaData } from '@/app/types'; // Adjusted import path
import { searchTmdb } from '@/lib/tmdb'; // Adjusted import path

// --- Weather Command Helpers ---

// Helper to convert wind direction from degrees to a cardinal point
function degreesToCardinal(deg: number): string {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    return directions[Math.round(deg / 22.5) % 16];
}

// A mapping from Tomorrow.io weather codes to a simpler description
const getWeatherDescription = (code: number): string => {
  const weatherCodeMap: { [key: number]: string } = {
    1000: 'Clear', 1100: 'Mostly Clear', 1101: 'Partly Cloudy', 1102: 'Mostly Cloudy',
    1001: 'Cloudy', 2000: 'Fog', 2100: 'Light Fog', 4000: 'Drizzle',
    4200: 'Light Rain', 4001: 'Rain', 4201: 'Heavy Rain', 5000: 'Snow',
    5001: 'Flurries', 5100: 'Light Snow', 5101: 'Heavy Snow', 6000: 'Freezing Drizzle',
    6001: 'Freezing Rain', 6200: 'Light Freezing Rain', 6201: 'Heavy Freezing Rain',
    7000: 'Ice Pellets', 7101: 'Heavy Ice Pellets', 7102: 'Light Ice Pellets',
    8000: 'Thunderstorm', 0: 'Unknown'
  };
  return weatherCodeMap[code] || 'Unknown';
};

async function getWeatherData(location: string): Promise<any | null> {
  const apiKey = process.env.TOMORROW_API_KEY;
  if (!apiKey) {
    console.error("TOMORROW_API_KEY is not set in environment variables.");
    // Return a specific structure that can be caught and reported to the user.
    return { error: 'API_KEY_MISSING', message: 'The weather service API key is not configured. Please set TOMORROW_API_KEY.' };
  }

  const forecastUrl = new URL('https://api.tomorrow.io/v4/weather/forecast');
  forecastUrl.searchParams.append('location', location);
  forecastUrl.searchParams.append('timesteps', '1h,1d');
  forecastUrl.searchParams.append('units', 'metric');
  forecastUrl.searchParams.append('apikey', apiKey);

  try {
    const response = await fetch(forecastUrl.toString(), {
      headers: { 'accept': 'application/json' }
    });

    const responseBody = await response.json();

    if (!response.ok) {
      console.error(`Tomorrow.io API error for location "${location}": ${response.status}`, responseBody);
      // Pass a structured error message back
      return { 
          error: 'API_ERROR', 
          message: responseBody.message || `Could not fetch weather for "${location}". The location might be invalid.`
      };
    }
    
    // Basic validation to see if we got data back
    if (!responseBody.timelines || !responseBody.timelines.daily || !responseBody.timelines.hourly) {
      console.warn(`Tomorrow.io data for "${location}" seems invalid.`, responseBody);
      return null;
    }
    
    const now = responseBody.timelines.hourly[0].values;
    const today = responseBody.timelines.daily[0].values;

    // --- Data Transformation ---
    // Transform the Tomorrow.io response to a format similar to the old wttr.in one
    // to minimize changes in consuming components (WeatherCard, LLM context builder).
    const transformedData = {
      display_location: location, // Keep user's query
      location: {
        name: responseBody.location.name || location,
      },
      current_condition: [ // Keep as array for compatibility
        {
          temp_C: Math.round(now.temperature),
          FeelsLikeC: Math.round(now.temperatureApparent),
          weatherDesc: [{ value: getWeatherDescription(now.weatherCode) }],
          weatherCode: now.weatherCode,
          windspeedKmph: Math.round(now.windSpeed * 3.6), // m/s to km/h
          winddir16Point: degreesToCardinal(now.windDirection),
          humidity: Math.round(now.humidity),
          visibility: Math.round(now.visibility),
        }
      ],
      weather: [ // Keep as array for compatibility
        {
          maxtempC: Math.round(today.temperatureMax),
          mintempC: Math.round(today.temperatureMin),
          // For the daily forecast, provide a summary of conditions using the full day code
          hourly: [{}, {}, {}, {}, { weatherDesc: [{ value: getWeatherDescription(today.weatherCodeMax) }] }],
        }
      ]
    };

    return transformedData;

  } catch (error) {
    console.error(`Error fetching or parsing weather data for "${location}":`, error);
    return null;
  }
}

async function getWeatherAnswerFromContext(weatherData: any, originalQuery: string, reqUrl: string): Promise<string | null> {
  const model = 'gemini-1.5-flash-latest';
  
  // Create a simplified but informative context from the weather JSON
  const current = weatherData.current_condition[0];
  const forecast = weatherData.weather[0];
  const contextString = `
- Location: ${weatherData.location.name}
- Current Temperature: ${current.temp_C}°C
- Feels Like: ${current.FeelsLikeC}°C
- Weather: ${current.weatherDesc[0].value}
- Wind: ${current.windspeedKmph} km/h from ${current.winddir16Point}
- Humidity: ${current.humidity}%
- Visibility: ${current.visibility} km
- Today's Forecast: High ${forecast.maxtempC}°C, Low ${forecast.mintempC}°C. Overall conditions will be ${forecast.hourly[4].weatherDesc[0].value}.
  `;

  const fullPrompt = `You are a helpful assistant providing a weather report.
Use ONLY the provided context below to answer the user's question in a clear, human-readable format.
Do not use any outside knowledge. Start with a summary and then provide details if the user asked for them.

Context:
---
${contextString}
---

User Question: "${originalQuery}"

Answer:`;

  // Re-use the Gemini helper logic from getAnswerFromContext
  const geminiApiUrl = new URL('/api/gemini', reqUrl).toString();
  console.log(`Using Gemini endpoint for weather answer: ${geminiApiUrl} with model ${model}`);

  try {
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
        temperature: 0.3,
      })
    });

    if (!response.ok || !response.body) {
      const errorText = await response.text();
      console.error(`Gemini API error for weather answering: ${response.status} ${response.statusText}`, errorText);
      return `(Error getting weather summary from LLM)`;
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
    
    return fullResponse.trim() || "(Could not generate a weather summary.)";
  } catch (error) {
    console.error('Error calling Gemini for weather answering:', error);
    return "(An error occurred while generating the weather summary.)";
  }
}

// --- End Weather Command Helpers ---

// Helper function to call Groq API for title extraction (Reverted)
async function extractMediaTitle(query: string, commandType: 'movies' | 'tv', reqUrl: string): Promise<string | null> {
  const itemType = commandType === 'movies' ? 'movie' : 'TV show';
  const model = 'llama-3.1-8b-instant'; // Use Groq Llama3 8b for extraction

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
    const { command, query } = body as { command: '/movies' | '/tv' | '/weather', query: string }; 

    if (!command || !query || (command !== '/movies' && command !== '/tv' && command !== '/weather')) {
      return NextResponse.json({ type: 'error', message: 'Invalid command or query.' }, { status: 400 });
    }

    console.log(`Received command: ${command}, Query: ${query}`);

    // --- Handle /weather command ---
    if (command === '/weather') {
      const location = query; // For now, assume query is the location
      const weatherData = await getWeatherData(location);
      
      if (!weatherData || weatherData.error) {
        const message = weatherData?.message || `Sorry, I couldn't find weather information for "${location}". Please check the location and try again.`;
        return NextResponse.json({ 
          type: 'no_result', 
          message: message 
        }, { status: 200 });
      }

      // Generate a human-readable answer from the data
      const answer = await getWeatherAnswerFromContext(weatherData, query, requestUrl);
      
      return NextResponse.json({ 
        type: 'weather_result', 
        data: weatherData, 
        answer: answer || "Here is the weather data." 
      }, { status: 200 });
    }
    // --- End /weather command handler ---

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