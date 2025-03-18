import { db } from "@/lib/db";
import { hash } from "bcrypt";
import { NextRequest, NextResponse } from "next/server";
import { setupDatabase } from "@/lib/db-setup";

/**
 * Custom signup API route
 * 
 * This route creates user accounts in the database which are then used by NextAuth.
 * After successful signup, clients should authenticate through NextAuth's signIn.
 * 
 * For client-side components, use the useAuth hook's signUp method instead,
 * which handles both account creation and subsequent authentication.
 */

export const dynamic = 'force-dynamic';

// Ensure database tables exist - run this on every request to ensure tables are created
let dbSetupPromise: Promise<void> | null = null;

async function ensureDbSetup() {
  if (!dbSetupPromise) {
    dbSetupPromise = setupDatabase().catch(err => {
      console.error('💥 Database setup failed:', err);
      dbSetupPromise = null; // Reset so we can try again next time
      throw err;
    });
  }
  return dbSetupPromise;
}

export async function POST(request: NextRequest) {
  try {
    // Setup database before processing request
    await ensureDbSetup();
    
    console.log('📝 Processing signup request');
    
    const body = await request.json();
    const { email, password, name } = body;

    console.log(`📧 Signup attempt for email: ${email}`);

    if (!email || !password) {
      console.log('❌ Signup failed: Missing email or password');
      return NextResponse.json(
        { message: "Email and password are required" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await db
      .selectFrom("users")
      .where("email", "=", email)
      .select(["id"])
      .executeTakeFirst();

    if (existingUser) {
      console.log(`❌ Signup failed: User with email ${email} already exists`);
      return NextResponse.json(
        { message: "User already exists" },
        { status: 409 }
      );
    }

    // Hash password
    console.log('🔒 Hashing password');
    const hashedPassword = await hash(password, 10);

    // Create the user
    console.log('👤 Creating new user');
    const user = await db
      .insertInto("users")
      .values({
        email,
        password: hashedPassword,
        name,
        created_at: new Date(),
        updated_at: new Date()
      })
      .returning(["id", "email", "name"])
      .executeTakeFirst();

    if (!user) {
      console.error('❌ User creation failed: No user returned from insert query');
      throw new Error('Failed to create user');
    }

    console.log(`✅ User created successfully with ID: ${user.id}`);
    return NextResponse.json(
      { message: "User created successfully", user },
      { status: 201 }
    );
  } catch (error) {
    console.error("💥 Registration error:", error);
    
    // Check for specific error types
    const errorMessage = error instanceof Error 
      ? error.message 
      : "An error occurred during registration";
      
    return NextResponse.json(
      { message: errorMessage },
      { status: 500 }
    );
  }
} 