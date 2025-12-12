"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from "next/navigation";
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { ArrowLeft } from 'lucide-react';

type SettingsTab = 'general' | 'appearance';

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
      router.push("/");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  }, [signOut, router]);

  if (!user) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen bg-[#F0F0ED] dark:bg-[#1a1a1a] px-4">
        <div className="w-full max-w-md bg-white dark:bg-[#242424] rounded-lg p-8 text-center border border-[#E5E5E5] dark:border-[#2a2a2a]">
          <h1 className="text-2xl font-semibold mb-4 text-[#13343B] dark:text-[#e7e7e2]">Settings</h1>
          <p className="text-[#64748B] dark:text-[#8a8a8a] mb-6">You must be signed in to access settings.</p>
          <button
            onClick={() => router.push("/")}
            className="px-6 py-2.5 bg-[#13343B] dark:bg-white text-white dark:text-[#1a1a1a] rounded-lg hover:bg-[#0d2529] dark:hover:bg-gray-100 transition-colors font-medium"
          >
            Go Home
          </button>
        </div>
      </main>
    );
  }

  const tabs = [
    { id: 'general' as const, label: 'General' },
    { id: 'appearance' as const, label: 'Appearance' },
  ];

  return (
    <main className="min-h-screen bg-[#F0F0ED] dark:bg-[#1a1a1a]">
      {/* Mobile Header */}
      <div className="md:hidden sticky top-0 z-10 bg-[#F0F0ED] dark:bg-[#1a1a1a] border-b border-[#E5E5E5] dark:border-[#2a2a2a]">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 rounded-lg hover:bg-[#E5E5E5] dark:hover:bg-[#2a2a2a] text-[#64748B] hover:text-[#13343B] dark:hover:text-[#e7e7e2] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold text-[#13343B] dark:text-[#e7e7e2]">Settings</h1>
        </div>

        {/* Mobile Tab Navigation */}
        <div className="flex gap-1 px-4 pb-3 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap",
                activeTab === tab.id
                  ? "bg-[#13343B] dark:bg-[#e7e7e2] text-white dark:text-[#1a1a1a]"
                  : "bg-[#E5E5E5] dark:bg-[#2a2a2a] text-[#64748B] dark:text-[#8a8a8a]"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex">
        {/* Desktop Sidebar */}
        <aside className="hidden md:block w-56 min-h-screen border-r border-[#E5E5E5] dark:border-[#2a2a2a] p-6 flex-shrink-0">
          <nav className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  activeTab === tab.id
                    ? "bg-[#E5E5E5] dark:bg-[#2a2a2a] text-[#13343B] dark:text-[#e7e7e2]"
                    : "text-[#64748B] dark:text-[#8a8a8a] hover:text-[#13343B] dark:hover:text-[#e7e7e2] hover:bg-[#F5F5F5] dark:hover:bg-[#242424]"
                )}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <div className="flex-1 p-4 md:p-8 max-w-4xl">
          {activeTab === 'general' && (
            <div className="space-y-8 md:space-y-10">
              {/* Account Section */}
              <section>
                <h2 className="text-lg font-medium text-[#13343B] dark:text-[#e7e7e2] mb-4 md:mb-6">Account</h2>

                <div className="space-y-4">
                  {/* Email */}
                  <div className="flex items-center justify-between py-3 border-b border-[#E5E5E5] dark:border-[#2a2a2a]">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[#13343B] dark:text-[#e7e7e2]">Email</p>
                      <p className="text-sm text-[#64748B] dark:text-[#6a6a6a] truncate">{user.email}</p>
                    </div>
                  </div>

                  {/* Sign Out */}
                  <div className="pt-2">
                    <button
                      onClick={handleSignOut}
                      className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="space-y-6">
              <section>
                <h2 className="text-lg font-medium text-[#13343B] dark:text-[#e7e7e2] mb-4 md:mb-6">Theme</h2>

                <div className="flex flex-col sm:flex-row gap-3">
                  {mounted && (
                    <>
                      <button
                        onClick={() => setTheme('light')}
                        className={cn(
                          "flex-1 py-3 px-4 rounded-lg border-2 text-sm font-medium transition-all",
                          theme === 'light'
                            ? "border-[#20B8CD] bg-[#20B8CD]/10 text-[#13343B] dark:text-[#e7e7e2]"
                            : "border-[#E5E5E5] dark:border-[#3a3a3a] text-[#64748B] dark:text-[#8a8a8a] hover:border-[#C5C5C5] dark:hover:border-[#4a4a4a]"
                        )}
                      >
                        Light
                      </button>
                      <button
                        onClick={() => setTheme('dark')}
                        className={cn(
                          "flex-1 py-3 px-4 rounded-lg border-2 text-sm font-medium transition-all",
                          theme === 'dark'
                            ? "border-[#20B8CD] bg-[#20B8CD]/10 text-[#13343B] dark:text-[#e7e7e2]"
                            : "border-[#E5E5E5] dark:border-[#3a3a3a] text-[#64748B] dark:text-[#8a8a8a] hover:border-[#C5C5C5] dark:hover:border-[#4a4a4a]"
                        )}
                      >
                        Dark
                      </button>
                      <button
                        onClick={() => setTheme('system')}
                        className={cn(
                          "flex-1 py-3 px-4 rounded-lg border-2 text-sm font-medium transition-all",
                          theme === 'system'
                            ? "border-[#20B8CD] bg-[#20B8CD]/10 text-[#13343B] dark:text-[#e7e7e2]"
                            : "border-[#E5E5E5] dark:border-[#3a3a3a] text-[#64748B] dark:text-[#8a8a8a] hover:border-[#C5C5C5] dark:hover:border-[#4a4a4a]"
                        )}
                      >
                        System
                      </button>
                    </>
                  )}
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
