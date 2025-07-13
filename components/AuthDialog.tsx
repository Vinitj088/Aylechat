import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { FcGoogle } from 'react-icons/fc';

interface AuthDialogProps {
  isOpen?: boolean;
  onClose?: () => void;
  onSuccess?: () => void;
}

// Declare global google type
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          prompt: () => void;
          renderButton: (element: HTMLElement, options: any) => void;
        };
      };
    };
  }
}

function AuthDialogContent({ isOpen, onClose, onSuccess }: AuthDialogProps) {
  const {
    user,
    isAuthDialogOpen,
    closeAuthDialog,
    sendMagicCode,
    signInWithMagicCode,
    signInWithIdToken,
    ensureUserProfile,
  } = useAuth();
  
  const [sentEmail, setSentEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProcessingProfile, setIsProcessingProfile] = useState(false);
  const hasProcessedProfile = useRef(false);
  const [nonce, setNonce] = useState('');

  useEffect(() => {
    setNonce(crypto.randomUUID());
  }, []);

  const handleClose = useCallback(() => {
    if (onClose) {
      onClose();
    } else {
      closeAuthDialog();
    }
    // Reset state on close
    setSentEmail("");
    setFirstName("");
    setError(null);
    setIsLoading(false);
    hasProcessedProfile.current = false;
    setIsProcessingProfile(false);
  }, [onClose, closeAuthDialog]);
  
  useEffect(() => {
    if (user && (firstName || sentEmail === 'google') && !hasProcessedProfile.current && !isProcessingProfile) {
      hasProcessedProfile.current = true;
      setIsProcessingProfile(true);
      
      ensureUserProfile(firstName)
        .then(() => {
          toast.success("Welcome! Your profile has been set up.");
          if (onSuccess) onSuccess();
          handleClose();
        })
        .catch((err) => {
          console.error("Failed to set up profile:", err);
          toast.error("Profile setup failed", { 
            description: "Your account was created but we couldn't set up your profile. You can update it later." 
          });
          // Still close the dialog since the user is signed in
          if (onSuccess) onSuccess();
          handleClose();
        })
        .finally(() => {
          setIsProcessingProfile(false);
        });
    }
  }, [user, firstName, sentEmail, ensureUserProfile, onSuccess, handleClose, isProcessingProfile]);

  const shouldBeOpen = isOpen !== undefined ? isOpen : isAuthDialogOpen;

  const handleEmailSubmit = async (email: string, fName: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await sendMagicCode(email);
      setSentEmail(email);
      setFirstName(fName);
      toast.success(`A login code has been sent to ${email}`);
    } catch (err: any) {
      const errorMessage = err.body?.message || "Failed to send magic code. Please try again.";
      setError(errorMessage);
      toast.error("Login Error", { description: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCodeSubmit = async (code: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await signInWithMagicCode(sentEmail, code);
      toast.success("Signed in successfully!");
      // Don't set loading to false here, let the profile processing effect handle it
    } catch (err: any) {
      const errorMessage = err.body?.message || "Invalid code. Please try again.";
      setError(errorMessage);
      toast.error("Login Error", { description: errorMessage });
      setIsLoading(false);
    }
  };

  const handleGoogleSuccess = async (response: any) => {
    setIsLoading(true);
    setError(null);
    try {
      if (!response.credential) {
        throw new Error("No credential returned from Google");
      }
      
      await signInWithIdToken({
        clientName: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_NAME!,
        idToken: response.credential,
        nonce: nonce,
      });
      
      setSentEmail('google'); // Mark as google sign in to trigger profile creation
      toast.success("Signed in with Google successfully!");
    } catch (err: any) {
      console.error("Google sign-in error:", err);
      const errorMessage = err.body?.message || err.message || "Google sign-in failed. Please try again.";
      setError(errorMessage);
      toast.error("Login Error", { description: errorMessage });
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    if (window.google && window.google.accounts) {
      try {
        window.google.accounts.id.initialize({
          client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
          callback: async (response: any) => {
            if (response.credential) {
              setIsLoading(true);
              setError(null);
              try {
                await signInWithIdToken({
                  clientName: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_NAME || 'Google',
                  idToken: response.credential,
                  nonce,
                });
                setSentEmail('google'); // Mark as google sign in to trigger profile creation
                toast.success('Signed in with Google successfully!');
              } catch (err: any) {
                setError('Google sign-in failed.');
                toast.error('Login Error', { description: err.body?.message || err.message || 'Google sign-in failed. Please try again.' });
              } finally {
                setIsLoading(false);
              }
            } else {
              setError('No credential returned from Google.');
              toast.error('Google sign-in unavailable', { description: 'No credential returned from Google.' });
            }
          },
          nonce: nonce,
          theme: 'filled_black', // Set dark theme for Google popup/button

        });
        window.google.accounts.id.prompt();
      } catch (err) {
        setError('Google sign-in initialization failed.');
        toast.error('Google sign-in unavailable', { description: 'Google sign-in initialization failed.' });
      }
    } else {
      setError('Google sign-in is not available. Please try again later.');
      toast.error('Google sign-in unavailable', { description: 'Google sign-in is not available. Please try again later.' });
    }
  };

  // Initialize Google Sign-In when component mounts
  useEffect(() => {
    if (shouldBeOpen && window.google && window.google.accounts) {
      window.google.accounts.id.initialize({
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
        callback: handleGoogleSuccess,
        nonce: nonce,
      });
    }
  }, [shouldBeOpen, nonce]);

  if (!shouldBeOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div className="bg-[var(--background)] dark:bg-[var(--background)] border-2 border-[var(--border)] shadow-sm rounded-[var(--radius)] p-6 max-w-md w-full relative z-10">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-[var(--foreground)]">
            {!sentEmail ? "Sign In or Sign Up" : "Enter Your Code"}
          </h2>
          <button 
            onClick={handleClose}
            className="p-1.5 rounded-md hover:bg-[var(--secondary)] border border-[var(--border)] text-[var(--foreground)]"
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

        {isProcessingProfile && (
          <div className="bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-400 dark:border-blue-500 text-blue-700 dark:text-blue-300 px-4 py-3 mb-4">
            Setting up your profile...
          </div>
        )}

        {!sentEmail ? (
          <EmailStep 
            onSubmit={handleEmailSubmit} 
            onGoogleSignIn={handleGoogleSignIn}
            isLoading={isLoading}
          />
        ) : (
          <CodeStep
            sentEmail={sentEmail}
            onSubmit={handleCodeSubmit}
            isLoading={isLoading || isProcessingProfile}
            onBack={() => setSentEmail("")}
          />
        )}
      </div>
    </div>
  );
}

export function AuthDialog({ isOpen, onClose, onSuccess }: AuthDialogProps) {
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  if (!googleClientId) {
    console.error("NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set.");
    // Render the dialog without Google Auth if the ID is missing
    return <AuthDialogContent isOpen={isOpen} onClose={onClose} onSuccess={onSuccess} />;
  }

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <AuthDialogContent isOpen={isOpen} onClose={onClose} onSuccess={onSuccess} />
    </GoogleOAuthProvider>
  );
}

function EmailStep({ 
  onSubmit, 
  onGoogleSignIn,
  isLoading
}: { 
  onSubmit: (email: string, firstName: string) => void;
  onGoogleSignIn: () => void;
  isLoading: boolean;
}) {
  const emailInputRef = React.useRef<HTMLInputElement>(null);
  const firstNameInputRef = React.useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const email = emailInputRef.current!.value;
    const firstName = firstNameInputRef.current!.value;
    onSubmit(email, firstName);
  };

  return (
    <div className="flex flex-col space-y-4">
      {/* Google Sign-In Warning */}
      <div className="bg-[var(--background)] dark:bg-[var(--background)] border-2 border-[var(--border)] shadow-sm rounded-[var(--radius)] p-4 max-w-md w-full relative z-10">
        ⚠️ If Google sign-in is not working, please disable your adblocker and refresh the page, then try again.
      </div>
      {/* Google Sign-In Button */}
      <button
        type="button"
        onClick={onGoogleSignIn}
        disabled={isLoading}
        className={`w-full flex items-center justify-center px-4 py-2 text-sm font-medium text-[var(--foreground)] bg-white dark:bg-[var(--secondary)] border-2 border-[var(--border)] shadow-sm hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-xs transition-all ${
          isLoading ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      >
        <FcGoogle className="mr-2 h-4 w-4" />
        Sign in with Google
      </button>

      <div className="relative flex py-2 items-center">
        <div className="flex-grow border-t border-gray-400"></div>
        <span className="flex-shrink mx-4 text-gray-400">OR</span>
        <div className="flex-grow border-t border-gray-400"></div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
        <p className="text-[var(--foreground)]">
          Enter your email, and we&apos;ll send you a verification code. We&apos;ll create an account for you if you don&apos;t already have one.
        </p>
        <div>
          <label className="block text-[var(--foreground)] text-sm font-bold mb-2" htmlFor="firstName">
            First Name
          </label>
          <input
            ref={firstNameInputRef}
            id="firstName"
            type="text"
            className="appearance-none border-2 border-[var(--border)] dark:bg-[var(--secondary)] rounded-[var(--radius)] w-full py-2 px-3 text-[var(--foreground)] leading-tight focus:outline-none focus:border-[var(--primary)]"
            placeholder="Enter your first name"
            required
          />
        </div>
        <div>
          <label className="block text-[var(--foreground)] text-sm font-bold mb-2" htmlFor="email">
            Email
          </label>
          <input
            ref={emailInputRef}
            id="email"
            type="email"
            className="appearance-none border-2 border-[var(--border)] dark:bg-[var(--secondary)] rounded-[var(--radius)] w-full py-2 px-3 text-[var(--foreground)] leading-tight focus:outline-none focus:border-[var(--primary)]"
            placeholder="Enter your email"
            required
            autoFocus
          />
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className={`w-full px-4 py-2 text-sm font-medium text-white bg-[var(--primary)] dark:bg-[var(--primary)] border-2 border-[var(--border)] shadow-sm hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-xs transition-all ${
            isLoading ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {isLoading ? 'Sending...' : 'Send Code'}
        </button>
      </form>
    </div>
  );
}

function CodeStep({ sentEmail, onSubmit, isLoading, onBack }: { sentEmail: string; onSubmit: (code: string) => void; isLoading: boolean; onBack: () => void; }) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const code = inputRef.current!.value;
    onSubmit(code);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
      <p className="text-[var(--foreground)]">
        We sent an email to <strong>{sentEmail}</strong>. Check your email and paste the code you see.
      </p>
      <div>
        <label className="block text-[var(--foreground)] text-sm font-bold mb-2" htmlFor="code">
          Verification Code
        </label>
        <input
          ref={inputRef}
          id="code"
          type="text"
          className="appearance-none border-2 border-[var(--border)] dark:bg-[var(--secondary)] rounded-[var(--radius)] w-full py-2 px-3 text-[var(--foreground)] leading-tight focus:outline-none focus:border-[var(--primary)]"
          placeholder="123456..."
          required
          autoFocus
        />
      </div>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          disabled={isLoading}
          className={`text-sm font-medium text-[var(--primary)] hover:underline ${
            isLoading ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          Back
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className={`px-4 py-2 text-sm font-medium text-white bg-[var(--primary)] dark:bg-[var(--primary)] border-2 border-[var(--border)] shadow-sm hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-xs transition-all ${
            isLoading ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {isLoading ? 'Verifying...' : 'Verify Code'}
        </button>
      </div>
    </form>
  );
}