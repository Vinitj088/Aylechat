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
            "group toast flex w-full items-center border-2 border-black p-4 rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-[#fffdf5]",
          title: "text-sm font-bold text-black",
          description: "text-sm mt-1 text-black",
          actionButton:
            "bg-black text-white text-xs px-3 py-2 rounded-none border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all",
          cancelButton:
            "bg-[#f5f3e4] text-black text-xs px-3 py-2 rounded-none border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all",
          error: "bg-[#fff1f1] border-black",
          info: "bg-[#fffdf5] border-black",
          success: "bg-[#f5f3e4] border-black",
          warning: "bg-[#fff9e5] border-black",
        },
        duration: 4000,
      }}
      {...props}
    />
  )
}

export { Toaster }
