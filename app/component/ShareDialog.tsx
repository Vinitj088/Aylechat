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
      <DialogContent className="w-[95vw] max-w-sm sm:max-w-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-lg rounded-lg p-4 sm:p-6">
        <DialogHeader className="mb-2 sm:mb-3">
          <DialogTitle className="flex items-center gap-2 text-[var(--brand-default)] text-base sm:text-lg">
            <Share2 className="h-4 w-4" />
            Share Conversation
          </DialogTitle>
          <DialogDescription className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm">
            Anyone with this link can view this conversation
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex items-center space-x-2 mt-2 sm:mt-3">
          <div className="grid flex-1 gap-2">
            <Input
              ref={inputRef}
              value={shareUrl}
              readOnly
              className="w-full h-8 sm:h-9 font-mono text-[10px] sm:text-xs border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-2"
              onClick={(e) => e.currentTarget.select()}
            />
          </div>
          <Button 
            type="button" 
            variant="outline" 
            size="sm" 
            className="h-8 px-2 sm:px-3 min-w-[2.5rem] sm:min-w-[4rem] border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            <span className="sr-only">Copy</span>
          </Button>
        </div>
        
        <DialogFooter className="mt-3 sm:mt-4 flex justify-center sm:justify-start">
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={onClose}
            className="bg-[var(--brand-darker)] hover:bg-[var(--brand-dark)] text-white w-full sm:w-auto"
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 