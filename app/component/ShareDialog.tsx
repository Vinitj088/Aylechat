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
      // Select the text
      if (inputRef.current) {
        inputRef.current.select();
      }
      
      // Copy to clipboard
      await navigator.clipboard.writeText(shareUrl);
      
      // Show copied state
      setCopied(true);
      
      // Reset copied state after 2 seconds
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
      <DialogContent className="sm:max-w-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-4 w-4" />
            Share Conversation
          </DialogTitle>
          <DialogDescription>
            Anyone with this link can view this conversation
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex items-center space-x-2 mt-2">
          <div className="grid flex-1 gap-2">
            <Input
              ref={inputRef}
              value={shareUrl}
              readOnly
              className="w-full h-9 font-mono text-xs sm:text-sm"
              onClick={(e) => e.currentTarget.select()}
            />
          </div>
          <Button 
            type="button" 
            variant="outline" 
            size="sm" 
            className="px-3 min-w-[4rem]"
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            <span className="sr-only">Copy</span>
          </Button>
        </div>
        
        <DialogFooter className="sm:justify-start">
          <Button
            type="button"
            variant="default"
            onClick={onClose}
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 