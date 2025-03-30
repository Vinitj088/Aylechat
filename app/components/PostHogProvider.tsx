'use client';

import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { useEffect } from 'react';
import PostHogPageView from './PostHogPageView';

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Initialize PostHog
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY as string, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
      capture_pageview: false, // We'll manually capture pageviews
      loaded: (ph) => {
        if (process.env.NODE_ENV === 'development') {
          ph.debug();
        }
      },
    });
    
    // Identify the user if they are signed in
    const identifyUser = async () => {
      try {
        // Check if we have a user in session storage
        const supabaseSession = localStorage.getItem('supabase.auth.token');
        if (supabaseSession) {
          const session = JSON.parse(supabaseSession);
          const user = session?.currentSession?.user;
          
          if (user) {
            posthog.identify(user.id, {
              email: user.email,
              name: user.user_metadata?.name || user.email,
            });
          }
        }
      } catch (e) {
        // Fail silently if there's an error parsing the session
        console.error('Error identifying user for PostHog:', e);
      }
    };
    
    identifyUser();
    
    // Clean up
    return () => {
      // PostHog doesn't have a shutdown method
    };
  }, []);
  
  return (
    <PHProvider client={posthog}>
      <PostHogPageView />
      {children}
    </PHProvider>
  );
} 