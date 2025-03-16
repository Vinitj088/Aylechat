import React from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { signOut, useSession } from 'next-auth/react'
import { History as HistoryIcon, UserCircle2 } from 'lucide-react'

interface Chat {
  id: string;
  title: string;
  path: string;
  createdAt: string;
}

interface SideSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const formatDateWithTime = (date: string) => {
  const parsedDate = new Date(date)
  const now = new Date()
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)

  const formatTime = (date: Date) => {
    return date.toLocaleString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  }

  if (
    parsedDate.getDate() === now.getDate() &&
    parsedDate.getMonth() === now.getMonth() &&
    parsedDate.getFullYear() === now.getFullYear()
  ) {
    return `Today, ${formatTime(parsedDate)}`
  } else if (
    parsedDate.getDate() === yesterday.getDate() &&
    parsedDate.getMonth() === yesterday.getMonth() &&
    parsedDate.getFullYear() === yesterday.getFullYear()
  ) {
    return `Yesterday, ${formatTime(parsedDate)}`
  } else {
    return parsedDate.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  }
}

const HistoryItem: React.FC<{ chat: Chat }> = ({ chat }) => {
  return (
    <a
      href={chat.path}
      className="flex flex-col hover:bg-blue-50 cursor-pointer p-3 rounded-lg border border-transparent hover:border-blue-100 transition-colors"
    >
      <div className="text-sm font-medium truncate text-gray-800">
        {chat.title}
      </div>
      <div className="text-xs text-gray-500 mt-1">
        {formatDateWithTime(chat.createdAt)}
      </div>
    </a>
  )
}

const SideSheet: React.FC<SideSheetProps> = ({ isOpen, onOpenChange }) => {
  const { data: session } = useSession();
  
  // Temporary mock data - will be replaced with Redis data
  const mockChats: Chat[] = session ? [
    {
      id: '1',
      title: 'How to implement authentication in Next.js',
      path: '/chat/1',
      createdAt: new Date().toISOString(),
    },
    {
      id: '2',
      title: 'Building responsive layouts with Tailwind CSS',
      path: '/chat/2',
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Yesterday
    },
    {
      id: '3',
      title: 'Working with TypeScript and React',
      path: '/chat/3',
      createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), // 2 days ago
    },
  ] : [];

  const handleSignOut = () => {
    signOut({ callbackUrl: '/' });
    onOpenChange(false); // Close the sheet after signing out
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[300px] sm:w-[400px] bg-white p-0 flex flex-col">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="flex items-center gap-2 text-xl">
            <HistoryIcon className="w-5 h-5" />
            Chat History
          </SheetTitle>
        </SheetHeader>

        {session && (
          <div className="p-4 flex items-center gap-2 border-b">
            <UserCircle2 className="w-5 h-5 text-gray-500" />
            <span className="text-sm font-medium truncate">
              {session.user?.name || session.user?.email}
            </span>
          </div>
        )}
        
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-4">
            {!session ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-gray-500 text-sm">Sign in to view chat history</p>
              </div>
            ) : mockChats.length === 0 ? (
              <div className="text-gray-500 text-sm text-center py-4">
                No chat history
              </div>
            ) : (
              <div className="space-y-2">
                {mockChats.map((chat) => (
                  <HistoryItem key={chat.id} chat={chat} />
                ))}
              </div>
            )}
          </div>
          
          {session && (
            <div className="p-4 border-t mt-auto space-y-2">
              <button 
                className="w-full py-2 px-4 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
                onClick={() => {
                  // Will implement clear history functionality later
                  console.log('Clear history clicked')
                }}
              >
                Clear History
              </button>
              <button 
                onClick={handleSignOut}
                className="w-full py-2 px-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

export default SideSheet