'use client';

import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';

type EnhancerMode = 'auto' | 'manual';

interface QueryEnhancerContextType {
  enhancerMode: EnhancerMode;
  setEnhancerMode: (mode: EnhancerMode) => void;
  toggleEnhancerMode: () => void;
}

const QueryEnhancerContext = createContext<QueryEnhancerContextType | undefined>(undefined);

export const QueryEnhancerProvider = ({ children }: { children: ReactNode }) => {
  const [enhancerMode, setEnhancerMode] = useState<EnhancerMode>('manual');

  useEffect(() => {
    const storedMode = localStorage.getItem('queryEnhancerMode') as EnhancerMode;
    if (storedMode && (storedMode === 'auto' || storedMode === 'manual')) {
      setEnhancerMode(storedMode);
    }
  }, []);

  const handleSetMode = (mode: EnhancerMode) => {
    localStorage.setItem('queryEnhancerMode', mode);
    setEnhancerMode(mode);
  };

  const toggleMode = () => {
    const newMode = enhancerMode === 'auto' ? 'manual' : 'auto';
    handleSetMode(newMode);
  };

  return (
    <QueryEnhancerContext.Provider value={{ enhancerMode, setEnhancerMode: handleSetMode, toggleEnhancerMode: toggleMode }}>
      {children}
    </QueryEnhancerContext.Provider>
  );
};

export const useQueryEnhancer = (): QueryEnhancerContextType => {
  const context = useContext(QueryEnhancerContext);
  if (context === undefined) {
    throw new Error('useQueryEnhancer must be used within a QueryEnhancerProvider');
  }
  return context;
}; 