import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onSignInClick?: () => void;
}

// Mock chat history data - in a real app, this would come from props
const chatHistory = [
  { id: '1', title: 'How to implement React hooks', date: '2 hours ago' },
  { id: '2', title: 'JavaScript async/await patterns', date: 'Yesterday' },
  { id: '3', title: 'CSS Grid vs Flexbox', date: '2 days ago' },
  { id: '4', title: 'NextJS app router migration', date: '3 days ago' },
  { id: '5', title: 'TypeScript best practices', date: '1 week ago' },
  { id: '6', title: 'Web accessibility guidelines', date: '1 week ago' },
  { id: '7', title: 'GraphQL vs REST API', date: '2 weeks ago' },
  { id: '8', title: 'Docker containerization', date: '3 weeks ago' },
  { id: '9', title: 'CI/CD pipeline setup', date: '1 month ago' },
  { id: '10', title: 'Serverless architecture', date: '1 month ago' },
];

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, onSignInClick }) => {
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <>
      {/* Overlay - changed to be semi-transparent on all screen sizes */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />
      
      {/* Sidebar - fixed height with internal scrolling */}
      <div
        className={`fixed top-0 right-0 h-screen w-64 bg-[#fffdf5] z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        } flex flex-col`}
      >
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-bold">Hey there</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-700 rounded-md"
            aria-label="Close sidebar"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
        
        {/* Sidebar Content - scrollable */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-4">
            <div className="space-y-1">
              <a
                href="/"
                className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-[var(--secondary-darker)] rounded-md transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 12L5 10M5 10L12 3L19 10M5 10V20C5 20.5523 5.44772 21 6 21H9M19 10L21 12M19 10V20C19 20.5523 18.5523 21 18 21H15M9 21C9.55228 21 10 20.5523 10 20V16C10 15.4477 10.4477 15 11 15H13C13.5523 15 14 15.4477 14 16V20C14 20.5523 14.4477 21 15 21M9 21H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Home
              </a>
              <a
                href="/chat"
                className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-[var(--secondary-darker)] rounded-md transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 12H8.01M12 12H12.01M16 12H16.01M21 12C21 16.4183 16.9706 20 12 20C10.4607 20 9.01172 19.6565 7.74467 19.0511L3 20L4.39499 16.28C3.51156 15.0423 3 13.5743 3 12C3 7.58172 7.02944 4 12 4C16.9706 4 21 7.58172 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Chat History
              </a>
            </div>
          </div>
        </div>

        {/* User profile section */}
        <div className="p-4 border-t">
          {isAuthenticated ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium">
                  {user?.name ? user.name.charAt(0).toUpperCase() : user?.email.charAt(0).toUpperCase()}
                </div>
                <div className="overflow-hidden">
                  <p className="font-medium truncate">{user?.name || 'User'}</p>
                  <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                </div>
              </div>
              <button
                onClick={() => logout()}
                className="w-full flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-[var(--secondary-darker)] rounded-md transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17 16L21 12M21 12L17 8M21 12H9M9 21H7C5.89543 21 5 20.1046 5 19V5C5 3.89543 5.89543 3 7 3H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Sign Out
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-500">Sign in to save your chat history</p>
              <button
                onClick={onSignInClick}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M15 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H15M10 17L15 12M15 12L10 7M15 12H3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Sign In
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Sidebar; 