'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, Suspense } from 'react';
import { usePostHog } from 'posthog-js/react';

function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const posthog = usePostHog();

  // Track pageviews
  useEffect(() => {
    if (pathname && posthog) {
      let url = window.origin + pathname;
      
      if (searchParams.toString()) {
        url = url + `?${searchParams.toString()}`;
      }

      posthog.capture('$pageview', { 
        '$current_url': url,
        path: pathname
      });
    }
  }, [pathname, searchParams, posthog]);

  return null;
}

// Wrap this in Suspense to avoid the useSearchParams usage
// from de-opting the whole app into client-side rendering
export default function PostHogPageView() {
  return (
    <Suspense fallback={null}>
      <PageViewTracker />
    </Suspense>
  );
} 