// Client-side auth service
import { AUTH_CONFIG } from './constants';

interface User {
  id: string;
  email: string;
  name?: string;
}

// Function to get cookie by name
export function getCookie(name: string): string | undefined {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return undefined;
}

// Function to set cookie
export function setCookie(name: string, value: string, days: number): void {
  const date = new Date();
  date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
  const expires = `expires=${date.toUTCString()}`;
  document.cookie = `${name}=${value}; ${expires}; path=/; SameSite=Lax`;
}

// Function to delete cookie
export function deleteCookie(name: string): void {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax`;
}

// Check if user has a session cookie
export function hasSessionCookie(): boolean {
  return !!getCookie(AUTH_CONFIG.COOKIE_NAME);
}

// Client-side auth service
export const clientAuth = {
  // Check if user is authenticated client-side
  isAuthenticated(): boolean {
    return hasSessionCookie();
  },

  // Store user data in localStorage
  storeUser(user: User): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('user', JSON.stringify(user));
    }
  },

  // Get user data from localStorage
  getUser(): User | null {
    if (typeof window !== 'undefined') {
      const userData = localStorage.getItem('user');
      if (userData) {
        try {
          return JSON.parse(userData);
        } catch (e) {
          console.error('Error parsing user data:', e);
        }
      }
    }
    return null;
  },

  // Clear user data from localStorage
  clearUser(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('user');
    }
  }
}; 