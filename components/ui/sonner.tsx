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
            "group toast flex w-full items-center border border-zinc-200 dark:border-zinc-800 p-4 rounded-lg shadow-lg bg-white dark:bg-zinc-950",
          title: "text-sm font-semibold text-zinc-900 dark:text-zinc-50",
          description: "text-sm mt-1 text-zinc-600 dark:text-zinc-400",
          actionButton:
            "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 text-xs px-3 py-2 rounded-md font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors",
          cancelButton:
            "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50 text-xs px-3 py-2 rounded-md border border-zinc-200 dark:border-zinc-700 font-medium hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors",
          error: "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/50",
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
