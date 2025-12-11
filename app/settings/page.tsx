"use client";

import React, { useEffect, useState } from 'react';
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
      <main className="flex flex-col items-center justify-center min-h-screen bg-[#F8F8F7] dark:bg-[#0F1516]">
        <div className="w-full max-w-md bg-white dark:bg-[#1A1A1A] rounded-2xl shadow-sm p-8 border border-[#E5E5E5] dark:border-[#333] text-center">
          <h1 className="text-2xl font-semibold mb-4 text-[#13343B] dark:text-[#F8F8F7]">Settings</h1>
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
    <main className="min-h-screen bg-[#F8F8F7] dark:bg-[#0F1516]">
      {/* Header */}
      <div className="border-b border-[#E5E5E5] dark:border-[#2A3638] bg-white dark:bg-[#0F1516]">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-lg hover:bg-[#F5F5F5] dark:hover:bg-[#1A2426] text-[#64748B] hover:text-[#13343B] dark:hover:text-[#F8F8F7] transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-semibold text-[#13343B] dark:text-[#F8F8F7]">Settings</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex gap-8">
          {/* Left Sidebar Navigation */}
          <nav className="w-48 flex-shrink-0">
            <ul className="space-y-1">
              {tabs.map((tab) => (
                <li key={tab.id}>
                  <button
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left",
                      activeTab === tab.id
                        ? "bg-[#F0F0ED] dark:bg-[#1A2426] text-[#13343B] dark:text-[#F8F8F7]"
                        : "text-[#64748B] hover:bg-[#F5F5F5] dark:hover:bg-[#1A2426] hover:text-[#13343B] dark:hover:text-[#F8F8F7]"
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
                <div className="bg-white dark:bg-[#1A1A1A] rounded-xl border border-[#E5E5E5] dark:border-[#333] p-6">
                  <h2 className="text-lg font-semibold text-[#13343B] dark:text-[#F8F8F7] mb-4">Account</h2>

                  <div className="space-y-4">
                    {/* Email */}
                    <div className="flex items-center justify-between py-3 border-b border-[#E5E5E5] dark:border-[#333]">
                      <div>
                        <p className="text-sm font-medium text-[#13343B] dark:text-[#F8F8F7]">Email</p>
                        <p className="text-sm text-[#64748B]">{user.email}</p>
                      </div>
                    </div>

                    {/* Sign Out */}
                    <div className="pt-2">
                      <button
                        onClick={handleSignOut}
                        className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
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
                <div className="bg-white dark:bg-[#1A1A1A] rounded-xl border border-[#E5E5E5] dark:border-[#333] p-6">
                  <h2 className="text-lg font-semibold text-[#13343B] dark:text-[#F8F8F7] mb-4">Theme</h2>

                  <div className="flex gap-3">
                    {mounted && (
                      <>
                        <button
                          onClick={() => setTheme('light')}
                          className={cn(
                            "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all min-w-[100px]",
                            theme === 'light'
                              ? "border-[#20B8CD] bg-[#F0FDFF] dark:bg-[#0F3538]"
                              : "border-[#E5E5E5] dark:border-[#333] hover:border-[#C5C5C5] dark:hover:border-[#444]"
                          )}
                        >
                          <Sun className={cn("h-6 w-6", theme === 'light' ? "text-[#20B8CD]" : "text-[#64748B]")} />
                          <span className={cn("text-sm font-medium", theme === 'light' ? "text-[#13343B] dark:text-[#F8F8F7]" : "text-[#64748B]")}>Light</span>
                        </button>

                        <button
                          onClick={() => setTheme('dark')}
                          className={cn(
                            "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all min-w-[100px]",
                            theme === 'dark'
                              ? "border-[#20B8CD] bg-[#F0FDFF] dark:bg-[#0F3538]"
                              : "border-[#E5E5E5] dark:border-[#333] hover:border-[#C5C5C5] dark:hover:border-[#444]"
                          )}
                        >
                          <Moon className={cn("h-6 w-6", theme === 'dark' ? "text-[#20B8CD]" : "text-[#64748B]")} />
                          <span className={cn("text-sm font-medium", theme === 'dark' ? "text-[#13343B] dark:text-[#F8F8F7]" : "text-[#64748B]")}>Dark</span>
                        </button>

                        <button
                          onClick={() => setTheme('system')}
                          className={cn(
                            "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all min-w-[100px]",
                            theme === 'system'
                              ? "border-[#20B8CD] bg-[#F0FDFF] dark:bg-[#0F3538]"
                              : "border-[#E5E5E5] dark:border-[#333] hover:border-[#C5C5C5] dark:hover:border-[#444]"
                          )}
                        >
                          <Monitor className={cn("h-6 w-6", theme === 'system' ? "text-[#20B8CD]" : "text-[#64748B]")} />
                          <span className={cn("text-sm font-medium", theme === 'system' ? "text-[#13343B] dark:text-[#F8F8F7]" : "text-[#64748B]")}>System</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Customization Card */}
                <div className="bg-white dark:bg-[#1A1A1A] rounded-xl border border-[#E5E5E5] dark:border-[#333] p-6">
                  <h2 className="text-lg font-semibold text-[#13343B] dark:text-[#F8F8F7] mb-4">Customization</h2>

                  <div className="space-y-4">
                    {/* Rounded Corners */}
                    <div className="flex items-center justify-between py-3 border-b border-[#E5E5E5] dark:border-[#333]">
                      <div>
                        <p className="text-sm font-medium text-[#13343B] dark:text-[#F8F8F7]">Rounded Corners</p>
                        <p className="text-sm text-[#64748B]">Enable rounded corners throughout the interface</p>
                      </div>
                      <button
                        className={cn(
                          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#20B8CD] focus:ring-offset-2",
                          rounded ? 'bg-[#20B8CD]' : 'bg-[#E5E5E5] dark:bg-[#333]'
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
                    <div className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-sm font-medium text-[#13343B] dark:text-[#F8F8F7]">Font Theme</p>
                        <p className="text-sm text-[#64748B]">Choose your preferred typography style</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleFontChange('default')}
                          disabled={loading}
                          className={cn(
                            "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                            fontTheme === 'default'
                              ? "bg-[#13343B] text-white"
                              : "bg-[#F5F5F5] dark:bg-[#2A2A2A] text-[#64748B] hover:text-[#13343B] dark:hover:text-[#F8F8F7]"
                          )}
                        >
                          Default
                        </button>
                        <button
                          onClick={() => handleFontChange('alternative')}
                          disabled={loading}
                          className={cn(
                            "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                            fontTheme === 'alternative'
                              ? "bg-[#13343B] text-white"
                              : "bg-[#F5F5F5] dark:bg-[#2A2A2A] text-[#64748B] hover:text-[#13343B] dark:hover:text-[#F8F8F7]"
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
