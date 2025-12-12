'use client';

import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, Copy, Share2 } from 'lucide-react';
import { toast } from 'sonner';

interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  shareUrl: string;
}

export default function ShareDialog({ isOpen, onClose, shareUrl }: ShareDialogProps) {
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleCopy = async () => {
    try {
      if (inputRef.current) {
        inputRef.current.select();
      }
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
      toast.success('Link copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy:', err);
      toast.error('Failed to copy link');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] max-w-sm sm:max-w-md bg-white dark:bg-[#1f2121] border border-[#E5E5E5] dark:border-[#2a2a2a] shadow-lg rounded-xl p-4 sm:p-6">
        <DialogHeader className="mb-2 sm:mb-3">
          <DialogTitle className="flex items-center gap-2 text-[#13343B] dark:text-[#e7e7e2] text-base sm:text-lg">
            <Share2 className="h-4 w-4 text-[#20B8CD]" />
            Share Conversation
          </DialogTitle>
          <DialogDescription className="text-[#64748B] text-xs sm:text-sm">
            Anyone with this link can view this conversation
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center space-x-2 mt-2 sm:mt-3">
          <div className="grid flex-1 gap-2">
            <Input
              ref={inputRef}
              value={shareUrl}
              readOnly
              className="w-full h-8 sm:h-9 font-mono text-[10px] sm:text-xs border-[#E5E5E5] dark:border-[#2a2a2a] bg-[#F5F5F5] dark:bg-[#2a2a2a] text-[#13343B] dark:text-[#e7e7e2] px-2 rounded-lg focus:ring-[#20B8CD] focus:border-[#20B8CD]"
              onClick={(e) => e.currentTarget.select()}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 px-2 sm:px-3 min-w-[2.5rem] sm:min-w-[4rem] border-[#E5E5E5] dark:border-[#2a2a2a] hover:bg-[#F5F5F5] dark:hover:bg-[#2a2a2a] text-[#64748B] hover:text-[#13343B] dark:hover:text-[#e7e7e2]"
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="h-4 w-4 text-[#20B8CD]" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            <span className="sr-only">Copy</span>
          </Button>
        </div>

        <DialogFooter className="mt-3 sm:mt-4 flex justify-center sm:justify-start">
          <Button
            type="button"
            size="sm"
            onClick={onClose}
            className="bg-[#20B8CD] hover:bg-[#1AA3B6] text-white w-full sm:w-auto rounded-lg"
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 