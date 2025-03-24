'use client';

import { useTheme } from '@/context/ThemeContext';
import { Button } from '@/components/ui/button';
import { Sun, Moon } from 'lucide-react';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleTheme}
      className="h-8 px-2 text-xs bg-transparent hover:bg-[var(--secondary-darker)] text-[var(--text-light-muted)] border-none flex items-center gap-1 font-medium"
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {theme === 'dark' ? (
        <>
          <Sun size={14} />
          <span className="hidden sm:inline">Light</span>
        </>
      ) : (
        <>
          <Moon size={14} />
          <span className="hidden sm:inline">Dark</span>
        </>
      )}
    </Button>
  );
} 