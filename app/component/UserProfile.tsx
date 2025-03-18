"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/lib/constants";

export function UserProfile() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push(ROUTES.HOME);
  };

  if (status === "loading") {
    return <div className="p-4">Loading profile...</div>;
  }

  if (status === "unauthenticated" || !session?.user) {
    return (
      <div className="p-4">
        <p>You are not signed in.</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="mb-4">
        <h2 className="text-xl font-semibold">Welcome, {session.user.name || session.user.email}</h2>
        <p className="text-gray-600">Email: {session.user.email}</p>
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