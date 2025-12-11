"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter, useParams } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import { db } from "@/lib/db"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import LeftSidebar from "@/app/component/LeftSidebar"
import {
  FileText,
  Share2,
  MoreHorizontal,
  Globe,
  Lock,
  Trash2,
  Copy,
  ArrowLeft,
  Image as ImageIcon,
  Plus,
  Eye,
  Edit3,
  Loader2,
  Square,
  User,
  Clock,
  RefreshCw,
  Sparkles,
  Send,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

// Section type for article structure
interface Section {
  id: string
  title: string
  content: string
  isGenerating?: boolean
  prompt?: string // User prompt for AI generation
  showPromptInput?: boolean // Show prompt input field
}

// Format relative time
const formatRelativeTime = (date: Date | number | undefined): string => {
  if (!date) return ""
  const now = new Date()
  const then = new Date(date)
  const diffMs = now.getTime() - then.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins} min ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`
  return then.toLocaleDateString()
}

export default function PageEditor() {
  const router = useRouter()
  const params = useParams()
  const pageId = params?.id as string
  const { user, openAuthDialog } = useAuth()

  // UI State
  const [isExpanded, setIsExpanded] = useState(false)
  const [sidebarMounted, setSidebarMounted] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [mode, setMode] = useState<"editing" | "preview">("editing")
  const [isGenerating, setIsGenerating] = useState(false)

  // Page content state
  const [title, setTitle] = useState("")
  const [coverImage, setCoverImage] = useState("")
  const [sections, setSections] = useState<Section[]>([])
  const [isPublic, setIsPublic] = useState(false)
  const [summary, setSummary] = useState("")

  // Refs
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const sectionRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map())
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const hasInitializedRef = useRef(false)
  const contentRef = useRef({ title, coverImage, sections, summary, isPublic })

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

  // Query page data with user profile
  const { data, isLoading } = db.useQuery(
    pageId
      ? {
          pages: {
            $: {
              where: { id: pageId },
            },
            user: {
              profile: {},
            },
          },
        }
      : null
  )

  const page = data?.pages?.[0]
  const authorName = page?.user?.profile?.firstName || user?.email?.split("@")[0] || "Author"

  // Initialize content from database - only once on first load
  useEffect(() => {
    if (page && !hasInitializedRef.current) {
      hasInitializedRef.current = true
      setTitle(page.title || "")
      setCoverImage(page.coverImage || "")
      setIsPublic(page.isPublic || false)
      setSummary(page.summary || "")

      // Initialize sections from content
      const savedContent = page.content as Section[] | undefined
      if (savedContent && Array.isArray(savedContent) && savedContent.length > 0) {
        setSections(savedContent)
      } else {
        // Default empty section with prompt input shown for new pages
        setSections([{ id: generateId(), title: "Introduction", content: "", showPromptInput: true }])
      }
    }
  }, [page])

  // Generate content for a single section with AI
  const generateSectionContent = async (sectionId: string, prompt: string) => {
    if (!prompt.trim()) {
      toast.error("Please enter a prompt")
      return
    }

    // Mark section as generating
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId ? { ...s, isGenerating: true, showPromptInput: false } : s
      )
    )
    setIsGenerating(true)

    try {
      const section = sections.find((s) => s.id === sectionId)
      const sectionTitle = section?.title || "Section"

      const response = await fetch("/api/generate-page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: title || "Untitled",
          sectionTitle,
          prompt,
          generateSingleSection: true,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to generate content")
      }

      // Get full text response
      const content = await response.text()

      // Update section with generated content
      setSections((prev) =>
        prev.map((s) =>
          s.id === sectionId ? { ...s, content, isGenerating: false, prompt } : s
        )
      )
    } catch (error) {
      console.error("Error generating content:", error)
      toast.error("Failed to generate content. You can write manually.")
      setSections((prev) =>
        prev.map((s) =>
          s.id === sectionId ? { ...s, isGenerating: false, showPromptInput: true } : s
        )
      )
    } finally {
      setIsGenerating(false)
    }
  }

  // Toggle prompt input visibility for a section
  const togglePromptInput = (sectionId: string) => {
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId ? { ...s, showPromptInput: !s.showPromptInput } : s
      )
    )
  }

  // Update section prompt
  const updateSectionPrompt = (sectionId: string, prompt: string) => {
    setSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, prompt } : s))
    )
  }

  // Keep content ref updated
  useEffect(() => {
    contentRef.current = { title, coverImage, sections, summary, isPublic }
  }, [title, coverImage, sections, summary, isPublic])

  // Auto-save function using ref to avoid re-renders
  const saveChanges = useCallback(async () => {
    if (!pageId || !user?.id) return

    const { title, coverImage, sections, summary, isPublic } = contentRef.current

    try {
      await db.transact(
        db.tx.pages[pageId].update({
          title,
          coverImage,
          content: sections,
          summary,
          isPublic,
          updatedAt: Date.now(),
        })
      )
    } catch (error) {
      console.error("Error saving page:", error)
    }
  }, [pageId, user?.id])

  // Debounced save on content changes
  useEffect(() => {
    if (!hasInitializedRef.current) return

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveChanges()
    }, 2000)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [title, coverImage, sections, summary, isPublic, saveChanges])

  const handleNewChat = () => {
    router.push("/")
  }

  const handleBack = () => {
    router.push("/library")
  }

  const handleDelete = async () => {
    if (!pageId) return

    try {
      await db.transact(db.tx.pages[pageId].delete())
      toast.success("Page deleted")
      router.push("/library")
    } catch (error) {
      console.error("Error deleting page:", error)
      toast.error("Failed to delete page")
    }
  }

  const handlePublish = async () => {
    if (!pageId) return

    try {
      const shareId = page?.shareId || generateShareId()
      await db.transact(
        db.tx.pages[pageId].update({
          isPublic: true,
          shareId,
          publishedAt: Date.now(),
          updatedAt: Date.now(),
        })
      )
      setIsPublic(true)

      const shareUrl = `${window.location.origin}/p/${shareId}`
      await navigator.clipboard.writeText(shareUrl)
      toast.success("Published! Link copied to clipboard")
    } catch (error) {
      console.error("Error publishing page:", error)
      toast.error("Failed to publish page")
    }
  }

  const handleMakePrivate = async () => {
    if (!pageId) return

    try {
      await db.transact(
        db.tx.pages[pageId].update({
          isPublic: false,
          updatedAt: Date.now(),
        })
      )
      setIsPublic(false)
      toast.success("Page is now a draft")
    } catch (error) {
      console.error("Error making page private:", error)
      toast.error("Failed to update page")
    }
  }

  // Section handlers
  const generateId = () => Math.random().toString(36).substring(2, 9)
  const generateShareId = () => Math.random().toString(36).substring(2, 12)

  const addSection = (afterId?: string) => {
    const newSection: Section = { id: generateId(), title: "New Section", content: "", showPromptInput: true }
    if (afterId) {
      const index = sections.findIndex((s) => s.id === afterId)
      const newSections = [...sections]
      newSections.splice(index + 1, 0, newSection)
      setSections(newSections)
    } else {
      setSections([...sections, newSection])
    }
  }

  const updateSection = (id: string, updates: Partial<Section>) => {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)))
  }

  const deleteSection = (id: string) => {
    if (sections.length <= 1) {
      toast.error("Cannot delete the only section")
      return
    }
    setSections((prev) => prev.filter((s) => s.id !== id))
  }

  // Auto-resize textarea
  const autoResize = (textarea: HTMLTextAreaElement) => {
    textarea.style.height = "auto"
    textarea.style.height = `${textarea.scrollHeight}px`
  }

  // Scroll to section
  const scrollToSection = (id: string) => {
    const element = document.getElementById(`section-${id}`)
    element?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  // Auth check
  useEffect(() => {
    if (!user && !isLoading) {
      openAuthDialog()
    }
  }, [user, isLoading, openAuthDialog])

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
              Sign in to view this page
            </h2>
          </div>
        </div>
      </>
    )
  }

  if (isLoading) {
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
            "flex-1 bg-[#F0F0ED] dark:bg-[#0F1516] min-h-screen transition-all duration-300",
            "md:ml-14",
            isExpanded && "md:ml-64"
          )}
        >
          <div className="max-w-4xl mx-auto px-4 py-8 animate-pulse">
            <div className="h-48 bg-[#E5E5E5] dark:bg-[#333] rounded-xl mb-8" />
            <div className="h-12 bg-[#E5E5E5] dark:bg-[#333] rounded w-2/3 mb-8" />
            <div className="space-y-4">
              <div className="h-6 bg-[#E5E5E5] dark:bg-[#333] rounded w-full" />
              <div className="h-6 bg-[#E5E5E5] dark:bg-[#333] rounded w-4/5" />
              <div className="h-6 bg-[#E5E5E5] dark:bg-[#333] rounded w-3/4" />
            </div>
          </div>
        </div>
      </>
    )
  }

  if (!page) {
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
              Page not found
            </h2>
            <button onClick={handleBack} className="text-[#20B8CD] hover:underline font-ui">
              Back to Library
            </button>
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
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[#F0F0ED] dark:bg-[#0F1516] border-b border-[#E5E5E5] dark:border-[#333]">
          <div className="max-w-6xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              {/* Left: Status */}
              <div className="flex items-center gap-3">
                {isGenerating ? (
                  <span className="flex items-center gap-2 px-3 py-1 text-sm text-[#20B8CD] bg-[#20B8CD]/10 rounded-full font-ui">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Writing...
                  </span>
                ) : (
                  <span className="px-3 py-1 text-sm text-[#64748B] bg-[#E5E5E5] dark:bg-[#2A2A2A] rounded-full font-ui">
                    {isPublic ? "Published" : "Draft Page"}
                  </span>
                )}
              </div>

              {/* Right: Actions */}
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger className="p-2 text-[#64748B] hover:text-[#13343B] dark:hover:text-[#F8F8F7] rounded-lg hover:bg-[#E5E5E5] dark:hover:bg-[#2A2A2A]">
                    <MoreHorizontal className="w-5 h-5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="bg-white dark:bg-[#1A1A1A] border border-[#E5E5E5] dark:border-[#333] rounded-xl"
                  >
                    {isPublic && (
                      <>
                        <DropdownMenuItem
                          onClick={async () => {
                            const shareUrl = `${window.location.origin}/p/${page.shareId}`
                            await navigator.clipboard.writeText(shareUrl)
                            toast.success("Link copied")
                          }}
                        >
                          <Copy className="w-4 h-4 mr-2" />
                          Copy link
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleMakePrivate}>
                          <Lock className="w-4 h-4 mr-2" />
                          Unpublish
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    <DropdownMenuItem
                      className="text-red-600"
                      onClick={() => setShowDeleteDialog(true)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete page
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {mode === "editing" ? (
                  <button
                    onClick={() => setMode("preview")}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#64748B] hover:text-[#13343B] dark:hover:text-[#F8F8F7] font-ui"
                  >
                    <Eye className="w-4 h-4" />
                    Preview
                  </button>
                ) : (
                  <button
                    onClick={() => setMode("editing")}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#64748B] hover:text-[#13343B] dark:hover:text-[#F8F8F7] font-ui"
                  >
                    <Edit3 className="w-4 h-4" />
                    Continue Editing
                  </button>
                )}

                <button
                  onClick={handlePublish}
                  disabled={isGenerating}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white bg-[#20B8CD] hover:bg-[#1AA3B6] rounded-lg transition-colors disabled:opacity-50 font-ui"
                >
                  <Share2 className="w-4 h-4" />
                  Publish
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content with TOC */}
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex gap-8">
            {/* Main Content */}
            <div className="flex-1 max-w-3xl">
              {/* Cover Image */}
              <div className="relative h-56 bg-gradient-to-br from-[#E5E5E5] to-[#D5D5D5] dark:from-[#2A2A2A] dark:to-[#1A1A1A] rounded-xl mb-6 overflow-hidden group">
                {coverImage ? (
                  <img src={coverImage} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-12 h-12 text-[#94A3B8]" />
                  </div>
                )}
                {mode === "editing" && (
                  <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="px-3 py-1.5 text-sm text-white bg-black/50 hover:bg-black/70 rounded-lg font-ui flex items-center gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5" />
                      Change
                    </button>
                  </div>
                )}
              </div>

              {/* Title */}
              <div className="mb-6">
                {mode === "editing" ? (
                  <textarea
                    ref={titleRef}
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value)
                      autoResize(e.target)
                    }}
                    placeholder="Page Title"
                    className="w-full text-4xl font-semibold text-[#13343B] dark:text-[#F8F8F7] bg-transparent border-none outline-none resize-none placeholder:text-[#94A3B8] font-ui"
                    rows={1}
                  />
                ) : (
                  <h1 className="text-4xl font-semibold text-[#13343B] dark:text-[#F8F8F7] font-ui">
                    {title || "Untitled"}
                  </h1>
                )}

                {/* Author info */}
                <div className="flex items-center gap-4 mt-4 text-sm text-[#64748B]">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-[#20B8CD] flex items-center justify-center">
                      <User className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="font-ui">Curated by {authorName}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{formatRelativeTime(page.updatedAt)}</span>
                  </div>
                </div>
              </div>

              {/* Summary/Introduction */}
              {(summary || mode === "editing") && (
                <div className="mb-8">
                  {mode === "editing" ? (
                    <textarea
                      value={summary}
                      onChange={(e) => {
                        setSummary(e.target.value)
                        autoResize(e.target)
                      }}
                      placeholder="Write a brief introduction or summary..."
                      className="w-full text-lg text-[#13343B] dark:text-[#F8F8F7] leading-relaxed bg-transparent border-none outline-none resize-none placeholder:text-[#94A3B8] font-body"
                      rows={3}
                    />
                  ) : (
                    <p className="text-lg text-[#13343B] dark:text-[#F8F8F7] leading-relaxed font-body">
                      {summary}
                    </p>
                  )}
                </div>
              )}

              {/* Sections */}
              <div className="space-y-8">
                {sections.map((section, index) => (
                  <div key={section.id} id={`section-${section.id}`}>
                    {/* Insert Section button */}
                    {mode === "editing" && index > 0 && (
                      <div className="flex items-center gap-2 my-4 group/insert">
                        <div className="flex-1 h-px bg-[#E5E5E5] dark:bg-[#333]" />
                        <button
                          onClick={() => addSection(sections[index - 1]?.id)}
                          className="flex items-center gap-1 px-3 py-1 text-xs text-[#64748B] hover:text-[#20B8CD] opacity-0 group-hover/insert:opacity-100 transition-opacity font-ui"
                        >
                          <Plus className="w-3 h-3" />
                          Insert Section
                        </button>
                        <div className="flex-1 h-px bg-[#E5E5E5] dark:bg-[#333]" />
                      </div>
                    )}

                    {/* Section */}
                    <section className="group/section">
                      {/* Section Title */}
                      <div className="flex items-center gap-2 mb-3">
                        {mode === "editing" ? (
                          <input
                            value={section.title}
                            onChange={(e) => updateSection(section.id, { title: e.target.value })}
                            className="text-2xl font-semibold text-[#20B8CD] bg-transparent border-none outline-none font-ui flex-1"
                            placeholder="Section Title"
                          />
                        ) : (
                          <h2 className="text-2xl font-semibold text-[#20B8CD] font-ui">
                            {section.title}
                          </h2>
                        )}
                        {mode === "editing" && sections.length > 1 && (
                          <button
                            onClick={() => deleteSection(section.id)}
                            className="p-1 text-[#64748B] hover:text-red-500 opacity-0 group-hover/section:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* Section Content */}
                      {section.isGenerating ? (
                        <div className="flex items-center gap-2 py-4 text-[#64748B]">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-sm font-ui">Generating content...</span>
                        </div>
                      ) : mode === "editing" ? (
                        <>
                          {/* AI Prompt Input */}
                          {section.showPromptInput && (
                            <div className="mb-4 p-4 bg-[#F5F5F5] dark:bg-[#1A1A1A] rounded-xl border border-[#E5E5E5] dark:border-[#333]">
                              <div className="flex items-center gap-2 mb-3 text-sm text-[#20B8CD]">
                                <Sparkles className="w-4 h-4" />
                                <span className="font-ui font-medium">Generate with AI</span>
                              </div>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={section.prompt || ""}
                                  onChange={(e) => updateSectionPrompt(section.id, e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                      e.preventDefault()
                                      generateSectionContent(section.id, section.prompt || "")
                                    }
                                  }}
                                  placeholder="Describe what you want to write about..."
                                  className="flex-1 px-3 py-2 text-sm text-[#13343B] dark:text-[#F8F8F7] bg-white dark:bg-[#0F1516] border border-[#E5E5E5] dark:border-[#333] rounded-lg placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#20B8CD] font-ui"
                                />
                                <button
                                  onClick={() => generateSectionContent(section.id, section.prompt || "")}
                                  disabled={!section.prompt?.trim()}
                                  className="px-4 py-2 text-sm font-medium text-white bg-[#20B8CD] hover:bg-[#1AA3B6] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors font-ui flex items-center gap-2"
                                >
                                  <Send className="w-4 h-4" />
                                  Generate
                                </button>
                              </div>
                              <button
                                onClick={() => togglePromptInput(section.id)}
                                className="mt-2 text-xs text-[#64748B] hover:text-[#13343B] dark:hover:text-[#F8F8F7] font-ui"
                              >
                                or write manually
                              </button>
                            </div>
                          )}

                          {/* Content textarea */}
                          <textarea
                            ref={(el) => {
                              if (el) {
                                sectionRefs.current.set(section.id, el)
                                autoResize(el)
                              }
                            }}
                            value={section.content}
                            onChange={(e) => {
                              updateSection(section.id, { content: e.target.value })
                              autoResize(e.target)
                            }}
                            placeholder="Write your content here..."
                            className="w-full text-base text-[#13343B] dark:text-[#F8F8F7] leading-relaxed bg-transparent border-none outline-none resize-none placeholder:text-[#94A3B8] font-body"
                            rows={4}
                          />

                          {/* Action buttons */}
                          <div className="flex items-center gap-2 mt-4 opacity-0 group-hover/section:opacity-100 transition-opacity">
                            {!section.showPromptInput && (
                              <button
                                onClick={() => togglePromptInput(section.id)}
                                className="flex items-center gap-2 px-4 py-2 text-sm text-[#20B8CD] bg-[#20B8CD]/10 rounded-lg hover:bg-[#20B8CD]/20 transition-colors font-ui"
                              >
                                <Sparkles className="w-4 h-4" />
                                Generate with AI
                              </button>
                            )}
                            <button className="flex items-center gap-2 px-4 py-2 text-sm text-[#64748B] bg-[#F5F5F5] dark:bg-[#2A2A2A] rounded-lg hover:text-[#20B8CD] transition-colors font-ui">
                              <ImageIcon className="w-4 h-4" />
                              Add Media
                            </button>
                          </div>
                        </>
                      ) : (
                        <p className="text-base text-[#13343B] dark:text-[#F8F8F7] leading-relaxed whitespace-pre-wrap font-body">
                          {section.content}
                        </p>
                      )}
                    </section>
                  </div>
                ))}

                {/* Add Section button at end */}
                {mode === "editing" && (
                  <button
                    onClick={() => addSection()}
                    className="flex items-center justify-center gap-2 w-full py-3 text-sm text-[#20B8CD] border border-dashed border-[#20B8CD]/30 rounded-xl hover:bg-[#20B8CD]/5 transition-colors font-ui"
                  >
                    <Plus className="w-4 h-4" />
                    Add Section
                  </button>
                )}
              </div>
            </div>

            {/* Table of Contents - Desktop only */}
            <div className="hidden lg:block w-56 flex-shrink-0">
              <div className="sticky top-24">
                <h3 className="text-sm font-medium text-[#13343B] dark:text-[#F8F8F7] mb-3 font-ui">
                  Contents
                </h3>
                <nav className="space-y-1">
                  {sections.map((section, index) => (
                    <button
                      key={section.id}
                      onClick={() => scrollToSection(section.id)}
                      className="flex items-start gap-2 w-full text-left py-1.5 text-sm text-[#64748B] hover:text-[#20B8CD] transition-colors font-ui"
                    >
                      <span className="w-0.5 h-4 bg-[#20B8CD] rounded-full mt-0.5 flex-shrink-0" />
                      <span className="line-clamp-2">{section.title || `Section ${index + 1}`}</span>
                    </button>
                  ))}
                </nav>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stop button while generating */}
      {isGenerating && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
          <button
            onClick={() => setIsGenerating(false)}
            className="flex items-center gap-2 px-4 py-2 text-sm text-[#13343B] bg-white dark:bg-[#1A1A1A] border border-[#E5E5E5] dark:border-[#333] rounded-full shadow-lg hover:shadow-xl transition-shadow font-ui"
          >
            <Square className="w-3.5 h-3.5" />
            Stop
          </button>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-white dark:bg-[#1A1A1A] border border-[#E5E5E5] dark:border-[#333]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#13343B] dark:text-[#F8F8F7]">
              Delete this page?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#64748B]">
              This action cannot be undone. This will permanently delete this page and all its content.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#E5E5E5] dark:border-[#333]">Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
