import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
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

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  return (
    <>
      {/* Overlay - changed to be semi-transparent on all screen sizes */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar - fixed height with internal scrolling */}
      <div 
        className={`fixed top-0 right-0 h-screen w-72 bg-[var(--secondary-faint)] border-l-4 border-[var(--brand-default)] shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Sidebar Header - fixed at top */}
        <div className="flex-shrink-0 flex justify-between items-center p-4 border-b-4 border-[var(--brand-default)]">
          <h2 className="text-xl font-bold">Chat History</h2>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-[var(--secondary-darker)] rounded"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
        {/* Sidebar Content - scrollable */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col space-y-4">
          {/* Profile Section with Sign Out Button */}
          <div className="flex-shrink-0 flex items-center p-3 bg-[var(--secondary-darker)] border-2 border-black">
            <div className="w-12 h-12 bg-[var(--brand-default)] rounded-full flex items-center justify-center text-white font-bold">
              EX
            </div>
            <div className="ml-3 flex-grow">
              <p className="font-bold">Exa User</p>
              <p className="text-sm text-gray-600">Free Plan</p>
            </div>
            <button className="p-2 hover:bg-[var(--secondary-darkest)] rounded-full" title="Sign Out">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
            </button>
          </div>
          
          {/* Chat History Scrollable Container */}
          <div className="flex-1 overflow-y-auto pr-1">
            <h3 className="font-bold text-sm uppercase text-gray-600 mb-2">Recent Conversations</h3>
            
            <div className="space-y-2">
              {chatHistory.map((chat) => (
                <Link 
                  href={`/chat/${chat.id}`} 
                  key={chat.id}
                  className="block p-3 bg-[var(--secondary-darker)] border-2 border-black hover:bg-[var(--secondary-darkest)] transition-colors"
                >
                  <div className="flex flex-col">
                    <span className="font-medium truncate">{chat.title}</span>
                    <span className="text-xs text-gray-600">{chat.date}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
          
          {/* GitHub Repo Link - fixed at bottom */}
          <div className="flex-shrink-0 p-4 bg-[var(--brand-fainter)] border-2 border-[var(--brand-default)] mt-auto">
            <h3 className="font-bold mb-2">View Source Code</h3>
            <p className="text-sm mb-3">Check out this project on GitHub.</p>
            <a 
              href="https://github.com/yourusername/exachat" 
              target="_blank" 
              rel="noopener noreferrer"
              className="block text-center py-2 px-4 bg-[var(--brand-default)] text-white font-bold border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)] hover:translate-y-0.5 hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,0.3)] transition-all"
            >
              <div className="flex items-center justify-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
                </svg>
                <span>GitHub Repo</span>
              </div>
            </a>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar; 