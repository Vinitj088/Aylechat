'use client';

import { usePostHog } from 'posthog-js/react';
import { useAuth } from '@/context/AuthContext';

export function useAnalytics() {
  const posthog = usePostHog();
  const { user } = useAuth();
  
  const trackEvent = (eventName: string, properties: Record<string, any> = {}) => {
    if (!posthog) return;
    
    // Add user details if available
    if (user) {
      properties.user_id = user.id;
      properties.user_email = user.email;
    }
    
    // Track the event
    posthog.capture(eventName, properties);
  };
  
  const identifyUser = (userId: string, traits: Record<string, any> = {}) => {
    if (!posthog) return;
    posthog.identify(userId, traits);
  };
  
  return {
    trackEvent,
    identifyUser
  };
} 