"use client";
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface SidebarContextType {
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
  toggleSidebar: () => void;
  sidebarMounted: boolean;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export const SidebarProvider = ({ children }: { children: ReactNode }) => {
  const [isExpanded, setIsExpandedState] = useState(false);
  const [sidebarMounted, setSidebarMounted] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('sidebarExpanded');
    if (saved) {
      setIsExpandedState(JSON.parse(saved));
    }
    setSidebarMounted(true);
  }, []);

  // Persist to localStorage
  const setIsExpanded = useCallback((expanded: boolean) => {
    setIsExpandedState(expanded);
    if (typeof window !== 'undefined') {
      localStorage.setItem('sidebarExpanded', JSON.stringify(expanded));
    }
  }, []);

  const toggleSidebar = useCallback(() => {
    setIsExpanded(!isExpanded);
  }, [isExpanded, setIsExpanded]);

  return (
    <SidebarContext.Provider value={{
      isExpanded,
      setIsExpanded,
      toggleSidebar,
      sidebarMounted
    }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const useSidebarContext = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebarContext must be used within a SidebarProvider');
  }
  return context;
};

// Keep old hook for backwards compatibility
export const useSidebar = useSidebarContext;
