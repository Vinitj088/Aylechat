// Routes configuration
export const ROUTES = {
  HOME: '/',
  CHAT: '/chat',
  SETTINGS: '/settings',
  PROFILE: '/profile',
  SIGN_IN: '/auth/signin',
  SIGN_UP: '/auth/signup',
  SIGN_OUT: '/auth/signout',
};

// Auth session configuration for Auth.js
export const AUTH_CONFIG = {
  ROUTES,
  SESSION_TOKEN_NAME: 'next-auth.session-token',
  CALLBACK_URL: '/',
  SESSION_EXPIRY: 30 * 24 * 60 * 60, // 30 days in seconds
  COOKIE_NAME: 'session_token',
  API: {
    AUTH: '/api/auth',
    EXA: '/api/exaanswer',
    GROQ: '/api/groq',
  },
} as const; 