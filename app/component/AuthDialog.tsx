'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';

interface AuthDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onLogin?: (params: { email: string; password: string; redirect: boolean; }) => Promise<any>;
  onSignup?: (params: { email: string; password: string; name: string; }) => Promise<any>;
}

export default function AuthDialog({ isOpen, onClose, onSuccess, onLogin, onSignup }: AuthDialogProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSignIn = async () => {
    try {
      setIsLoading(true);
      setError(null);

      let result;

      if (onLogin) {
        result = await onLogin({
          email,
          password,
          redirect: false,
        });
      } else {
        result = await signIn('credentials', {
          email,
          password,
          redirect: false,
        });
      }

      if (result?.error) {
        setError('Invalid email or password');
        return;
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error('Sign in error:', err);
      setError('An error occurred during sign in');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (!email || !password || !name) {
        setError('All fields are required');
        return;
      }

      if (onSignup) {
        // Use provided signup function
        const result = await onSignup({
          email,
          password,
          name
        });

        if (result?.error) {
          setError(result.error || 'Failed to create account');
          return;
        }
      } else {
        // Register the user
        const response = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password, name }),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.message || 'Failed to create account');
          return;
        }
      }

      // Now sign in
      await handleSignIn();
    } catch (err) {
      console.error('Sign up error:', err);
      setError('An error occurred during sign up');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'signin') {
      await handleSignIn();
    } else {
      await handleSignUp();
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div className="bg-[#fffdf5] p-6 rounded-none border-3 border-black border-t border-l border-r border-b max-w-md w-full m-4 transform transition-transform hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">{mode === 'signin' ? 'Sign In' : 'Create Account'}</h2>
          <button
            onClick={onClose}
            className="text-black hover:text-gray-800 bg-[#f5f3e4] p-1.5 border-2 border-black rounded-none shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:translate-x-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex mb-6 border-b-2 border-black">
          <button
            onClick={() => setMode('signin')}
            className={`px-6 py-2 font-bold text-sm ${mode === 'signin'
                ? 'bg-[#254bf1] text-white border-2 border-[#254bf1] border-b-0'
                : 'text-black hover:bg-[#f5f3e4] border-2 border-transparent'
              }`}
          >
            SIGN IN
          </button>
          <button
            onClick={() => setMode('signup')}
            className={`px-6 py-2 font-bold text-sm ${mode === 'signup'
                ? 'bg-[#254bf1] text-white border-2 border-[#254bf1] border-b-0'
                : 'text-black hover:bg-[#f5f3e4] border-2 border-transparent'
              }`}
          >
            SIGN UP
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {mode === 'signup' && (
            <div className="transform transition-all hover:translate-x-[1px] hover:translate-y-[1px]">
              <label htmlFor="name" className="block text-sm font-bold mb-2">
                NAME
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-white border-2 border-black rounded-none focus:outline-none focus:ring-1 focus:ring-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                required={mode === 'signup'}
              />
            </div>
          )}

          <div className="transform transition-all hover:translate-x-[1px] hover:translate-y-[1px]">
            <label htmlFor="email" className="block text-sm font-bold mb-2">
              EMAIL
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-white border-2 border-black rounded-none focus:outline-none focus:ring-1 focus:ring-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
              required
            />
          </div>

          <div className="transform transition-all hover:translate-x-[1px] hover:translate-y-[1px]">
            <label htmlFor="password" className="block text-sm font-bold mb-2">
              PASSWORD
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-white border-2 border-black rounded-none focus:outline-none focus:ring-1 focus:ring-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
              required
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm font-bold p-3 border-2 border-red-600 bg-red-50 shadow-[3px_3px_0px_0px_rgba(255,0,0,0.5)]">
              {error}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full px-4 py-3 mt-4 bg-black text-white font-bold text-sm uppercase rounded-none border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] transition-all"
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  PROCESSING...
                </span>
              ) : (
                mode === 'signin' ? 'SIGN IN' : 'CREATE ACCOUNT'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 