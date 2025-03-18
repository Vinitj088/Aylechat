"use client";

import { useState } from "react";
import { useAuth } from "@/lib/hooks/useAuth";

type AuthFormProps = {
  onSuccess?: () => void;
};

export function AuthForm({ onSuccess }: AuthFormProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const { signIn, signUp, error, isLoading } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Clear any previous errors and attempt flags
      localStorage.removeItem('authAttempt');
      
      // Set an auth attempt flag to prevent duplicate submissions
      localStorage.setItem('authAttempt', 'true');
      
      let success = false;
      
      if (isSignUp) {
        const result = await signUp({ email, password, name });
        success = !!result;
      } else {
        const result = await signIn({ email, password });
        success = !!result;
      }
      
      if (success) {
        // Set a small delay to allow the auth state to fully update
        setTimeout(() => {
          // Clear auth attempt flag
          localStorage.removeItem('authAttempt');
          
          // Redirect or call success callback
          if (onSuccess) {
            onSuccess();
          } else {
            // Force a page refresh to update all auth state
            window.location.href = '/?auth=success&t=' + Date.now();
          }
        }, 200);
      }
    } catch (err) {
      console.error('Auth error:', err);
      localStorage.removeItem('authAttempt');
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="flex justify-center mb-4">
        <button
          onClick={() => setIsSignUp(false)}
          className={`px-4 py-2 ${
            !isSignUp ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500"
          }`}
        >
          Login
        </button>
        <button
          onClick={() => setIsSignUp(true)}
          className={`px-4 py-2 ${
            isSignUp ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500"
          }`}
        >
          Register
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {isSignUp && (
          <div>
            <label htmlFor="name" className="block text-sm font-medium">
              Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required={isSignUp}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
            />
          </div>
        )}

        <div>
          <label htmlFor="email" className="block text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
          />
        </div>

        {error && (
          <div className="text-red-500 text-sm mt-2">{error}</div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          {isLoading ? "Loading..." : isSignUp ? "Register" : "Login"}
        </button>
      </form>
    </div>
  );
} 