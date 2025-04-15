import { MediaData } from '../app/types'; // Adjust path as necessary

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// Helper function to fetch details (including genres)
async function fetchMediaDetails(id: number, type: 'movie' | 'tv'): Promise<any | null> {
  const detailsUrl = `${TMDB_BASE_URL}/${type}/${id}?api_key=${TMDB_API_KEY}&language=en-US`;
  try {
    const response = await fetch(detailsUrl, { cache: 'no-store' });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error(`Error fetching TMDB ${type} details for ID ${id}:`, error);
    return null;
  }
}

// Helper function to fetch credits (cast)
async function fetchMediaCredits(id: number, type: 'movie' | 'tv'): Promise<any | null> {
  const creditsUrl = `${TMDB_BASE_URL}/${type}/${id}/credits?api_key=${TMDB_API_KEY}&language=en-US`;
  try {
    const response = await fetch(creditsUrl, { cache: 'no-store' });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error(`Error fetching TMDB ${type} credits for ID ${id}:`, error);
    return null;
  }
}

/**
 * Searches TMDB for a movie or TV show, fetches details & credits, 
 * and returns formatted data for the best match.
 * @param title The title to search for.
 * @param type The type of media ('movie' or 'tv').
 * @returns A MediaData object for the best match, or null if not found or an error occurs.
 */
export async function searchTmdb(title: string, type: 'movie' | 'tv'): Promise<MediaData | null> {
  if (!TMDB_API_KEY) {
    console.error('TMDB_API_KEY environment variable is not set.');
    return null;
  }

  const searchUrl = `${TMDB_BASE_URL}/search/${type}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}&page=1`;

  try {
    console.log(`Searching TMDB (${type}): ${title}`);
    const searchResponse = await fetch(searchUrl, { cache: 'no-store' });

    if (!searchResponse.ok) {
      console.error(`TMDB API search error: ${searchResponse.status} ${searchResponse.statusText}`);
      return null;
    }

    const searchData = await searchResponse.json();

    if (!searchData.results || searchData.results.length === 0) {
      console.log(`No TMDB results found for ${type}: ${title}`);
      return null;
    }

    // Assume the first result is the most relevant one
    const result = searchData.results[0];
    console.log(`Found TMDB result: ${result.title || result.name} (ID: ${result.id})`);

    // Fetch details (for genres, runtime) and credits (for cast) using the ID
    const [details, credits] = await Promise.all([
      fetchMediaDetails(result.id, type),
      fetchMediaCredits(result.id, type)
    ]);

    // Extract relevant genres and cast (limited number)
    const genres = details?.genres?.slice(0, 3) || []; // Take up to 3 genres
    const cast = credits?.cast?.slice(0, 5)?.map((actor: any) => ({ // Take up to 5 actors
      id: actor.id,
      name: actor.name,
      character: actor.character
    })) || [];

    // Extract runtime (Note: TMDB provides movie runtime, TV episode_run_time is an array)
    const runtime = details?.runtime || (details?.episode_run_time?.[0] || null);

    // Format the result into our MediaData structure
    const formattedData: MediaData = {
      mediaType: type,
      id: result.id,
      title: type === 'movie' ? result.title : result.name,
      overview: result.overview || null,
      posterPath: result.poster_path || null,
      releaseDate: type === 'movie' ? (result.release_date || null) : null,
      firstAirDate: type === 'tv' ? (result.first_air_date || null) : null,
      voteAverage: result.vote_average || null,
      genres: genres, // Add genres
      cast: cast,     // Add cast
      runtime: runtime, // Add runtime
    };

    return formattedData;

  } catch (error) {
    console.error(`Error fetching or processing TMDB data for ${type} - ${title}:`, error);
    return null;
  }
} 