'use client';

import { useState, Suspense } from 'react';
import Header from '../component/Header';
import Sidebar from '../component/Sidebar';
import { ThemeToggle } from '@/components/ThemeToggle';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useSidebarPin } from '@/context/SidebarPinContext';
import useIsMobile from '../hooks/useIsMobile';
import { cn } from '@/lib/utils';
import { spacesList } from './config';

function SpacesPageContent() {
  const { openAuthDialog } = useAuth();
  const { pinned, setPinned } = useSidebarPin();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const isMobile = useIsMobile();

  const toggleSidebar = () => {
    if (pinned) {
      setPinned(false);
    } else {
      setIsSidebarOpen(true);
    }
  };

  return (
    <div className={cn(pinned ? "ayle-grid-layout" : "", "min-h-screen w-full bg-[var(--secondary-default)] text-[var(--text-light-default)]")}>
      <main className={cn("flex flex-col flex-1 min-h-screen", pinned ? "ayle-main-pinned" : "")}>
        <div className="lg:hidden">
          <Header toggleSidebar={toggleSidebar} />
        </div>
        <Link
          href="/"
          className={cn("hidden lg:flex fixed top-4 left-4 z-50 items-center transition-colors duration-200", pinned ? "sidebar-pinned-fixed" : "")}
        >
          <span 
            className="text-3xl text-[var(--brand-default)]"
            style={{ fontFamily: 'var(--font-gebuk-regular)', letterSpacing: '0.05em' }}
          >
            Ayle
          </span>
        </Link>
        <Sidebar 
          isOpen={pinned || isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          onSignInClick={openAuthDialog}
          pinned={pinned}
          setPinned={setPinned}
        />
        
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 mt-16 lg:mt-0">
          <div className="max-w-4xl mx-auto">
            <header className="mb-12">
              <h1 className="text-4xl sm:text-5xl font-bold text-[var(--text-light-default)]">Spaces</h1>
              <p className="mt-4 text-lg text-[var(--text-light-muted)]">
                Choose a specialized AI to help you with a specific task.
              </p>
            </header>

            <section>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {spacesList.map((space) => (
                  <Link href={`/spaces/${space.id}`} key={space.id}>
                    <div className="bg-[var(--secondary-fainter)] border border-[var(--secondary-darkest)] rounded-lg p-6 flex flex-col h-full hover:border-[var(--secondary-darker)] transition-colors cursor-pointer group">
                      <div className="text-4xl mb-4">{space.icon}</div>
                      <h3 className="font-semibold text-lg mb-2 group-hover:text-white">{space.name}</h3>
                      <p className="text-sm text-[var(--text-light-muted)] flex-1">{space.description}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          </div>
        </div>
        
        <div className={cn("hidden lg:block fixed bottom-4 left-4 z-50", pinned ? "sidebar-pinned-fixed" : "")}> 
          <ThemeToggle />
        </div>
      </main>
    </div>
  );
}

export default function SpacesPage() {
  return (
    <Suspense fallback={null}>
      <SpacesPageContent />
    </Suspense>
  );
} 