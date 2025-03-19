import React, { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

export function SessionFixer() {
  const [isFixing, setIsFixing] = useState(false);
  const supabase = createClient();

  const clearLocalStorage = () => {
    // Clear any Supabase-related items from localStorage
    Object.keys(localStorage).forEach(key => {
      if (key.includes('supabase') || key.includes('sb-') || key.includes('auth')) {
        localStorage.removeItem(key);
      }
    });
  };

  const handleFixSession = async () => {
    setIsFixing(true);
    
    try {
      // Clear localStorage first
      clearLocalStorage();
      
      // Try to refresh the client-side session first
      await supabase.auth.refreshSession();
      
      // Call the fix-session API
      const response = await fetch('/api/fix-session', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Get latest session client-side
        const { data: sessionData } = await supabase.auth.getSession();
        
        if (sessionData.session) {
          toast.success('Session fixed successfully!');
          
          // Add a small delay before reload to allow toast to show
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        } else {
          toast.error('Could not fix session. Please sign out and back in.');
          setTimeout(() => {
            window.location.href = '/?signIn=true';
          }, 1500);
        }
      } else {
        toast.error(`Could not fix session: ${data.error}`);
      }
    } catch (error) {
      console.error('Error fixing session:', error);
      toast.error('Could not fix session. Please sign out and back in.');
    } finally {
      setIsFixing(false);
    }
  };

  return (
    <Button
      onClick={handleFixSession}
      disabled={isFixing}
      className="w-full my-2 bg-yellow-500 hover:bg-yellow-600 text-black"
    >
      {isFixing ? 'Fixing...' : 'Fix Session Issues'}
    </Button>
  );
} 