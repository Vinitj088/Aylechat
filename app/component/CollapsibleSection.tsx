"use client"

import { useState, type ReactNode } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface CollapsibleSectionProps {
  title: string
  children: ReactNode
  defaultOpen?: boolean
}

export function CollapsibleSection({ title, children, defaultOpen = true }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between text-sm font-medium text-[var(--text-light-muted)] dark:text-[var(--text-light-muted)] hover:text-[var(--text-light-default)] transition-colors pb-4"
      >
        <span>{title}</span>
        
      </button>
      {isOpen && <div className="pb-2">{children}</div>}
    </div>
  )
}
