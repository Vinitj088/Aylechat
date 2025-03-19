'use client';

import { useAuth } from '@/context/AuthContext';

export function LoginButton() {
  const { user, signOut, openAuthDialog } = useAuth();

  return user ? (
    <div className="flex items-center gap-2">
      <span className="text-sm">{user.email}</span>
      <button
        onClick={() => signOut()}
        className="bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-3 text-sm rounded"
      >
        Sign Out
      </button>
    </div>
  ) : (
    <button
      onClick={openAuthDialog}
      className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
    >
      Sign In
    </button>
  );
} 