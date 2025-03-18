import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface HeaderProps {
  toggleSidebar: () => void;
}

const Header: React.FC<HeaderProps> = ({ toggleSidebar }) => {
  const router = useRouter();

  const handleHomeClick = (e: React.MouseEvent) => {
    e.preventDefault();
    // Navigate to home without disrupting authentication state
    // Use a simple navigation instead of forcing a push/redirect
    window.location.href = '/';
  };

  return (
    <div className="fixed top-0 left-0 right-0 bg-[#fffdf5] border-b z-50 w-screen overflow-x-hidden">
      <div className="w-full max-w-full md:max-w-4xl mx-auto px-4 py-3 flex justify-between items-center">
        {/* Logo */}
        <Link 
          href="/"
          className="flex items-center hover:opacity-80 transition-opacity"
        >
          <svg className="w-6 h-6 text-blue-600 mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 4L12 12M12 12L20 4M12 12L4 20M12 12L20 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <span className="font-bold text-lg">EXA</span>
        </Link>

        {/* Right side controls */}
        <div className="flex items-center gap-2">
          {/* Source Code Link */}
          <a 
            href="https://github.com/Vinitj088/ExaChat" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="flex items-center"
          >
            <span className="bg-gray-300 hover:bg-[var(--brand-default)] hover:text-white text-gray-800 px-3 py-1 rounded-md text-sm font-medium flex items-center gap-2">
              Source Code
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                width="16" 
                height="16" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                className="lucide lucide-github"
              >
                <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/>
                <path d="M9 18c-4.51 2-5-2-7-2"/>
              </svg>
            </span>
          </a>

          {/* Sidebar Toggle Button */}
          <button 
            className="p-1.5 text-gray-500 hover:bg-[var(--secondary-darker)] rounded-md transition-colors"
            onClick={toggleSidebar}
            aria-label="Toggle sidebar"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 12H21M3 6H21M3 18H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Header; 
