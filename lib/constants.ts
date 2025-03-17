export const AUTH_CONFIG = {
  SESSION_EXPIRY: 30 * 24 * 60 * 60, // 30 days in seconds
  COOKIE_NAME: 'session_token',
  ROUTES: {
    HOME: '/',
    CHAT: '/chat',
    SETTINGS: '/settings',
    PROFILE: '/profile',
  },
  API: {
    AUTH: '/api/auth',
    EXA: '/api/exaanswer',
    GROQ: '/api/groq',
  },
} as const; 