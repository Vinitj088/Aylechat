import type { NextApiRequest, NextApiResponse } from 'next';

type ScrapeRequestBody = {
  urlToScrape: string;
};

type ScrapeSuccessResponse = {
  success: true;
  markdownContent: string;
};

type ScrapeErrorResponse = {
  success: false;
  message: string;
};

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
  res: NextApiResponse<ScrapeSuccessResponse | ScrapeErrorResponse>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
  }

  const { urlToScrape } = req.body as ScrapeRequestBody;
  const apiKey = process.env.FIRECRAWL_API_KEY;

  if (!apiKey) {
    console.error('FIRECRAWL_API_KEY environment variable not set.');
    return res.status(500).json({ success: false, message: 'Server configuration error: Missing API key.' });
  }
  if (!urlToScrape || typeof urlToScrape !== 'string' || !isValidHttpUrl(urlToScrape)) {
    return res.status(400).json({ success: false, message: 'Invalid or missing URL in request body.' });
  }

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
        formats: ['markdown'] // Always request markdown output
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

    if (firecrawlResult.success && firecrawlResult.data?.markdown) {
      const markdownContent = firecrawlResult.data.markdown;
      return res.status(200).json({ 
        success: true, 
        markdownContent: markdownContent 
      });
    } else {
      const clientMessage = firecrawlResult.message || 'Scraping process completed, but no markdown content was extracted.';
      return res.status(200).json({ success: false, message: clientMessage });
    }

  } catch (error) {
    console.error('Error during fetch or processing scrape result:', error);
    return res.status(500).json({ success: false, message: 'An internal server error occurred while trying to scrape the URL.' });
  }
}
 