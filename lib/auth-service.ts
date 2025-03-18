import { cookies } from 'next/headers';
import { compare, hash } from 'bcrypt';
import { db } from './db';
import { AUTH_CONFIG } from './constants';
import { redirect } from 'next/navigation';
import { User, Session } from './types';

// Constants
const SALT_ROUNDS = 10;
const SESSION_EXPIRY_DAYS = 30;

// Cache for session data
let sessionCache: {
  session: Session | null;
  user: User | null;
  timestamp: number;
} | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

export class AuthService {
  // Sign up a new user
  async signup(email: string, password: string, name: string): Promise<User> {
    const hashedPassword = await hash(password, SALT_ROUNDS);
    
    // Check if user already exists
    const existingUser = await db
      .selectFrom('users')
      .where('email', '=', email)
      .select(['id'])
      .executeTakeFirst();

    if (existingUser) {
      throw new Error('User already exists');
    }

    const user = await db
      .insertInto('users')
      .values({
        email,
        password: hashedPassword,
        name,
        created_at: new Date(),
        updated_at: new Date()
      })
      .returning(['id', 'email', 'name'])
      .executeTakeFirst();

    if (!user) {
      throw new Error('Failed to create user');
    }

    return user;
  }

  // Login user
  async login(email: string, password: string): Promise<User> {
    const user = await db
      .selectFrom('users')
      .where('email', '=', email)
      .select(['id', 'email', 'password', 'name'])
      .executeTakeFirst();

    if (!user || !user.password) {
      throw new Error('Invalid credentials');
    }

    const isValid = await compare(password, user.password);
    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    // Return user without password
    return {
      id: user.id,
      email: user.email,
      name: user.name
    };
  }

  // Create a new session
  async createSession(userId: string): Promise<Session> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + SESSION_EXPIRY_DAYS);

    const session = await db
      .insertInto('sessions')
      .values({
        user_id: userId,
        expires_at: expiresAt,
        created_at: new Date()
      })
      .returning(['id', 'user_id as userId', 'expires_at as expiresAt'])
      .executeTakeFirst();

    if (!session) {
      throw new Error('Failed to create session');
    }

    // Set session cookie
    const cookieStore = cookies();
    cookieStore.set(AUTH_CONFIG.COOKIE_NAME, session.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt
    });

    // Update cache
    sessionCache = {
      session,
      user: null,
      timestamp: Date.now()
    };

    return session;
  }

  // Get current session with caching
  async getSession(): Promise<Session | null> {
    const cookieStore = cookies();
    const sessionId = cookieStore.get(AUTH_CONFIG.COOKIE_NAME)?.value;

    if (!sessionId) {
      return null;
    }

    // Check cache first
    if (sessionCache && Date.now() - sessionCache.timestamp < CACHE_DURATION) {
      // If session is about to expire (within 5 minutes), refresh it
      if (sessionCache.session && 
          sessionCache.session.expiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
        return this.refreshSession(sessionId);
      }
      return sessionCache.session;
    }

    const session = await db
      .selectFrom('sessions')
      .where('id', '=', sessionId)
      .where('expires_at', '>', new Date())
      .select(['id', 'user_id as userId', 'expires_at as expiresAt'])
      .executeTakeFirst();

    // Update cache
    sessionCache = {
      session: session || null,
      user: null,
      timestamp: Date.now()
    };

    return session || null;
  }

  // Refresh session if it's about to expire
  private async refreshSession(sessionId: string): Promise<Session | null> {
    const session = await db
      .selectFrom('sessions')
      .where('id', '=', sessionId)
      .where('expires_at', '>', new Date())
      .select(['id', 'user_id as userId', 'expires_at as expiresAt'])
      .executeTakeFirst();

    if (!session) {
      return null;
    }

    // Update session expiry
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + SESSION_EXPIRY_DAYS);

    await db
      .updateTable('sessions')
      .set({ expires_at: newExpiresAt })
      .where('id', '=', sessionId)
      .execute();

    // Update cookie
    const cookieStore = cookies();
    cookieStore.set(AUTH_CONFIG.COOKIE_NAME, sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: newExpiresAt
    });

    // Update cache
    sessionCache = {
      session: { ...session, expiresAt: newExpiresAt },
      user: sessionCache?.user || null,
      timestamp: Date.now()
    };

    return { ...session, expiresAt: newExpiresAt };
  }

  // Get current user with caching
  async getUser(): Promise<User | null> {
    // Check cache first
    if (sessionCache && Date.now() - sessionCache.timestamp < CACHE_DURATION) {
      return sessionCache.user;
    }

    const session = await this.getSession();
    if (!session) {
      return null;
    }

    const user = await db
      .selectFrom('users')
      .where('id', '=', session.userId)
      .select(['id', 'email', 'name'])
      .executeTakeFirst();

    // Update cache
    sessionCache = {
      session,
      user: user || null,
      timestamp: Date.now()
    };

    return user || null;
  }

  // Logout user
  async logout(): Promise<void> {
    const cookieStore = cookies();
    const sessionId = cookieStore.get(AUTH_CONFIG.COOKIE_NAME)?.value;

    if (sessionId) {
      try {
        // Get user ID from session before deleting it
        const session = await db
          .selectFrom('sessions')
          .where('id', '=', sessionId)
          .select(['user_id'])
          .executeTakeFirst();

        // Delete current session
        await db
          .deleteFrom('sessions')
          .where('id', '=', sessionId)
          .execute();

        // Optionally, delete all sessions for this user for complete logout
        if (session?.user_id) {
          await db
            .deleteFrom('sessions')
            .where('user_id', '=', session.user_id)
            .execute();
        }
      } catch (error) {
        console.error('Error deleting sessions:', error);
      }

      // Delete session cookie
      cookieStore.delete(AUTH_CONFIG.COOKIE_NAME);
    }

    // Clear cache
    sessionCache = null;

    // Return success response instead of redirecting
    return;
  }

  // Check if user is authenticated
  async isAuthenticated(): Promise<boolean> {
    const session = await this.getSession();
    return !!session;
  }
}

export const authService = new AuthService(); 