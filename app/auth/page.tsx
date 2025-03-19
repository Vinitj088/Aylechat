import { AuthForm } from "../component/AuthForm";
import { UserProfile } from "../component/UserProfile";
import { getSession } from "@/lib/auth-utils";
import { clearAuthCookiesServerAction } from "@/lib/session-utils";
import { revalidatePath } from "next/cache";
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

// Server action to clear cookies - this is allowed to modify cookies
async function clearSessionServerAction() {
  'use server';
  
  // Use our utility function to clear cookies in a server action
  await clearAuthCookiesServerAction();
  
  // Revalidate the path to ensure fresh data
  revalidatePath('/auth');
}

export default function AuthPage({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined } }) {
  // Check for query parameters to pass along to the homepage
  const params = new URLSearchParams();
  params.set('authRequired', 'true');
  
  // Add timestamp to prevent caching
  params.set('t', Date.now().toString());
  
  // Pass along any error or expired parameters
  if (searchParams.expired === 'true') {
    params.set('expired', 'true');
  }
  
  if (searchParams.error) {
    params.set('error', searchParams.error.toString());
  }
  
  // Redirect to homepage with auth dialog
  redirect(`/?${params.toString()}`);
} 