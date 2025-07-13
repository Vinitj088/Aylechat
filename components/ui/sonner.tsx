"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ 
  position = "bottom-right",
  ...props 
}: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position={position}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast flex w-full items-center border border-border p-4 rounded-[var(--radius)] shadow-lg bg-background",
          title: "text-sm font-semibold text-foreground",
          description: "text-sm mt-1 text-muted-foreground",
          actionButton:
            "bg-primary text-primary-foreground text-xs px-3 py-2 rounded-[var(--radius)] font-medium hover:bg-primary/90 transition-colors",
          cancelButton:
            "bg-secondary text-secondary-foreground text-xs px-3 py-2 rounded-[var(--radius)] border border-border font-medium hover:bg-secondary/80 transition-colors",
          error: "border-destructive bg-destructive/10",
          info: "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/50",
          success: "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/50",
          warning: "border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/50",
        },
        duration: 4000,
      }}
      {...props}
    />
  )
}

export { Toaster }
