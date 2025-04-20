import { useState, useEffect } from 'react';
// import { ArrowDown } from 'lucide-react'; // Remove icon import
import { Button } from '@/components/ui/button';

interface ScrollToBottomButtonProps {
  showOffset?: number; // Pixels from bottom to show the button
}

const ScrollToBottomButton: React.FC<ScrollToBottomButtonProps> = ({
  showOffset = 300, // Increased offset slightly
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Use window scroll properties
      const scrollHeight = document.documentElement.scrollHeight;
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const clientHeight = document.documentElement.clientHeight;

      const isScrolledUp = scrollHeight - scrollTop - clientHeight > showOffset;
      setIsVisible(isScrolledUp);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial check

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [showOffset]);

  const scrollToBottom = () => {
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: 'smooth',
    });
  };

  if (!isVisible) {
    return null;
  }

  return (
    <Button
      variant="outline" // Keep outline for a subtle border, or change if needed
      // Add responsive classes: hidden by default, flex on medium screens and up
      className="fixed bottom-6 right-4 z-50 rounded-lg shadow-lg h-auto px-4 py-2 
                 hidden md:flex
                 bg-white/10 dark:bg-black/10 
                 backdrop-blur-md 
                 border border-white/20 dark:border-black/20 
                 text-sm font-medium text-foreground/80 hover:text-foreground hover:bg-white/20 dark:hover:bg-black/20
                 transition-all duration-200 ease-in-out"
      onClick={scrollToBottom}
      aria-label="Scroll to bottom"
    >
      {/* <ArrowDown className="h-5 w-5" /> Remove icon */}
      Scroll to Bottom {/* Add text */}
    </Button>
  );
};

export default ScrollToBottomButton; 