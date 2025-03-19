'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

// Update the component to accept props
interface AuthDialogProps {
  isOpen?: boolean;
  onClose?: () => void;
  onSuccess?: () => void;
}

export function AuthDialog({ isOpen, onClose, onSuccess }: AuthDialogProps) {
  const [isSignIn, setIsSignIn] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isFixingSession, setIsFixingSession] = useState(false);
  
  const { signIn, signUp, isAuthDialogOpen, closeAuthDialog } = useAuth();

  // Determine if dialog should be open based on prop or context
  const shouldBeOpen = isOpen !== undefined ? isOpen : isAuthDialogOpen;
  // Use provided onClose or fallback to context
  const handleClose = onClose || closeAuthDialog;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsLoading(true);
    
    try {
      if (isSignIn) {
        const { error, success } = await signIn(email, password);
        if (error) {
          setError(error.message);
        } else if (success) {
          setSuccessMessage('Signed in successfully!');
          setTimeout(() => {
            handleClose();
            // Call onSuccess if provided
            if (onSuccess) onSuccess();
          }, 1500);
        }
      } else {
        const { error, success } = await signUp(email, password, name);
        if (error) {
          setError(error.message);
        } else if (success) {
          setSuccessMessage('Signed up successfully! You can now sign in with your new account.');
          setTimeout(() => {
            // Switch to sign in mode after successful signup
            setIsSignIn(true);
          }, 2000);
        }
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFixSession = async () => {
    setIsFixingSession(true);
    setError(null);
    
    try {
      const response = await fetch('/api/fix-session', {
        method: 'POST',
        credentials: 'include',
      });
      
      if (response.ok) {
        const result = await response.json();
        toast.success('Session cookies cleared', {
          description: 'Please sign in again to get a fresh session'
        });
        setSuccessMessage('Session cookies cleared. Please sign in again.');
      } else {
        setError('Could not fix session cookies');
      }
    } catch (err) {
      setError('An error occurred while fixing the session');
      console.error('Error fixing session:', err);
    } finally {
      setIsFixingSession(false);
    }
  };

  if (!shouldBeOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div className="bg-[#fffdf5] border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-none p-6 max-w-md w-full">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">
            {isSignIn ? 'Sign In' : 'Sign Up'}
          </h2>
          <button 
            onClick={handleClose}
            className="p-1.5 rounded-md hover:bg-[#f5f3e4] border border-black"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="bg-red-100 border-2 border-red-400 text-red-700 px-4 py-3 mb-4">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="bg-green-100 border-2 border-green-400 text-green-700 px-4 py-3 mb-4">
            {successMessage}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {!isSignIn && (
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="name">
                Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="appearance-none border-2 border-black rounded-none w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                required
              />
            </div>
          )}
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="appearance-none border-2 border-black rounded-none w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              required
            />
          </div>
          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="appearance-none border-2 border-black rounded-none w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              required
              minLength={6}
            />
          </div>
          <div className="flex items-center justify-between mb-4">
            <button
              type="submit"
              disabled={isLoading}
              className={`px-4 py-2 text-sm font-medium text-white bg-black border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all ${
                isLoading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {isLoading 
                ? 'Loading...' 
                : isSignIn 
                  ? 'Sign In' 
                  : 'Sign Up'}
            </button>
            <button
              type="button"
              onClick={() => setIsSignIn(!isSignIn)}
              className="text-sm font-medium text-black hover:underline"
            >
              {isSignIn ? 'Need an account?' : 'Already have an account?'}
            </button>
          </div>
          
          {/* Session fix section
          <div className="pt-4 mt-4 border-t-2 border-black">
            <p className="text-sm text-gray-700 mb-2">
              Having trouble signing in? Try fixing your session:
            </p>
            <button
              type="button"
              onClick={handleFixSession}
              disabled={isFixingSession}
              className="w-full px-4 py-2 text-sm font-medium bg-[#f5f3e4] border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all"
            >
              {isFixingSession ? 'Fixing...' : 'Fix Session Issues'}
            </button>
          </div> */}
        </form>
      </div>
    </div>
  );
} 