"use client";

import React, { useEffect, useState, useCallback, memo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from "next/navigation";
import { useTheme } from 'next-themes';
import { ArrowLeft, User, Palette, Moon, Sun, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';

type SettingsTab = 'account' | 'appearance';

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const [rounded, setRounded] = useState(true);
  const [fontTheme, setFontTheme] = useState('default');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<SettingsTab>('account');
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
  const handleRoundedToggle = () => {
    setRounded(prev => {
      const newValue = !prev;
      localStorage.setItem('roundedCorners', newValue ? 'on' : 'off');
      document.documentElement.style.setProperty('--border-radius-default', newValue ? '0.75rem' : '0px');
      return newValue;
    });
  };

  const handleFontChange = (newFontTheme: string) => {
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

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push("/");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  if (!user) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen bg-[#F8F8F7] dark:bg-[#191a1a]">
        <div className="w-full max-w-md bg-white dark:bg-[#1f2121] rounded-2xl shadow-sm p-8 border border-[#E5E5E5] dark:border-[#2a2a2a] text-center">
          <h1 className="text-2xl font-semibold mb-4 text-[#13343B] dark:text-[#e7e7e2]">Settings</h1>
          <p className="text-[#64748B] mb-6">You must be signed in to access settings.</p>
          <button
            onClick={() => router.push("/")}
            className="px-6 py-2.5 bg-[#13343B] text-white rounded-lg hover:bg-[#0d2529] transition-colors font-medium"
          >
            Go Home
          </button>
        </div>
      </main>
    );
  }

  const tabs = [
    { id: 'account' as const, label: 'Account', icon: User },
    { id: 'appearance' as const, label: 'Appearance', icon: Palette },
  ];

  return (
    <main className="min-h-[100dvh] bg-[#F8F8F7] dark:bg-[#191a1a]">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-[#E5E5E5] dark:border-[#2a2a2a] bg-white dark:bg-[#191a1a]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-lg hover:bg-[#F5F5F5] dark:hover:bg-[#2a2a2a] text-[#64748B] hover:text-[#13343B] dark:hover:text-[#e7e7e2] transition-colors touch-manipulation"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-semibold text-[#13343B] dark:text-[#e7e7e2]">Settings</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex flex-col md:flex-row gap-6 md:gap-8">
          {/* Tab Navigation - Horizontal on mobile, Sidebar on desktop */}
          <nav className="md:w-48 flex-shrink-0">
            <ul className="flex md:flex-col gap-1 overflow-x-auto no-scrollbar pb-2 md:pb-0">
              {tabs.map((tab) => (
                <li key={tab.id} className="flex-shrink-0">
                  <button
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left whitespace-nowrap touch-manipulation",
                      activeTab === tab.id
                        ? "bg-[#F0F0ED] dark:bg-[#2a2a2a] text-[#13343B] dark:text-[#e7e7e2]"
                        : "text-[#64748B] hover:bg-[#F5F5F5] dark:hover:bg-[#2a2a2a] hover:text-[#13343B] dark:hover:text-[#e7e7e2]"
                    )}
                  >
                    <tab.icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {/* Right Content Area */}
          <div className="flex-1 min-w-0">
            {activeTab === 'account' && (
              <div className="space-y-6">
                {/* Account Info Card */}
                <div className="bg-white dark:bg-[#1f2121] rounded-xl border border-[#E5E5E5] dark:border-[#2a2a2a] p-4 sm:p-6">
                  <h2 className="text-lg font-semibold text-[#13343B] dark:text-[#e7e7e2] mb-4">Account</h2>

                  <div className="space-y-4">
                    {/* Email */}
                    <div className="flex items-center justify-between py-3 border-b border-[#E5E5E5] dark:border-[#2a2a2a]">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#13343B] dark:text-[#e7e7e2]">Email</p>
                        <p className="text-sm text-[#64748B] truncate">{user.email}</p>
                      </div>
                    </div>

                    {/* Sign Out */}
                    <div className="pt-2">
                      <button
                        onClick={handleSignOut}
                        className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors touch-manipulation"
                      >
                        Sign out
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'appearance' && (
              <div className="space-y-6">
                {/* Theme Card */}
                <div className="bg-white dark:bg-[#1f2121] rounded-xl border border-[#E5E5E5] dark:border-[#2a2a2a] p-4 sm:p-6">
                  <h2 className="text-lg font-semibold text-[#13343B] dark:text-[#e7e7e2] mb-4">Theme</h2>

                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    {mounted && (
                      <>
                        <button
                          onClick={() => setTheme('light')}
                          className={cn(
                            "flex flex-col items-center gap-2 p-3 sm:p-4 rounded-xl border-2 transition-all touch-manipulation",
                            theme === 'light'
                              ? "border-[#20B8CD] bg-[#F0FDFF] dark:bg-[#2a3a3a]"
                              : "border-[#E5E5E5] dark:border-[#2a2a2a] hover:border-[#C5C5C5] dark:hover:border-[#444]"
                          )}
                        >
                          <Sun className={cn("h-5 w-5 sm:h-6 sm:w-6", theme === 'light' ? "text-[#20B8CD]" : "text-[#64748B]")} />
                          <span className={cn("text-xs sm:text-sm font-medium", theme === 'light' ? "text-[#13343B] dark:text-[#e7e7e2]" : "text-[#64748B]")}>Light</span>
                        </button>

                        <button
                          onClick={() => setTheme('dark')}
                          className={cn(
                            "flex flex-col items-center gap-2 p-3 sm:p-4 rounded-xl border-2 transition-all touch-manipulation",
                            theme === 'dark'
                              ? "border-[#20B8CD] bg-[#F0FDFF] dark:bg-[#2a3a3a]"
                              : "border-[#E5E5E5] dark:border-[#2a2a2a] hover:border-[#C5C5C5] dark:hover:border-[#444]"
                          )}
                        >
                          <Moon className={cn("h-5 w-5 sm:h-6 sm:w-6", theme === 'dark' ? "text-[#20B8CD]" : "text-[#64748B]")} />
                          <span className={cn("text-xs sm:text-sm font-medium", theme === 'dark' ? "text-[#13343B] dark:text-[#e7e7e2]" : "text-[#64748B]")}>Dark</span>
                        </button>

                        <button
                          onClick={() => setTheme('system')}
                          className={cn(
                            "flex flex-col items-center gap-2 p-3 sm:p-4 rounded-xl border-2 transition-all touch-manipulation",
                            theme === 'system'
                              ? "border-[#20B8CD] bg-[#F0FDFF] dark:bg-[#2a3a3a]"
                              : "border-[#E5E5E5] dark:border-[#2a2a2a] hover:border-[#C5C5C5] dark:hover:border-[#444]"
                          )}
                        >
                          <Monitor className={cn("h-5 w-5 sm:h-6 sm:w-6", theme === 'system' ? "text-[#20B8CD]" : "text-[#64748B]")} />
                          <span className={cn("text-xs sm:text-sm font-medium", theme === 'system' ? "text-[#13343B] dark:text-[#e7e7e2]" : "text-[#64748B]")}>System</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Customization Card */}
                <div className="bg-white dark:bg-[#1f2121] rounded-xl border border-[#E5E5E5] dark:border-[#2a2a2a] p-4 sm:p-6">
                  <h2 className="text-lg font-semibold text-[#13343B] dark:text-[#e7e7e2] mb-4">Customization</h2>

                  <div className="space-y-4">
                    {/* Rounded Corners */}
                    <div className="flex items-center justify-between gap-4 py-3 border-b border-[#E5E5E5] dark:border-[#2a2a2a]">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[#13343B] dark:text-[#e7e7e2]">Rounded Corners</p>
                        <p className="text-xs sm:text-sm text-[#64748B]">Enable rounded corners throughout the interface</p>
                      </div>
                      <button
                        className={cn(
                          "relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#20B8CD] focus:ring-offset-2 touch-manipulation",
                          rounded ? 'bg-[#20B8CD]' : 'bg-[#E5E5E5] dark:bg-[#2a2a2a]'
                        )}
                        onClick={handleRoundedToggle}
                        disabled={loading}
                        aria-pressed={rounded}
                        aria-label="Toggle rounded corners"
                      >
                        <span
                          className={cn(
                            "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                            rounded ? 'translate-x-6' : 'translate-x-1'
                          )}
                        />
                      </button>
                    </div>

                    {/* Font Theme */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#13343B] dark:text-[#e7e7e2]">Font Theme</p>
                        <p className="text-xs sm:text-sm text-[#64748B]">Choose your preferred typography style</p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleFontChange('default')}
                          disabled={loading}
                          className={cn(
                            "px-3 sm:px-4 py-2 text-sm font-medium rounded-lg transition-colors touch-manipulation",
                            fontTheme === 'default'
                              ? "bg-[#13343B] text-white"
                              : "bg-[#F5F5F5] dark:bg-[#2a2a2a] text-[#64748B] hover:text-[#13343B] dark:hover:text-[#e7e7e2]"
                          )}
                        >
                          Default
                        </button>
                        <button
                          onClick={() => handleFontChange('alternative')}
                          disabled={loading}
                          className={cn(
                            "px-3 sm:px-4 py-2 text-sm font-medium rounded-lg transition-colors touch-manipulation",
                            fontTheme === 'alternative'
                              ? "bg-[#13343B] text-white"
                              : "bg-[#F5F5F5] dark:bg-[#2a2a2a] text-[#64748B] hover:text-[#13343B] dark:hover:text-[#e7e7e2]"
                          )}
                        >
                          Alternative
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
