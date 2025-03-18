'use client';

import { Toaster as Sonner } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

export function SonnerToaster({
  position = 'bottom-right',
  richColors = false,
  expand = false,
  ...props
}: ToasterProps) {
  return (
    <Sonner
      position={position}
      richColors={richColors}
      expand={expand}
      className="sonner-toast-container"
      toastOptions={{
        classNames: {
          toast: "group toast flex w-full items-center border p-4 rounded-lg shadow-md bg-[var(--secondary-faint)] border-[var(--secondary-dark)] shadow-md",
          title: "text-sm font-semibold text-gray-800",
          description: "text-sm opacity-90 mt-1 text-gray-600",
          actionButton: "bg-[var(--brand-default)] text-white text-xs px-3 py-2 rounded-md border-2 border-[var(--brand-default)] hover:bg-transparent hover:text-[var(--brand-default)] transition-colors",
          cancelButton: "bg-[var(--secondary-default)] text-[var(--secondary-dark)] text-xs px-3 py-2 rounded-md border-2 border-[var(--secondary-default)] hover:bg-transparent hover:text-[var(--secondary-dark)] transition-colors",
          error: "bg-[var(--brand-darker)] text-[var(--brand-fainter)] border-[var(--brand-darker)]",
          info: "bg-[var(--brand-default)] text-white border-[var(--brand-default)]",
          success: "bg-[var(--brand-subtle)] text-black border-[var(--brand-subtle)]",
          warning: "bg-[var(--secondary-accent2x)] text-[var(--secondary-dark)] border-[var(--secondary-accent2x)]",
        },
        duration: 6000,
      }}
      {...props}
    />
  );
}