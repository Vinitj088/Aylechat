import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";
import { setupDatabase } from "@/lib/db-setup";

// Create a singleton promise for database setup
let dbSetupPromise: Promise<void> | null = null;

async function ensureDbSetup() {
  console.log('🔑 NextAuth: Ensuring database is set up');
  if (!dbSetupPromise) {
    dbSetupPromise = setupDatabase().catch(err => {
      console.error('💥 NextAuth: Database setup failed:', err);
      dbSetupPromise = null; // Reset so we can try again next time
      throw err;
    });
  }
  return dbSetupPromise;
}

// Set up database tables before handling requests - don't block the route handler
ensureDbSetup().catch(error => {
  console.error('💥 Critical error setting up database for NextAuth:', error);
});

// Create the handler with strict error handling
const handler = NextAuth({
  ...authOptions,
  // Add extra error handling
  callbacks: {
    ...authOptions.callbacks,
    async signIn({ user, account, profile, email, credentials }) {
      try {
        // Make sure users table exists first
        await ensureDbSetup();
        // Default NextAuth behavior
        return true;
      } catch (error) {
        console.error("Error during sign in:", error);
        return false;
      }
    }
  }
});

export { handler as GET, handler as POST }; 