"use client"

import { useState, useEffect, useRef, useCallback, memo } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import { db } from "@/lib/db"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { id } from "@instantdb/react"
import { useSidebarContext } from "@/context/SidebarContext"
import { ArrowRight, FileText, Plus, Sparkles, ArrowLeft } from "lucide-react"

// Suggested page topics - defined outside component to prevent recreation
const pageSuggestions = [
  {
    title: "Getting Started Guide",
    description: "A comprehensive introduction to your topic",
  },
  {
    title: "Best Practices",
    description: "Industry standards and recommendations",
  },
  {
    title: "Deep Dive Analysis",
    description: "In-depth exploration of a subject",
  },
  {
    title: "Comparison Guide",
    description: "Side-by-side analysis of options",
  },
  {
    title: "Tutorial",
    description: "Step-by-step instructions",
  },
] as const

function NewPagePageContent() {
  const router = useRouter()
  const { user, openAuthDialog } = useAuth()
  const [topic, setTopic] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const { setIsExpanded } = useSidebarContext()
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleNewChat = useCallback(() => {
    router.push("/")
  }, [router])

  const handleBack = useCallback(() => {
    router.push("/library")
  }, [router])

  const handleCreatePage = useCallback(async (pageTitle: string) => {
    if (!user?.id) {
      openAuthDialog()
      return
    }

    if (!pageTitle.trim()) {
      toast.error("Please enter a topic")
      return
    }

    setIsCreating(true)
    try {
      const pageId = id()
      await db.transact([
        db.tx.pages[pageId].update({
          title: pageTitle,
          content: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }),
        db.tx.pages[pageId].link({ user: user.id }),
      ])
      router.push(`/page/${pageId}`)
    } catch (error) {
      console.error("Error creating page:", error)
      toast.error("Failed to create page")
      setIsCreating(false)
    }
  }, [user?.id, openAuthDialog, router])

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    handleCreatePage(topic)
  }, [handleCreatePage, topic])

  const handleTopicChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTopic(e.target.value)
  }, [])

  // Auth check
  useEffect(() => {
    if (!user) {
      openAuthDialog()
    }
  }, [user, openAuthDialog])

  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#F0F0ED] dark:bg-[#191a1a] min-h-[100dvh]">
        <div className="text-center">
          <FileText className="w-12 h-12 text-[#64748B] mx-auto mb-4" />
          <h2 className="text-xl font-medium text-[#13343B] dark:text-[#e7e7e2] font-ui mb-2">
            Sign in to create pages
          </h2>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 bg-[#F0F0ED] dark:bg-[#191a1a] min-h-[100dvh] contain-layout">
        {/* Back button */}
        <div className="max-w-3xl mx-auto px-4 pt-6">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-sm text-[#64748B] hover:text-[#13343B] dark:hover:text-[#e7e7e2] font-ui mb-8 touch-manipulation"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Library
          </button>
        </div>

        {/* Hero Section */}
        <div className="max-w-3xl mx-auto px-4 py-8">
          {/* Cover image placeholder */}
          <div className="w-full h-40 bg-gradient-to-br from-[#E5E5E5] to-[#D5D5D5] dark:from-[#2a2a2a] dark:to-[#191a1a] rounded-xl mb-8" />

          {/* Main input */}
          <form onSubmit={handleSubmit} className="mb-12">
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={topic}
                onChange={handleTopicChange}
                placeholder="What's your Page about?"
                disabled={isCreating}
                className="w-full text-3xl md:text-4xl font-medium text-[#13343B] dark:text-[#e7e7e2] bg-transparent border-none outline-none placeholder:text-[#94A3B8] font-ui"
              />
              <button
                type="submit"
                disabled={!topic.trim() || isCreating}
                className={cn(
                  "absolute right-0 top-1/2 -translate-y-1/2 p-3 rounded-full transition-colors touch-manipulation",
                  topic.trim()
                    ? "bg-[#13343B] dark:bg-[#20B8CD] text-white hover:opacity-90"
                    : "bg-[#E5E5E5] dark:bg-[#2a2a2a] text-[#94A3B8]"
                )}
              >
                {isCreating ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <ArrowRight className="w-5 h-5" />
                )}
              </button>
            </div>

            {/* AI indicator */}
            <div className="flex items-center gap-2 mt-4 text-sm text-[#64748B]">
              <Sparkles className="w-4 h-4" />
              <span className="font-ui">AI will help you write this page</span>
            </div>
          </form>

          {/* Suggestions */}
          <div>
            <h3 className="text-sm font-medium text-[#64748B] mb-4 font-ui">
              Create a Page about...
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {pageSuggestions.map((suggestion) => (
                <button
                  key={suggestion.title}
                  onClick={() => handleCreatePage(suggestion.title)}
                  disabled={isCreating}
                  className="p-4 bg-white dark:bg-[#1f2121] border border-[#E5E5E5] dark:border-[#2a2a2a] rounded-xl text-left hover:border-[#20B8CD] transition-colors group touch-manipulation"
                >
                  <h4 className="text-sm font-medium text-[#13343B] dark:text-[#e7e7e2] mb-1 font-ui group-hover:text-[#20B8CD]">
                    {suggestion.title}
                  </h4>
                  <p className="text-xs text-[#64748B] font-ui">{suggestion.description}</p>
                  <div className="flex items-center gap-1 mt-3 text-xs text-[#20B8CD] opacity-0 group-hover:opacity-100 transition-opacity">
                    <Plus className="w-3 h-3" />
                    Create
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
    </div>
  )
}

// Memoize and export
const MemoizedNewPagePage = memo(NewPagePageContent)

export default function NewPagePage() {
  return <MemoizedNewPagePage />
}
