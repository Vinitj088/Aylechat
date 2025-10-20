import { getAssetPath } from '../../utils';
import { toast } from 'sonner';

// --- URL Scraping Service with Caching ---
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Scrapes URL content with localStorage caching
 * Cache TTL: 24 hours
 * @param url - URL to scrape
 * @param abortController - AbortController for request cancellation
 * @returns Scraped markdown content or null if failed
 */
export const scrapeUrlContent = async (
  url: string,
  abortController: AbortController
): Promise<string | null> => {
  const cacheKey = `scrape_cache_${url}`;
  const now = Date.now();

  // 1. Check localStorage for a cached version
  try {
    const cachedItem = localStorage.getItem(cacheKey);
    if (cachedItem) {
      const { timestamp, markdownContent } = JSON.parse(cachedItem);
      if (now - timestamp < ONE_DAY_MS) {
        console.log(`[Scrape Cache] HIT for URL: ${url}`);
        toast.success('URL Content Loaded from Cache', {
          description: 'Using recently scraped content for this URL.',
          duration: 3000,
        });
        return markdownContent;
      } else {
        console.log(`[Scrape Cache] STALE for URL: ${url}`);
        localStorage.removeItem(cacheKey); // Remove stale item
      }
    }
  } catch (e) {
    console.error('[Scrape Cache] Error reading from localStorage:', e);
  }

  // 2. If cache miss or stale, fetch from the API
  console.log(`[Scrape Cache] MISS for URL: ${url}. Fetching from API.`);
  const scrapeApiEndpoint = getAssetPath('/api/scrape');

  try {
    const response = await fetch(scrapeApiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: abortController.signal,
      body: JSON.stringify({ urlToScrape: url }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        message: 'Failed to parse scrape error response',
      }));
      toast.warning('URL Scraping Failed', {
        description: `Could not get content for the URL. Error: ${
          errorData.message || response.statusText
        }`,
        duration: 5000,
      });
      return null;
    }

    const result = await response.json();

    if (result.success && result.markdownContent) {
      // 3. Store the new data in localStorage
      try {
        const newItem = {
          timestamp: now,
          markdownContent: result.markdownContent,
        };
        localStorage.setItem(cacheKey, JSON.stringify(newItem));
        console.log(`[Scrape Cache] SET for URL: ${url}`);
      } catch (e) {
        console.error('[Scrape Cache] Error writing to localStorage:', e);
      }

      toast.success('URL Content Scraped', {
        description: 'Fresh content from the URL will be used.',
        duration: 3000,
      });
      return result.markdownContent;
    } else {
      toast.warning('URL Scraping Issue', {
        description:
          result.message ||
          'Scraping completed but no content was returned.',
        duration: 5000,
      });
      return null;
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('[Scrape] Request aborted.');
      return null;
    }
    console.error('[Scrape] Error calling backend scrape endpoint:', error);
    toast.error('Scraping Error', {
      description: `An error occurred while trying to scrape the URL: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
      duration: 5000,
    });
    return null;
  }
};
