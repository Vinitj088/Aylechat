'use client';

import { memo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import LeftSidebar from './component/LeftSidebar';
import { cn } from '@/lib/utils';
import { useSidebarContext } from '@/context/SidebarContext';

function LayoutClientInner({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter();
  const { isExpanded, setIsExpanded, sidebarMounted } = useSidebarContext();

  const handleNewChat = useCallback(() => {
    router.push('/');
  }, [router]);

  // Memoize overlay close handler
  const handleOverlayClick = useCallback(() => {
    setIsExpanded(false);
  }, [setIsExpanded]);

  return (
    <div className="flex min-h-[100dvh]">
      {/* Sidebar - persists across all routes */}
      <LeftSidebar
        onNewChat={handleNewChat}
        isExpanded={isExpanded}
        setIsExpanded={setIsExpanded}
        isHydrating={!sidebarMounted}
      />

      {/* Mobile overlay */}
      {isExpanded && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden touch-manipulation"
          onClick={handleOverlayClick}
        />
      )}

      {/* Main content area with margin for sidebar */}
      <main className={cn(
        "flex-1 min-h-[100dvh] w-full overscroll-contain",
        "md:transition-[margin-left] md:duration-200 md:ease-out",
        sidebarMounted ? (isExpanded ? "md:ml-64" : "md:ml-14") : "md:ml-14"
      )}>
        {children}
      </main>
    </div>
  );
}

export default memo(LayoutClientInner);
