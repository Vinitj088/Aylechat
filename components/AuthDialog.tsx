import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { FcGoogle } from 'react-icons/fc';
import { X, Mail, Loader2 } from 'lucide-react';
import { FaApple } from 'react-icons/fa';

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
    <div className="fixed inset-0 z-50 bg-[#F8F8F7] dark:bg-[#0F1516]">
      {/* Close button in top right */}
      <button
        onClick={handleClose}
        className="absolute top-4 right-4 p-2 rounded-full hover:bg-[#E8E8E5] dark:hover:bg-[#1A2426] text-[#64748B] transition-colors"
        aria-label="Close"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Centered content */}
      <div className="flex items-center justify-center min-h-screen px-4">
        {!sentEmail ? (
          <EmailStep
            onSubmit={handleEmailSubmit}
            onGoogleSignIn={handleGoogleSignIn}
            isLoading={isLoading}
            error={error}
            isProcessingProfile={isProcessingProfile}
          />
        ) : (
          <CodeStep
            sentEmail={sentEmail}
            onSubmit={handleCodeSubmit}
            isLoading={isLoading || isProcessingProfile}
            onBack={() => setSentEmail("")}
            error={error}
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
  isLoading,
  error,
  isProcessingProfile,
}: {
  onSubmit: (email: string, firstName: string) => void;
  onGoogleSignIn: () => void;
  isLoading: boolean;
  error: string | null;
  isProcessingProfile: boolean;
}) {
  const emailInputRef = React.useRef<HTMLInputElement>(null);
  const [email, setEmail] = React.useState('');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const emailValue = emailInputRef.current!.value;
    // Use email prefix as firstName for simplicity (like Perplexity)
    const firstName = emailValue.split('@')[0];
    onSubmit(emailValue, firstName);
  };

  const isEmailValid = email.includes('@') && email.includes('.');

  return (
    <div className="w-full max-w-md">
      {/* Header - Perplexity style with serif italic */}
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl text-[#13343B] dark:text-[#F8F8F7] mb-2">
          Sign up below to <em className="font-serif italic">unlock</em> the full
        </h1>
        <h1 className="text-3xl md:text-4xl text-[#13343B] dark:text-[#F8F8F7]">
          potential of Ayle
        </h1>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm text-center">
          {error}
        </div>
      )}

      {/* Processing Profile Message */}
      {isProcessingProfile && (
        <div className="mb-4 p-3 bg-[#F8F8F7] dark:bg-[#1A2426] border border-[#E5E5E5] dark:border-[#333] rounded-lg text-[#13343B] dark:text-[#F8F8F7] text-sm text-center flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Setting up your profile...
        </div>
      )}

      {/* OAuth Buttons - Inky Blue background */}
      <div className="space-y-3 mb-6">
        {/* Google Button */}
        <button
          type="button"
          onClick={onGoogleSignIn}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-[#13343B] dark:bg-[#F8F8F7] text-white dark:text-[#13343B] rounded-lg font-medium hover:bg-[#0d2529] dark:hover:bg-[#E8E8E5] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FcGoogle className="h-5 w-5 bg-white rounded-full p-0.5" />
          Continue with Google
        </button>

        {/* Apple Button (placeholder - not functional) */}
        <button
          type="button"
          disabled={true}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-[#13343B] dark:bg-[#F8F8F7] text-white dark:text-[#13343B] rounded-lg font-medium opacity-50 cursor-not-allowed"
          title="Apple sign-in coming soon"
        >
          <FaApple className="h-5 w-5" />
          Continue with Apple
        </button>
      </div>

      {/* Divider */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[#E5E5E5] dark:border-[#333]"></div>
        </div>
      </div>

      {/* Email Form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          ref={emailInputRef}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email"
          required
          autoFocus
          className="w-full px-4 py-3 bg-[#F0F0ED] dark:bg-[#1A2426] border border-[#E5E5E5] dark:border-[#333] rounded-lg text-[#13343B] dark:text-[#F8F8F7] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#20B8CD] focus:border-transparent"
        />

        <button
          type="submit"
          disabled={isLoading || !isEmailValid}
          className={`w-full px-4 py-3 rounded-lg font-medium transition-all ${
            isEmailValid
              ? 'bg-[#E8E8E5] dark:bg-[#2A3638] text-[#13343B] dark:text-[#F8F8F7] hover:bg-[#DEDEDE] dark:hover:bg-[#333]'
              : 'bg-[#F0F0ED] dark:bg-[#1A2426] text-[#94A3B8] cursor-not-allowed'
          } disabled:opacity-50`}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Sending...
            </span>
          ) : (
            'Continue with email'
          )}
        </button>
      </form>

      {/* Note about adblocker */}
      <p className="mt-4 text-xs text-[#64748B] text-center">
        If Google sign-in is not working, try disabling your adblocker.
      </p>
    </div>
  );
}

function CodeStep({
  sentEmail,
  onSubmit,
  isLoading,
  onBack,
  error,
}: {
  sentEmail: string;
  onSubmit: (code: string) => void;
  isLoading: boolean;
  onBack: () => void;
  error: string | null;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [code, setCode] = React.useState('');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit(code);
  };

  return (
    <div className="w-full max-w-md">
      {/* Card Container - Perplexity style */}
      <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl shadow-lg border border-[#E5E5E5] dark:border-[#333] p-8">
        {/* Email Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 rounded-full bg-[#F0F0ED] dark:bg-[#2A2A2A] flex items-center justify-center">
            <Mail className="h-6 w-6 text-[#64748B]" />
          </div>
        </div>

        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-semibold text-[#13343B] dark:text-[#F8F8F7] mb-2">
            Check your email
          </h2>
          <p className="text-[#64748B] text-sm">
            A temporary sign-in link has been sent to your email address.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        {/* Code Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            ref={inputRef}
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter Code"
            required
            autoFocus
            className="w-full px-4 py-3 bg-[#F0F0ED] dark:bg-[#2A2A2A] border border-[#E5E5E5] dark:border-[#333] rounded-lg text-[#13343B] dark:text-[#F8F8F7] placeholder:text-[#94A3B8] font-mono text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-[#20B8CD] focus:border-transparent"
          />

          <button
            type="submit"
            disabled={isLoading || !code.trim()}
            className={`w-full px-4 py-3 rounded-lg font-medium transition-all ${
              code.trim()
                ? 'bg-[#20B8CD] text-white hover:bg-[#1AA3B6]'
                : 'bg-[#E8E8E5] dark:bg-[#2A2A2A] text-[#94A3B8] cursor-not-allowed'
            } disabled:opacity-50`}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Verifying...
              </span>
            ) : (
              'Continue'
            )}
          </button>
        </form>

        {/* Back Link */}
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={onBack}
            disabled={isLoading}
            className="text-sm text-[#64748B] hover:text-[#13343B] dark:hover:text-[#F8F8F7] transition-colors disabled:opacity-50"
          >
            Use a different email
          </button>
        </div>
      </div>
    </div>
  );
}