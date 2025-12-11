"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import { db } from "@/lib/db"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { id } from "@instantdb/react"
import LeftSidebar from "@/app/component/LeftSidebar"
import { ArrowRight, FileText, Plus, Sparkles, ArrowLeft } from "lucide-react"

// Suggested page topics
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
]

export default function NewPagePage() {
  const router = useRouter()
  const { user, openAuthDialog } = useAuth()
  const [topic, setTopic] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [sidebarMounted, setSidebarMounted] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Load sidebar state
  useEffect(() => {
    const saved = localStorage.getItem("sidebarExpanded")
    if (saved) setIsExpanded(JSON.parse(saved))
    setSidebarMounted(true)
  }, [])

  // Persist sidebar state
  useEffect(() => {
    if (sidebarMounted) {
      localStorage.setItem("sidebarExpanded", JSON.stringify(isExpanded))
    }
  }, [isExpanded, sidebarMounted])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleNewChat = () => {
    router.push("/")
  }

  const handleBack = () => {
    router.push("/library")
  }

  const handleCreatePage = async (pageTitle: string) => {
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
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleCreatePage(topic)
  }

  // Auth check
  useEffect(() => {
    if (!user) {
      openAuthDialog()
    }
  }, [user, openAuthDialog])

  if (!user) {
    return (
      <>
        <div className="hidden md:block">
          <LeftSidebar
            onNewChat={handleNewChat}
            isExpanded={isExpanded}
            setIsExpanded={setIsExpanded}
            isHydrating={!sidebarMounted}
          />
        </div>
        <div
          className={cn(
            "flex-1 flex items-center justify-center bg-[#F0F0ED] dark:bg-[#0F1516] min-h-screen transition-all duration-300",
            "md:ml-14",
            isExpanded && "md:ml-64"
          )}
        >
          <div className="text-center">
            <FileText className="w-12 h-12 text-[#64748B] mx-auto mb-4" />
            <h2 className="text-xl font-medium text-[#13343B] dark:text-[#F8F8F7] font-ui mb-2">
              Sign in to create pages
            </h2>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <LeftSidebar
          onNewChat={handleNewChat}
          isExpanded={isExpanded}
          setIsExpanded={setIsExpanded}
          isHydrating={!sidebarMounted}
        />
      </div>

      {/* Mobile Sidebar with overlay */}
      <div className="md:hidden">
        <LeftSidebar
          onNewChat={handleNewChat}
          isExpanded={isExpanded}
          setIsExpanded={setIsExpanded}
          isHydrating={!sidebarMounted}
        />
        {isExpanded && (
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setIsExpanded(false)} />
        )}
      </div>

      <div
        className={cn(
          "flex-1 bg-[#F0F0ED] dark:bg-[#0F1516] min-h-screen transition-all duration-300",
          "md:ml-14",
          isExpanded && "md:ml-64"
        )}
      >
        {/* Back button */}
        <div className="max-w-3xl mx-auto px-4 pt-6">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-sm text-[#64748B] hover:text-[#13343B] dark:hover:text-[#F8F8F7] font-ui mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Library
          </button>
        </div>

        {/* Hero Section */}
        <div className="max-w-3xl mx-auto px-4 py-8">
          {/* Cover image placeholder */}
          <div className="w-full h-40 bg-gradient-to-br from-[#E5E5E5] to-[#D5D5D5] dark:from-[#2A2A2A] dark:to-[#1A1A1A] rounded-xl mb-8" />

          {/* Main input */}
          <form onSubmit={handleSubmit} className="mb-12">
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="What's your Page about?"
                disabled={isCreating}
                className="w-full text-3xl md:text-4xl font-medium text-[#13343B] dark:text-[#F8F8F7] bg-transparent border-none outline-none placeholder:text-[#94A3B8] font-ui"
              />
              <button
                type="submit"
                disabled={!topic.trim() || isCreating}
                className={cn(
                  "absolute right-0 top-1/2 -translate-y-1/2 p-3 rounded-full transition-colors",
                  topic.trim()
                    ? "bg-[#13343B] dark:bg-[#20B8CD] text-white hover:opacity-90"
                    : "bg-[#E5E5E5] dark:bg-[#2A2A2A] text-[#94A3B8]"
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
                  className="p-4 bg-white dark:bg-[#1A1A1A] border border-[#E5E5E5] dark:border-[#333] rounded-xl text-left hover:border-[#20B8CD] transition-colors group"
                >
                  <h4 className="text-sm font-medium text-[#13343B] dark:text-[#F8F8F7] mb-1 font-ui group-hover:text-[#20B8CD]">
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
    </>
  )
}
