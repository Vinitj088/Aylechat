"use client";

import React from "react";
import { useAuth } from '@/context/AuthContext';
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function UserProfile() {
  const { user, session, isLoading, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  if (isLoading) {
    return <div className="p-4">Loading profile...</div>;
  }

  if (!session || !user) {
    return (
      <div className="p-4">
        <p>You are not signed in.</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="mb-4">
        <h2 className="text-xl font-semibold">Welcome, {user.user_metadata?.name || user.email}</h2>
        <p className="text-gray-600">Email: {user.email}</p>
      </div>

      <button
        onClick={handleSignOut}
        className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
      >
        Sign Out
      </button>
    </div>
  );
} 