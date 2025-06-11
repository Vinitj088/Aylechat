"use client";
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface SidebarPinContextType {
  pinned: boolean;
  setPinned: (pinned: boolean) => void;
}

const SidebarPinContext = createContext<SidebarPinContextType | undefined>(undefined);

export const SidebarPinProvider = ({ children }: { children: ReactNode }) => {
  const [pinned, setPinnedState] = useState<boolean>(false);

  // On mount, read from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('sidebarPinned');
      if (stored === 'true') setPinnedState(true);
      if (stored === 'false') setPinnedState(false);
    }
  }, []);

  // Update localStorage when pinned changes
  const setPinned = (value: boolean) => {
    setPinnedState(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('sidebarPinned', value ? 'true' : 'false');
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