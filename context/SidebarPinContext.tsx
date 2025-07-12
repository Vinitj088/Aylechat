"use client";
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface SidebarPinContextType {
  pinned: boolean;
  setPinned: (pinned: boolean) => void;
}

const SidebarPinContext = createContext<SidebarPinContextType | undefined>(undefined);

export const SidebarPinProvider = ({ children }: { children: ReactNode }) => {
  const [pinned, setPinnedState] = useState<boolean>(false);

  // On mount, read from localStorage and check width
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handleResize = () => {
        const isLargeScreen = window.innerWidth > 1300;
        const stored = localStorage.getItem('sidebarPinned');
        
        if (isLargeScreen && stored === 'true') {
          setPinnedState(true);
        } else {
          setPinnedState(false);
        }
      };

      handleResize(); // Check on initial load
      window.addEventListener('resize', handleResize);

      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  // Update localStorage when pinned changes, only if screen is large enough
  const setPinned = (value: boolean) => {
    if (typeof window !== 'undefined' && window.innerWidth > 1300) {
      setPinnedState(value);
      localStorage.setItem('sidebarPinned', value ? 'true' : 'false');
    } else {
      // If screen is not large enough, always set pinned to false
      setPinnedState(false);
      localStorage.setItem('sidebarPinned', 'false');
    }
  };

  return (
    <SidebarPinContext.Provider value={{ pinned, setPinned }}>
      {children}
    </SidebarPinContext.Provider>
  );
};

export const useSidebarPin = () => {
  const context = useContext(SidebarPinContext);
  if (!context) {
    throw new Error('useSidebarPin must be used within a SidebarPinProvider');
  }
  return context;
}; 