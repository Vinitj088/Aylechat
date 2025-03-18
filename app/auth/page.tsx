import { AuthForm } from "../component/AuthForm";
import { UserProfile } from "../component/UserProfile";
import { getSession } from "@/lib/auth-utils";
import { cookies } from "next/headers";

export const dynamic = 'force-dynamic';

export default async function AuthPage({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined } }) {
  const session = await getSession();
  
  // Check if this page was accessed with the expired parameter
  const isExpired = searchParams.expired === 'true';
  
  // If expired or error parameter is present, we want to show the login form regardless of session
  if (isExpired) {
    // Clear any cookies on the server as well
    const cookieStore = cookies();
    const cookiesToClear = [
      'next-auth.session-token',
      '__Secure-next-auth.session-token',
      '__Host-next-auth.session-token',
      'next-auth.csrf-token',
      'next-auth.callback-url',
      'session_token'
    ];
    
    for (const name of cookiesToClear) {
      cookieStore.delete(name);
    }
    
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