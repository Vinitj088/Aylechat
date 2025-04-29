'use client';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Sun, Moon } from 'lucide-react';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-8 w-8 sm:w-[70px]" />;
  }

  const targetTheme = theme === 'dark' ? 'light' : 'dark';

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setTheme(targetTheme)}
      className="h-8 px-2 text-xs bg-transparent hover:bg-[var(--secondary-darker)] text-[var(--text-light-muted)] border-none flex items-center gap-1 font-medium transition-none"
      aria-label={`Switch to ${targetTheme} mode`}
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