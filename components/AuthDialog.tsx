'use client';

import React, { useState, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

interface AuthDialogProps {
  isOpen?: boolean;
  onClose?: () => void;
  onSuccess?: () => void;
}

export function AuthDialog({ isOpen, onClose, onSuccess }: AuthDialogProps) {
  const {
    isAuthDialogOpen,
    closeAuthDialog,
    sendMagicCode,
    signInWithMagicCode,
  } = useAuth();
  
  const [sentEmail, setSentEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shouldBeOpen = isOpen !== undefined ? isOpen : isAuthDialogOpen;
  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      closeAuthDialog();
    }
    // Reset state on close
    setSentEmail("");
    setError(null);
    setIsLoading(false);
  };

  const handleEmailSubmit = async (email: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await sendMagicCode(email);
      setSentEmail(email);
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
      if (onSuccess) onSuccess();
      handleClose();
    } catch (err: any) {
      const errorMessage = err.body?.message || "Invalid code. Please try again.";
      setError(errorMessage);
      toast.error("Login Error", { description: errorMessage });
    } finally {
      setIsLoading(false);
    }
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
            {!sentEmail ? "Sign In or Sign Up" : "Enter Your Code"}
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

        {!sentEmail ? (
          <EmailStep onSubmit={handleEmailSubmit} isLoading={isLoading} />
        ) : (
          <CodeStep
            sentEmail={sentEmail}
            onSubmit={handleCodeSubmit}
            isLoading={isLoading}
            onBack={() => setSentEmail("")}
          />
        )}
      </div>
    </div>
  );
}

function EmailStep({ onSubmit, isLoading }: { onSubmit: (email: string) => void; isLoading: boolean }) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const email = inputRef.current!.value;
    onSubmit(email);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
      <p className="text-[var(--text-light-default)]">
        Enter your email, and we'll send you a verification code. We'll create an account for you if you don't already have one.
      </p>
      <div>
        <label className="block text-[var(--text-light-default)] text-sm font-bold mb-2" htmlFor="email">
          Email
        </label>
        <input
          ref={inputRef}
          id="email"
          type="email"
          className="appearance-none border-2 border-[var(--secondary-darkest)] dark:bg-[var(--secondary-darker)] rounded-none w-full py-2 px-3 text-[var(--text-light-default)] leading-tight focus:outline-none focus:border-[var(--brand-default)]"
          placeholder="Enter your email"
          required
          autoFocus
        />
      </div>
      <button
        type="submit"
        disabled={isLoading}
        className={`w-full px-4 py-2 text-sm font-medium text-white bg-[var(--brand-default)] dark:bg-[var(--brand-fainter)] border-2 border-[var(--secondary-darkest)] shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,0.2)] hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[1px_1px_0px_0px_rgba(255,255,255,0.2)] transition-all ${
          isLoading ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      >
        {isLoading ? 'Sending...' : 'Send Code'}
      </button>
    </form>
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
      <p className="text-[var(--text-light-default)]">
        We sent an email to <strong>{sentEmail}</strong>. Check your email and paste the code you see.
      </p>
      <div>
        <label className="block text-[var(--text-light-default)] text-sm font-bold mb-2" htmlFor="code">
          Verification Code
        </label>
        <input
          ref={inputRef}
          id="code"
          type="text"
          className="appearance-none border-2 border-[var(--secondary-darkest)] dark:bg-[var(--secondary-darker)] rounded-none w-full py-2 px-3 text-[var(--text-light-default)] leading-tight focus:outline-none focus:border-[var(--brand-default)]"
          placeholder="123456..."
          required
          autoFocus
        />
      </div>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="text-sm font-medium text-[var(--brand-default)] hover:underline"
        >
          Back
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className={`px-4 py-2 text-sm font-medium text-white bg-[var(--brand-default)] dark:bg-[var(--brand-fainter)] border-2 border-[var(--secondary-darkest)] shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,0.2)] hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[1px_1px_0px_0px_rgba(255,255,255,0.2)] transition-all ${
            isLoading ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {isLoading ? 'Verifying...' : 'Verify Code'}
        </button>
      </div>
    </form>
  );
}