import { AuthForm } from "../component/AuthForm";
import { UserProfile } from "../component/UserProfile";
import { getSession } from "@/lib/auth-utils";
import { clearAuthCookiesServerAction } from "@/lib/session-utils";
import { revalidatePath } from "next/cache";

export const dynamic = 'force-dynamic';

// Server action to clear cookies - this is allowed to modify cookies
async function clearSessionServerAction() {
  'use server';
  
  // Use our utility function to clear cookies in a server action
  await clearAuthCookiesServerAction();
  
  // Revalidate the path to ensure fresh data
  revalidatePath('/auth');
}

export default async function AuthPage({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined } }) {
  const session = await getSession();
  
  // Check if this page was accessed with the expired parameter
  const isExpired = searchParams.expired === 'true';
  
  // If expired or error parameter is present, we want to show the login form regardless of session
  if (isExpired) {
    // Instead of directly clearing cookies here, use the server action
    // This avoids the "Cookies can only be modified in a Server Action or Route Handler" error
    await clearSessionServerAction();
    
    // Force fresh session check
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-3xl font-bold mb-8 text-center">Account Management</h1>
        
        <div className="max-w-md mx-auto bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md">
          <AuthForm />
        </div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8 text-center">Account Management</h1>
      
      <div className="max-w-md mx-auto bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md">
        {session ? (
          <UserProfile />
        ) : (
          <AuthForm />
        )}
      </div>
    </div>
  );
} 