// Import the Next.js middleware
import middlewareModule from './.next/server/middleware.js';

// Create a proper Cloudflare Worker with a default export
export default {
  async fetch(request, env, ctx) {
    try {
      // Set up the context for the middleware
      globalThis.process = {
        env: {
          ...env,
          NODE_ENV: 'production'
        }
      };

      // Run the Next.js middleware
      const response = await middlewareModule.middleware.run({
        request: request,
        env: env,
        context: ctx
      });

      return response || new Response('Not Found', { status: 404 });
    } catch (error) {
      console.error('Worker error:', error);
      return new Response('Server Error: ' + (error.message || 'Unknown error'), { 
        status: 500 
      });
    }
  }
}; 