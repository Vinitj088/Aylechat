'use client';

import { useSidebar } from '@/context/SidebarContext';
import { useSidebarPin } from '@/context/SidebarPinContext';
import { useAuth } from '@/context/AuthContext';
import Sidebar from './component/Sidebar';
import Header from './component/Header';
import { cn } from '@/lib/utils';

export default function LayoutClient({
  children,
}: {
  children: React.ReactNode
}) {
  const { isSidebarOpen, closeSidebar } = useSidebar();
  const { pinned, setPinned } = useSidebarPin();
  const { openAuthDialog } = useAuth();

  return (
    <div className={cn(
      pinned ? "ayle-grid-layout" : "",
      "min-h-screen w-full"
    )}>
      <div className="md:hidden">
        <Header />
      </div>
      <main className={cn(
        "flex flex-col flex-1 min-h-screen",
        pinned ? "ayle-main-pinned" : ""
      )}>
        <div className="w-full overflow-x-hidden">
          {children}
        </div>
      </main>
      <Sidebar
        isOpen={isSidebarOpen || pinned}
        onClose={closeSidebar}
        onSignInClick={openAuthDialog}
        pinned={pinned}
        setPinned={setPinned}
      />
    </div>
  );
}
