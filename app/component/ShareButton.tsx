'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Share2 } from 'lucide-react';
import ShareDialog from './ShareDialog';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/tooltip";
import { db } from '@/lib/db';
import { id } from '@instantdb/react';

interface ShareButtonProps {
  threadId: string | null | undefined;
}

export default function ShareButton({ threadId }: ShareButtonProps) {
  const [isSharing, setIsSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState(false);
  
  const handleShare = async () => {
    if (!threadId || isSharing) return;
    
    try {
      setIsSharing(true);
      const shareId = id();
      await db.transact(
        db.tx.threads[threadId].update({ isPublic: true, shareId: shareId })
      );
      const url = `${window.location.origin}/shared/${shareId}`;
      setShareUrl(url);
      setDialogOpen(true);
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
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleShare} 
              disabled={!threadId || isSharing}
              className="px-2 sm:px-3 text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 group h-8 rounded-md transition-all duration-300 ease-in-out overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={!threadId || isSharing ? "Cannot share yet" : "Share conversation"}
            >
              <div className="flex items-center justify-center">
                <Share2 className="h-4 w-4 flex-shrink-0 group-hover:mr-2 transition-all duration-300 ease-in-out" />
                <span className="max-w-0 group-hover:max-w-0 sm:group-hover:max-w-xs transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap text-xs">
                  Share this chat
                </span>
              </div>
            </Button>
          </TooltipTrigger>
          {!threadId && (
            <TooltipContent side="bottom" className="text-xs">
              <p>Send a message to enable sharing</p>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
      
      <ShareDialog 
        isOpen={dialogOpen} 
        onClose={handleCloseDialog} 
        shareUrl={shareUrl}
      />
    </>
  );
} 