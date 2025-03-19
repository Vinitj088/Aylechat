// Create a new file to handle auth session restoration
import { createClient } from '@/utils/supabase/client';
import { cookies } from 'next/headers';

export async function getAuthSession() {
  try {
    // Get cookies
    const cookieStore = cookies();
    const supabaseAuthToken = cookieStore.get('supabase.auth.token');
    const appUserId = cookieStore.get('app-user-id');
    
    console.log('Auth token cookie exists:', !!supabaseAuthToken);
    console.log('User ID cookie exists:', !!appUserId);
    
    if (!supabaseAuthToken?.value) {
      console.log('No supabase auth token found in cookies');
      return { session: null, error: new Error('No auth token') };
    }
    
    // Parse the token
    let tokenData;
    try {
      tokenData = JSON.parse(decodeURIComponent(supabaseAuthToken.value));
      console.log('Token data structure:', Object.keys(tokenData));
    } catch (e) {
      console.error('Failed to parse auth token:', e);
      return { session: null, error: new Error('Invalid auth token format') };
    }
    
    // Create client
    const supabase = createClient();
    
    // Set session manually from token data
    if (tokenData.data?.access_token && tokenData.data?.refresh_token) {
      console.log('Attempting to set session with tokens');
      const { data, error } = await supabase.auth.setSession({
        access_token: tokenData.data.access_token,
        refresh_token: tokenData.data.refresh_token,
      });
      
      if (error) {
        console.error('Error setting session:', error);
        return { session: null, error };
      }
      
      console.log('Session restored successfully');
      return { session: data.session, error: null };
    } else if (appUserId?.value) {
      // Fallback to using app-user-id if we can't restore the session properly
      console.log('Using fallback user ID from cookie');
      return { 
        session: {
          user: { id: appUserId.value },
          access_token: 'fallback-token'
        }, 
        error: null 
      };
    }
    
    return { session: null, error: new Error('Invalid token data structure') };
  } catch (error) {
    console.error('Auth session error:', error);
    return { session: null, error };
  }
}

export async function getUserIdFromCookies() {
  try {
    const cookieStore = cookies();
    const appUserId = cookieStore.get('app-user-id')?.value;
    
    if (!appUserId) {
      console.log('No user ID found in cookies');
      return { userId: null, error: new Error('No user ID found') };
    }
    
    console.log(`Found user ID in cookies: ${appUserId}`);
    return { userId: appUserId, error: null };
  } catch (error) {
    console.error('Error getting user ID from cookies:', error);
    return { userId: null, error };
  }
} 