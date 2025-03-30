import { PostHog } from 'posthog-node';

export default function PostHogClient() {
  // Make sure to only create the client on the server
  if (typeof window !== 'undefined') {
    return null;
  }
  
  const posthogClient = new PostHog(
    process.env.NEXT_PUBLIC_POSTHOG_KEY || '',
    {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
      flushAt: 1, // Immediately send events
      flushInterval: 0 // Don't batch events
    }
  );
  
  return posthogClient;
} 