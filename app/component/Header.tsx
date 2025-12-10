'use client';

import React from 'react';
import { PanelLeft } from 'lucide-react';

interface HeaderProps {
  onToggleSidebar?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  return (
    <div className="fixed top-0 left-0 z-50 p-3">
      {onToggleSidebar && (
        <button
          className="p-2 text-[var(--text-light-muted)] hover:bg-[var(--secondary-darker)] rounded-md transition-colors border border-[var(--secondary-darkest)]"
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
        >
          <PanelLeft className="w-5 h-5" />
        </button>
      )}
    </div>
  );
};

export default Header; 
