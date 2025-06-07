'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { FcGoogle } from 'react-icons/fc';

// Update the component to accept props
interface AuthDialogProps {
  isOpen?: boolean;
  onClose?: () => void;
  onSuccess?: () => void;
}

export function AuthDialog({ isOpen, onClose, onSuccess }: AuthDialogProps) {
  const [isSignIn, setIsSignIn] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const router = useRouter();
  
  const { 
    signIn, 
    signUp, 
    isAuthDialogOpen, 
    closeAuthDialog, 
    resetPassword,
    signInWithGoogle
  } = useAuth();

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
      if (isForgotPassword) {
        // Handle forgot password flow
        const result = await resetPassword(email);
        if (result.error) {
          setError(result.error.message);
        } else {
          setSuccessMessage(`Password reset email sent to ${email}. Please check your inbox.`);
          toast.success('Password reset email sent!');
        }
      } else if (isSignIn) {
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

  // Handle back button for forgot password flow
  const handleBack = () => {
    setIsForgotPassword(false);
    setError(null);
    setSuccessMessage(null);
  };

  if (!shouldBeOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div className="fixed inset-0 bg-black/40 dark:bg-black/60" onClick={handleClose}></div>
      <div className="bg-[var(--secondary-faint)] dark:bg-[var(--secondary-default)] border-2 border-[var(--secondary-darkest)] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)] rounded-none p-6 max-w-md w-full relative z-10">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-[var(--text-light-default)]">
            {isForgotPassword 
              ? 'Reset Password'
              : isSignIn ? 'Sign In' : 'Sign Up'}
          </h2>
          <button 
            onClick={handleClose}
            className="p-1.5 rounded-md hover:bg-[var(--secondary-darker)] border border-[var(--secondary-darkest)] text-[var(--text-light-default)]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="bg-red-100 dark:bg-red-900/30 border-2 border-red-400 dark:border-red-500 text-red-700 dark:text-red-300 px-4 py-3 mb-4">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="bg-green-100 dark:bg-green-900/30 border-2 border-green-400 dark:border-green-500 text-green-700 dark:text-green-300 px-4 py-3 mb-4">
            {successMessage}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {isForgotPassword ? (
            <>
              <p className="text-[var(--text-light-default)] mb-4">
                Enter your email address and we&apos;ll send you a link to reset your password.
              </p>
              <div className="mb-6">
                <label className="block text-[var(--text-light-default)] text-sm font-bold mb-2" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none border-2 border-[var(--secondary-darkest)] dark:bg-[var(--secondary-darker)] rounded-none w-full py-2 px-3 text-[var(--text-light-default)] leading-tight focus:outline-none focus:border-[var(--brand-default)]"
                  required
                />
              </div>
              <div className="flex items-center justify-between mb-4">
                <button
                  type="button"
                  onClick={handleBack}
                  className="text-sm font-medium text-[var(--brand-default)] hover:underline"
                >
                  Back to Sign In
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className={`px-4 py-2 text-sm font-medium text-white bg-[var(--brand-default)] border-2 border-[var(--secondary-darkest)] shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,0.2)] hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[1px_1px_0px_0px_rgba(255,255,255,0.2)] transition-all ${
                    isLoading ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {isLoading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </div>
            </>
          ) : (
            <>
              {!isSignIn && (
                <div className="mb-4">
                  <label className="block text-[var(--text-light-default)] text-sm font-bold mb-2" htmlFor="name">
                    Name
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="appearance-none border-2 border-[var(--secondary-darkest)] dark:bg-[var(--secondary-darker)] rounded-none w-full py-2 px-3 text-[var(--text-light-default)] leading-tight focus:outline-none focus:border-[var(--brand-default)]"
                    required
                  />
                </div>
              )}
              <div className="mb-4">
                <label className="block text-[var(--text-light-default)] text-sm font-bold mb-2" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none border-2 border-[var(--secondary-darkest)] dark:bg-[var(--secondary-darker)] rounded-none w-full py-2 px-3 text-[var(--text-light-default)] leading-tight focus:outline-none focus:border-[var(--brand-default)]"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-[var(--text-light-default)] text-sm font-bold mb-2" htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none border-2 border-[var(--secondary-darkest)] dark:bg-[var(--secondary-darker)] rounded-none w-full py-2 px-3 text-[var(--text-light-default)] leading-tight focus:outline-none focus:border-[var(--brand-default)]"
                  required
                  minLength={6}
                />
                {isSignIn && (
                  <div className="mt-1 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setIsForgotPassword(true);
                        setError(null);
                        setSuccessMessage(null);
                      }}
                      className="text-xs font-medium text-[var(--brand-default)] hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between mb-4">
                <button
                  type="submit"
                  disabled={isLoading}
                  className={`px-4 py-2 text-sm font-medium text-white bg-[var(--brand-default)] dark:bg-[var(--brand-fainter)] border-2 border-[var(--secondary-darkest)] shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,0.2)] hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[1px_1px_0px_0px_rgba(255,255,255,0.2)] transition-all ${
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
                  onClick={() => {
                    setIsSignIn(!isSignIn);
                    setError(null);
                    setSuccessMessage(null);
                  }}
                  className="text-sm font-medium text-[var(--brand-default)] hover:underline"
                >
                  {isSignIn ? 'Need an account?' : 'Already have an account?'}
                </button>
              </div>

              {/* Google Sign-In Button and Divider */}
              <div className="relative flex items-center my-6">
                <div className="flex-grow border-t border-[var(--secondary-darkest)]"></div>
                <span className="flex-shrink mx-4 text-xs text-[var(--text-light-muted)]">OR</span>
                <div className="flex-grow border-t border-[var(--secondary-darkest)]"></div>
              </div>

              <button
                type="button"
                onClick={signInWithGoogle}
                disabled={isLoading}
                className={`w-full flex items-center justify-center px-4 py-2 text-sm font-medium text-[var(--text-light-default)] bg-white dark:bg-[var(--secondary-darker)] border-2 border-[var(--secondary-darkest)] shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,0.2)] hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[1px_1px_0px_0px_rgba(255,255,255,0.2)] transition-all ${
                  isLoading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <FcGoogle className="mr-2 h-4 w-4" />
                Sign in with Google
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
} 