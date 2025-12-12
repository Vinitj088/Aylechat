'use client';

import React from 'react';
import { PanelLeft } from 'lucide-react';

interface HeaderProps {
  onToggleSidebar?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  return (
    <div className="fixed top-0 left-0 z-30 p-3">
      {onToggleSidebar && (
        <button
          className="p-2 text-[#64748B] hover:text-[#13343B] dark:hover:text-[#e7e7e2] bg-white dark:bg-[#191a1a] hover:bg-[#F5F5F5] dark:hover:bg-[#2a2a2a] rounded-lg transition-colors border border-[#E5E5E5] dark:border-[#2a2a2a] shadow-sm touch-manipulation"
          onClick={onToggleSidebar}
          aria-label="Open sidebar"
        >
          <PanelLeft className="w-5 h-5" />
        </button>
      )}
    </div>
  );
};

export default Header; 
