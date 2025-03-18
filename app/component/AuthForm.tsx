"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { useSearchParams } from "next/navigation";

export function AuthForm() {
  const { signIn, signUp, error, isLoading } = useAuth();
  const [view, setView] = useState<'login' | 'register'>('login');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: ''
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  
  const searchParams = useSearchParams();
  
  // Handle expired sessions
  useEffect(() => {
    const expired = searchParams?.get('expired');
    const errorParam = searchParams?.get('error');
    
    // If redirected here after logout, clear cookies one more time
    if (expired === 'true' || errorParam) {
      setSessionExpired(true);
      
      // Client-side cleanup again for good measure
      document.cookie.split(';').forEach(c => {
        const cookie = c.trim();
        const eqPos = cookie.indexOf('=');
        const name = eqPos > -1 ? cookie.substring(0, eqPos) : cookie;
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
      });
      
      // Clear storage
      localStorage.clear();
      sessionStorage.clear();
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Reset form errors
    setFormError(null);

    try {
      // Validate form
      if (!formData.email || !formData.password) {
        setFormError('Email and password are required');
        return;
      }

      if (view === 'register' && !formData.name) {
        setFormError('Name is required');
        return;
      }

      // Handle login or registration
      let success;
      
      if (view === 'login') {
        success = await signIn({
          email: formData.email,
          password: formData.password
        });
      } else {
        success = await signUp({
          email: formData.email,
          password: formData.password,
          name: formData.name
        });
      }

      if (success) {
        // Allow time for auth state to update
        setTimeout(() => {
          window.location.href = '/';
        }, 200);
      }
    } catch (err) {
      setFormError('An unexpected error occurred');
      console.error(err);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div>
      {sessionExpired && (
        <div className="mb-6 p-3 bg-yellow-50 border border-yellow-200 rounded-md text-yellow-800">
          Your session has been signed out. Please sign in again.
        </div>
      )}
      
      <div className="flex justify-center mb-6">
        <div className="flex border border-black rounded-lg overflow-hidden">
          <button
            className={`px-4 py-2 ${view === 'login' ? 'bg-black text-white' : 'bg-white text-black'}`}
            onClick={() => setView('login')}
          >
            Login
          </button>
          <button
            className={`px-4 py-2 ${view === 'register' ? 'bg-black text-white' : 'bg-white text-black'}`}
            onClick={() => setView('register')}
          >
            Register
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {view === 'register' && (
          <div className="mb-4">
            <label htmlFor="name" className="block text-sm font-medium mb-1">
              Name
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full p-2 border border-black rounded-md"
              placeholder="Your name"
            />
          </div>
        )}

        <div className="mb-4">
          <label htmlFor="email" className="block text-sm font-medium mb-1">
            Email
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className="w-full p-2 border border-black rounded-md"
            placeholder="you@example.com"
          />
        </div>

        <div className="mb-6">
          <label htmlFor="password" className="block text-sm font-medium mb-1">
            Password
          </label>
          <input
            type="password"
            id="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            className="w-full p-2 border border-black rounded-md"
            placeholder="••••••••"
          />
        </div>

        {(formError || error) && (
          <div className="mb-4 p-2 text-red-500 border border-red-200 rounded">
            {formError || error}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2 px-4 bg-black hover:bg-gray-800 text-white rounded-md transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] border-2 border-black disabled:opacity-50"
        >
          {isLoading ? 'Processing...' : view === 'login' ? 'Sign In' : 'Sign Up'}
        </button>
      </form>
    </div>
  );
} 