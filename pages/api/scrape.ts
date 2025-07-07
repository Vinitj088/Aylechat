import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@/lib/db';
import { id, lookup } from '@instantdb/react';

// --- Constants ---
const CACHE_TTL_SECONDS = 3600; // Cache validity for 1 hour

type ScrapeRequestBody = {
  urlToScrape: string;
};

// Response when cache is valid (frontend should use localStorage)
type ScrapeCacheValidResponse = {
  success: true;
  cacheStatus: 'valid';
  markdownContent: string;
};

// Response when cache is refreshed (frontend should update localStorage)
type ScrapeCacheRefreshedResponse = {
  success: true;
  cacheStatus: 'refreshed';
  markdownContent: string;
};

type ScrapeErrorResponse = {
  success: false;
  message: string;
};

// Simple URL validation (can be made more robust)
function isValidHttpUrl(string: string): boolean {
  let url;
  try {
    url = new URL(string);
  } catch (_) {
    return false;
  }
  return url.protocol === "http:" || url.protocol === "https:";
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ScrapeCacheValidResponse | ScrapeCacheRefreshedResponse | ScrapeErrorResponse>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
  }

  const { urlToScrape } = req.body as ScrapeRequestBody;
  const apiKey = process.env.FIRECRAWL_API_KEY;

  // --- Input Validation ---
  if (!apiKey) {
    console.error('FIRECRAWL_API_KEY environment variable not set.');
    return res.status(500).json({ success: false, message: 'Server configuration error: Missing API key.' });
  }
  if (!urlToScrape || typeof urlToScrape !== 'string' || !isValidHttpUrl(urlToScrape)) {
    return res.status(400).json({ success: false, message: 'Invalid or missing URL in request body.' });
  }

  // --- Check Cache ---
  const query = { scrapedUrls: { $: { where: { url: urlToScrape } } } };
  // This is a backend route, so we can't use useQuery.
  // We need a way to query data from the backend.
  // For now, we'll assume a direct DB access method.
  // This part of the code will need to be adjusted based on how you
  // decide to query data from the backend.
  // const { data } = await db.query(query);
  // const cached = data?.scrapedUrls[0];

  // if (cached && (new Date().getTime() - new Date(cached.scrapedAt).getTime()) / 1000 < CACHE_TTL_SECONDS) {
  //   return res.status(200).json({ success: true, cacheStatus: 'valid', markdownContent: cached.markdownContent });
  // }


  // --- If Cache Invalid/Missing, Scrape --- 
  console.log(`Backend: Initiating scrape for URL: ${urlToScrape}`);
  const firecrawlApiUrl = 'https://api.firecrawl.dev/v1/scrape';
  try {
    const fetchFn = typeof fetch === 'function' ? fetch : (await import('node-fetch')).default;
    const firecrawlResponse = await fetchFn(firecrawlApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url: urlToScrape,
        formats: ['markdown'],
      }),
    });

    let firecrawlResult;
    const contentType = firecrawlResponse.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
        firecrawlResult = await firecrawlResponse.json();
    } else {
        const textResult = await firecrawlResponse.text();
        console.error(`Firecrawl API returned non-JSON response (${firecrawlResponse.status}):`, textResult);
        return res.status(firecrawlResponse.status).json({ success: false, message: `Scraping service returned unexpected response (Status: ${firecrawlResponse.status})` });
    }

    if (!firecrawlResponse.ok) {
      console.error(`Firecrawl API Error (${firecrawlResponse.status}):`, firecrawlResult);
      return res.status(500).json({ success: false, message: 'Failed to scrape the URL due to an upstream service error.' });
    }

    // --- Process Scrape Result & Update Cache --- 
    if (firecrawlResult.success && firecrawlResult.data?.markdown) {
      const markdownContent = firecrawlResult.data.markdown;
      console.log(`Backend: Successfully scraped markdown. Length: ${markdownContent.length}. Setting cache.`);
      
      const scrapedAt = new Date();
      const scrapeId = lookup('url', urlToScrape);
      await db.transact(
        db.tx.scrapedUrls[scrapeId].update({
          url: urlToScrape,
          markdownContent,
          scrapedAt: scrapedAt.toISOString(),
        })
      );

      // Send the newly scraped content to the frontend
      return res.status(200).json({ 
        success: true, 
        cacheStatus: 'refreshed', 
        markdownContent: markdownContent 
      });

    } else {
      console.warn('Firecrawl API response indicates success=false or missing markdown content.', firecrawlResult);
      const clientMessage = firecrawlResult.message || 'Scraping process completed, but no markdown content was extracted.';
      return res.status(200).json({ success: false, message: clientMessage });
    }

  } catch (error) {
    console.error('Error during fetch or processing scrape result:', error);
    return res.status(500).json({ success: false, message: 'An internal server error occurred while trying to scrape the URL.' });
  }
}
 