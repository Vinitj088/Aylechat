export interface Tool {
  name: string;
  command: string;
  description: string;
  // Example for structured arguments, can be used for more complex tools
  // args?: { name: string; type: string; description: string }[];
}

export const availableTools: Tool[] = [
  {
    name: 'Weather',
    command: '/weather',
    description: 'Get the current weather for a specific location. Use this for any weather-related queries.',
  },
  {
    name: 'Movies',
    command: '/movies',
    description: 'Find information about movies, such as actors, ratings, plot summaries, and release dates.',
  },
  {
    name: 'TV Shows',
    command: '/tv',
    description: 'Find information about TV shows, including episodes, cast, and ratings.',
  },
]; 