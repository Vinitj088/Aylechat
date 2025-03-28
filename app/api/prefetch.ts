/**
 * API Module Prefetching
 * 
 * This module provides functions to prefetch API modules and data
 * for faster subsequent requests by loading needed code ahead of time.
 */

// Prefetch API modules to reduce cold start times
export async function prefetchApiModules() {
  try {
    // Only prefetch LLM API routes, not server component routes like threads
    console.log('Prefetching API modules...');
    Promise.all([
      import('./groq/route'),
      import('./openrouter/route'),
      import('./gemini/route'),
      import('./exaanswer/route')
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
    
    // Fetch models list if available
    // fetch('/api/models', options).catch(() => {});
    
    // Add more prefetch calls as needed for other API endpoints
    // that are commonly accessed and might benefit from caching
  } catch (error) {
    // Silently ignore prefetch errors
  }
}

// Main prefetch function that orchestrates all prefetching
export async function prefetchAll() {
  // Execute all prefetch operations in parallel
  return Promise.all([
    prefetchApiModules(),
    prefetchApiData()
  ]).catch(() => {
    // Silently catch errors - this is just optimization
  });
} 