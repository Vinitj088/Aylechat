'use client';

import { useState } from 'react';
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
            <button
              onClick={handleShare}
              disabled={!threadId || isSharing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#20B8CD] hover:bg-[#1AA3B6] text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={!threadId || isSharing ? "Cannot share yet" : "Share conversation"}
            >
              <Share2 className={`w-4 h-4 ${isSharing ? 'animate-pulse' : ''}`} />
              <span>Share</span>
            </button>
          </TooltipTrigger>
          {!threadId && (
            <TooltipContent side="bottom" className="text-xs bg-[#1f2121] text-[#e7e7e2] border-[#2a2a2a]">
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