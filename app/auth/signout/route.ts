import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

export async function POST(request: NextRequest) {
  const supabase = createClient();

  // Check if a user is logged in
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError) {
    console.error('Error getting user for signout:', userError);
  }

  if (user) {
    // Sign out the user
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error('Error signing out:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // Revalidate the home page
  revalidatePath('/', 'layout');
  
  // Redirect to the login page
  return NextResponse.redirect(new URL('/login', request.url));
} 