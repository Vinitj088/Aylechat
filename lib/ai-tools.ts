import { tool } from 'ai';
import { z } from 'zod';
import { searchTmdb } from './tmdb';

// Weather helper functions
function degreesToCardinal(deg: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return directions[Math.round(deg / 22.5) % 16];
}

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

// Weather tool
export const weatherTool = tool({
  description: 'Get current weather information for a specific location. Use this when the user asks about weather, temperature, or climate conditions.',
  parameters: z.object({
    location: z.string().describe('The city name or location to get weather for (e.g., "New York", "London, UK", "Tokyo")'),
  }),
  execute: async ({ location }) => {
    const apiKey = process.env.TOMORROW_API_KEY;
    if (!apiKey) {
      return { error: true, message: 'Weather service is not configured.' };
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
        return {
          error: true,
          message: responseBody.message || `Could not fetch weather for "${location}".`
        };
      }

      if (!responseBody.timelines?.daily || !responseBody.timelines?.hourly) {
        return { error: true, message: `Invalid weather data for "${location}".` };
      }

      const now = responseBody.timelines.hourly[0].values;
      const today = responseBody.timelines.daily[0].values;

      // Return structured weather data
      return {
        success: true,
        location: responseBody.location?.name || location,
        display_location: location,
        current: {
          temperature: Math.round(now.temperature),
          feelsLike: Math.round(now.temperatureApparent),
          condition: getWeatherDescription(now.weatherCode),
          weatherCode: now.weatherCode,
          windSpeed: Math.round(now.windSpeed * 3.6), // m/s to km/h
          windDirection: degreesToCardinal(now.windDirection),
          humidity: Math.round(now.humidity),
          visibility: Math.round(now.visibility),
        },
        today: {
          high: Math.round(today.temperatureMax),
          low: Math.round(today.temperatureMin),
          condition: getWeatherDescription(today.weatherCodeMax),
        },
        // Include raw data for WeatherCard component
        weatherData: {
          display_location: location,
          location: { name: responseBody.location?.name || location },
          current_condition: [{
            temp_C: Math.round(now.temperature),
            FeelsLikeC: Math.round(now.temperatureApparent),
            weatherDesc: [{ value: getWeatherDescription(now.weatherCode) }],
            weatherCode: now.weatherCode,
            windspeedKmph: Math.round(now.windSpeed * 3.6),
            winddir16Point: degreesToCardinal(now.windDirection),
            humidity: Math.round(now.humidity),
            visibility: Math.round(now.visibility),
          }],
          weather: [{
            maxtempC: Math.round(today.temperatureMax),
            mintempC: Math.round(today.temperatureMin),
            hourly: [{}, {}, {}, {}, { weatherDesc: [{ value: getWeatherDescription(today.weatherCodeMax) }] }],
          }]
        }
      };
    } catch (error) {
      console.error(`Error fetching weather for "${location}":`, error);
      return { error: true, message: `Failed to fetch weather data.` };
    }
  },
});

// Movies tool
export const moviesTool = tool({
  description: 'Search for movie information including cast, rating, release date, and overview. Use this when the user asks about movies, films, actors in movies, movie ratings, or movie plots.',
  parameters: z.object({
    query: z.string().describe('The movie title or search query (e.g., "Inception", "The Matrix", "latest Christopher Nolan movie")'),
  }),
  execute: async ({ query }) => {
    const result = await searchTmdb(query, 'movie');
    if (!result) {
      return { error: true, message: `Could not find information about "${query}".` };
    }
    return {
      success: true,
      ...result,
    };
  },
});

// TV Shows tool
export const tvTool = tool({
  description: 'Search for TV show information including cast, rating, air date, and overview. Use this when the user asks about TV shows, series, TV actors, or show plots.',
  parameters: z.object({
    query: z.string().describe('The TV show title or search query (e.g., "Breaking Bad", "Game of Thrones", "latest Netflix series")'),
  }),
  execute: async ({ query }) => {
    const result = await searchTmdb(query, 'tv');
    if (!result) {
      return { error: true, message: `Could not find information about "${query}".` };
    }
    return {
      success: true,
      ...result,
    };
  },
});

// Export all tools
export const aiTools = {
  weather: weatherTool,
  movies: moviesTool,
  tv: tvTool,
};

// Type for tool names
export type ToolName = keyof typeof aiTools;
