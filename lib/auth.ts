import { compare } from "bcrypt";
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "./db";
import { AUTH_CONFIG } from "./constants";

/**
 * NextAuth Configuration
 * 
 * This is the central configuration for NextAuth, which is the primary
 * authentication system used throughout the application. It defines:
 * 
 * 1. Authentication providers (credentials-based in this case)
 * 2. Session management strategy (JWT)
 * 3. Callback functions for custom authentication logic
 * 4. Custom pages for authentication flows
 * 
 * Client components should use the useAuth hook from lib/hooks/useAuth.ts
 * rather than accessing NextAuth directly.
 */

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          const user = await db
            .selectFrom("users")
            .where("email", "=", credentials.email)
            .select(["id", "email", "password", "name"])
            .executeTakeFirst();

          if (!user || !user.password) {
            return null;
          }

          const isValid = await compare(credentials.password, user.password);
          
          if (!isValid) {
            return null;
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name || undefined,
          };
        } catch (error) {
          console.error("Auth error in authorize:", error);
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string || undefined;
      }
      return session;
    },
    async signIn({ user }) {
      if (user) {
        // Successfully signed in - log for debugging
        console.log(`NextAuth: User signed in successfully: ${user.email}`);
      }
      return true;
    },
  },
  events: {
    async signOut({ token }) {
      console.log('NextAuth: User signed out, cleaning up sessions');
      
      // Delete from database if we have a token ID
      if (token?.id) {
        try {
          await db
            .deleteFrom('sessions')
            .where('user_id', '=', token.id as string)
            .execute();
          
          console.log(`NextAuth: Deleted sessions for user ${token.id}`);
        } catch (error) {
          console.error('NextAuth: Error deleting sessions:', error);
        }
      }
    }
  },
  pages: {
    signIn: "/auth",
    error: "/auth",
    signOut: "/auth",
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === "development",
}; 