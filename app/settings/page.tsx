"use client";

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const { user } = useAuth();
  const [rounded, setRounded] = useState(true);
  const [fontTheme, setFontTheme] = useState('default');
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // On mount, read from localStorage to set the initial state of the toggles
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedRounded = localStorage.getItem('roundedCorners');
      setRounded(storedRounded === 'on');

      const storedFontTheme = localStorage.getItem('fontTheme');
      setFontTheme(storedFontTheme === 'alternative' ? 'alternative' : 'default');
      
      setLoading(false);
    }
  }, []);

  // When toggled, update state, localStorage, and the CSS variable
  const handleToggle = () => {
    setRounded(prev => {
      const newValue = !prev;
      localStorage.setItem('roundedCorners', newValue ? 'on' : 'off');
      document.documentElement.style.setProperty('--border-radius-default', newValue ? '0.75rem' : '0px');
      return newValue;
    });
  };

  const handleFontChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newFontTheme = event.target.value;
    setFontTheme(newFontTheme);
    localStorage.setItem('fontTheme', newFontTheme);
    if (newFontTheme === 'alternative') {
      document.documentElement.style.setProperty("--font-body", "var(--font-sentient)");
      document.documentElement.style.setProperty("--font-heading", "var(--font-ppeditorial)");
    } else {
      document.documentElement.style.setProperty("--font-body", "var(--font-geist-sans)");
      document.documentElement.style.setProperty("--font-heading", "var(--font-space-grotesk)");
    }
  };

  if (!user) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen py-12 px-4">
        <div className="w-full max-w-xl bg-white dark:bg-[var(--secondary-darker)] rounded-lg shadow-lg p-8 border border-[var(--secondary-darkest)] text-center">
          <h1 className="text-2xl font-bold mb-6 text-[var(--text-light-default)]">Settings</h1>
          <p className="text-[var(--text-light-muted)]">You must be signed in to access settings.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen py-12 px-4">
      <div className="w-full max-w-xl bg-white dark:bg-[var(--secondary-darker)] rounded-lg shadow-lg p-8 border border-[var(--secondary-darkest)]">
        <button
          onClick={() => {
            if (window.history.length > 1) {
              router.back();
            } else {
              router.push("/");
            }
          }}
          className="mb-6 px-4 py-2 bg-[var(--secondary-darker)] text-[var(--text-light-default)] rounded hover:bg-[var(--secondary-darkest)] transition-colors"
        >
          ← Go Back
        </button>
        <h1 className="text-2xl font-bold mb-6 text-[var(--text-light-default)]">Settings</h1>
        <div className="space-y-6">
          {/* Rounded Corners Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-base text-[var(--text-light-default)] font-medium">Rounded Corners</span>
            <button
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${rounded ? 'bg-[var(--brand-default)]' : 'bg-gray-300'}`}
              onClick={handleToggle}
              disabled={loading}
              aria-pressed={rounded}
              aria-label="Toggle rounded corners"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${rounded ? 'translate-x-6' : 'translate-x-1'}`}
              />
            </button>
          </div>
          {/* Font Theme Selector */}
          <div className="flex items-center justify-between">
            <span className="text-base text-[var(--text-light-default)] font-medium">Font Theme</span>
            <select
              value={fontTheme}
              onChange={handleFontChange}
              disabled={loading}
              className="px-3 py-1.5 text-base text-[var(--text-light-default)] bg-transparent border border-[var(--secondary-darkest)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--brand-default)]"
              aria-label="Select font theme"
            >
              <option value="default" className="bg-[var(--secondary-darker)] text-[var(--text-light-default)]">Default</option>
              <option value="alternative" className="bg-[var(--secondary-darker)] text-[var(--text-light-default)]">Alternative</option>
            </select>
          </div>
        </div>
      </div>
    </main>
  );
} 