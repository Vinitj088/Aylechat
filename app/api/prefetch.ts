/**
 * API Module Prefetching
 * 
 * This module provides functions to prefetch API modules and data
 * for faster subsequent requests by loading needed code ahead of time.
 */

// Prefetch API modules to reduce cold start times
export async function prefetchApiModules() {
  try {
    // Only prefetch the new universal AI SDK route
    console.log('Prefetching AI SDK universal API module...');
    Promise.all([
      import('./ai/route'),
    ]).catch(() => {
      // Silently catch errors - this is just optimization
    });
  } catch (error) {
    // Silently ignore any errors during prefetching
  }
}

// Prefetch frequently used API data sources
export async function prefetchApiData() {
  try {
    // Use fetch API to warm up endpoints that return shared data
    // This is especially helpful for endpoints that fetch from databases
    
    // Don't use credentials for prefetch requests to avoid auth issues
    const options = {
      method: 'GET',
      headers: { 
        'Content-Type': 'application/json',
        'X-Prefetch': 'true' // Signal this is a prefetch request
      },
      cache: 'no-store' as RequestCache // Ensure fresh data with correct type
    };
    
    
    // that are commonly accessed and might benefit from caching
  } catch (error) {
    // Silently ignore prefetch errors
  }
}

// Main prefetch function that orchestrates all prefetching
export async function prefetchAll() {
  // Prefetch API modules
  const apiPrefetchPromises = [
    import('./apiService'),
    import('./ai/route'),
  ];

  // Prefetch models config separately
  const modelConfigPromise = import('../../models.json');

  // Execute all prefetch operations in parallel, excluding the warmup calls
  await Promise.allSettled([...apiPrefetchPromises, modelConfigPromise]);
}

// Removed custom response caching logic as it's unsafe/redundant
/*
// Cache commonly used responses
export const responseCache = new Map();

export function cacheResponse(model: string, input: string, response: any) {
  const key = `${model}:${input}`;
  responseCache.set(key, {
    response,
    timestamp: Date.now()
  });
}

export function getCachedResponse(model: string, input: string) {
  const key = `${model}:${input}`;
  const cached = responseCache.get(key);
  
  if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) { // 5 minute cache
    return cached.response;
  }
  
  return null;
}
*/ 