'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Share2 } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleShare} 
              disabled={isSharing}
              className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <Share2 className="h-4 w-4 mr-1" /> 
              {isSharing ? 'Sharing...' : 'Share'}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Share this conversation with a public link</p>
          </TooltipContent>
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