'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';

export default function SignOutButton({ className = '' }: { className?: string }) {
  const [loading, setLoading] = useState(false);
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      setLoading(true);
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleSignOut}
      disabled={loading}
      variant="destructive"
      size="sm"
      className={className}
    >
      {loading ? 'Signing out...' : 'Sign out'}
    </Button>
  );
} 