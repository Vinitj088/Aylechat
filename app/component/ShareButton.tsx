'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Share2 } from 'lucide-react';
import ShareDialog from './ShareDialog';

interface ShareButtonProps {
  threadId: string;
}

export default function ShareButton({ threadId }: ShareButtonProps) {
  const [isSharing, setIsSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState(false);
  
  const handleShare = async () => {
    if (isSharing) return;
    
    try {
      setIsSharing(true);
      
      const response = await fetch(`/api/chat/threads/${threadId}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setShareUrl(data.shareUrl);
        setDialogOpen(true);
      } else {
        toast.error('Failed to share conversation', {
          description: data.error || 'Please try again later',
          duration: 5000
        });
      }
    } catch (err) {
      console.error('Error sharing thread:', err);
      toast.error('Failed to share conversation', {
        description: 'Please try again later',
        duration: 5000
      });
    } finally {
      setIsSharing(false);
    }
  };
  
  const handleCloseDialog = () => {
    setDialogOpen(false);
  };
  
  return (
    <>
      <Button 
        variant="ghost" 
        size="sm"
        onClick={handleShare} 
        disabled={isSharing}
        className="px-2 sm:px-3 text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 group h-8 rounded-md transition-all duration-300 ease-in-out overflow-hidden"
        aria-label="Share conversation"
      >
        <div className="flex items-center justify-center">
          <Share2 className="h-4 w-4 flex-shrink-0 group-hover:mr-2 transition-all duration-300 ease-in-out" />
          <span className="max-w-0 group-hover:max-w-0 sm:group-hover:max-w-xs transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap text-xs">
            Share this chat
          </span>
        </div>
      </Button>
      
      <ShareDialog 
        isOpen={dialogOpen} 
        onClose={handleCloseDialog} 
        shareUrl={shareUrl}
      />
    </>
  );
} 