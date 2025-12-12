"use client"

import { useState, useEffect, useCallback, useMemo, memo } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import { db } from "@/lib/db"
import { Library, Search, Clock, MoreHorizontal, Trash2, Plus, ListFilter, FileText, Globe } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useSidebarContext } from "@/context/SidebarContext"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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

type TabType = "threads" | "pages"

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

function LibraryPageContent() {
  const router = useRouter()
  const { user, openAuthDialog } = useAuth()
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState<TabType>("threads")
  const [threadToDelete, setThreadToDelete] = useState<string | null>(null)
  const [pageToDelete, setPageToDelete] = useState<string | null>(null)
  const { setIsExpanded } = useSidebarContext()

  const handleNewChat = useCallback(() => {
    router.push("/")
  }, [router])

  // Query threads for the current user
  const { data: threadsData, isLoading: threadsLoading } = db.useQuery(
    user?.id
      ? {
          threads: {
            $: {
              where: { "user.id": user.id },
              order: { updatedAt: "desc" },
            },
            messages: {
              $: {
                limit: 1,
                order: { createdAt: "asc" },
              },
            },
          },
        }
      : null
  )

  // Query pages for the current user
  const { data: pagesData, isLoading: pagesLoading } = db.useQuery(
    user?.id
      ? {
          pages: {
            $: {
              where: { "user.id": user.id },
              order: { updatedAt: "desc" },
            },
          },
        }
      : null
  )

  const threads = threadsData?.threads || []
  const pages = pagesData?.pages || []

  // Memoize filtered lists
  const filteredThreads = useMemo(() =>
    searchQuery.trim()
      ? threads.filter((thread: any) =>
          thread.title?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : threads,
    [threads, searchQuery]
  )

  const filteredPages = useMemo(() =>
    searchQuery.trim()
      ? pages.filter((page: any) =>
          page.title?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : pages,
    [pages, searchQuery]
  )

  const handleThreadClick = useCallback((threadId: string) => {
    router.push(`/chat/${threadId}`)
  }, [router])

  const handlePageClick = useCallback((pageId: string) => {
    router.push(`/page/${pageId}`)
  }, [router])

  const handleDeleteThread = useCallback(async (threadId: string) => {
    try {
      await db.transact(db.tx.threads[threadId].delete())
      toast.success("Thread deleted")
    } catch (error) {
      console.error("Error deleting thread:", error)
      toast.error("Failed to delete thread")
    }
  }, [])

  const handleDeletePage = useCallback(async (pageId: string) => {
    try {
      await db.transact(db.tx.pages[pageId].delete())
      toast.success("Page deleted")
    } catch (error) {
      console.error("Error deleting page:", error)
      toast.error("Failed to delete page")
    }
  }, [])

  const handleCreatePage = useCallback(() => {
    router.push("/page/new")
  }, [router])

  const isLoading = activeTab === "threads" ? threadsLoading : pagesLoading

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!user) {
      openAuthDialog()
    }
  }, [user, openAuthDialog])

  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#F0F0ED] dark:bg-[#191a1a] min-h-screen">
        <div className="text-center">
          <Library className="w-12 h-12 text-[#64748B] mx-auto mb-4" />
          <h2 className="text-xl font-medium text-[#13343B] dark:text-[#e7e7e2] font-ui mb-2">
            Sign in to view your library
          </h2>
          <p className="text-[#64748B] text-sm">
            Your threads and conversations will appear here
          </p>
        </div>
      </div>
    )
  }

  // Memoize search change handler
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
  }, [])

  // Memoize tab handlers
  const handleTabThreads = useCallback(() => setActiveTab("threads"), [])
  const handleTabPages = useCallback(() => setActiveTab("pages"), [])

  return (
    <div className="flex-1 bg-[#F0F0ED] dark:bg-[#191a1a] min-h-[100dvh] contain-layout">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[#F0F0ED] dark:bg-[#191a1a] border-b border-[#E5E5E5] dark:border-[#2a2a2a]">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between gap-4">
              {/* Title */}
              <div className="flex items-center gap-3">
                <Library className="w-6 h-6 text-[#20B8CD]" />
                <h1 className="text-2xl font-medium text-[#13343B] dark:text-[#e7e7e2] font-ui">
                  Library
                </h1>
              </div>

              {/* Search */}
              <div className="flex-1 max-w-md">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
                  <input
                    type="text"
                    placeholder="Search your threads..."
                    value={searchQuery}
                    onChange={handleSearchChange}
                    className="w-full pl-10 pr-4 py-2 bg-white dark:bg-[#1f2121] border border-[#E5E5E5] dark:border-[#2a2a2a] rounded-xl text-sm text-[#13343B] dark:text-[#e7e7e2] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#20B8CD] focus:border-transparent font-ui"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-4xl mx-auto px-4 py-6">
          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button
              onClick={handleNewChat}
              className="flex items-center justify-between p-4 bg-white dark:bg-[#1f2121] border border-[#E5E5E5] dark:border-[#2a2a2a] rounded-xl hover:border-[#20B8CD] transition-colors group"
            >
              <div className="flex items-center gap-3">
                <ListFilter className="w-5 h-5 text-[#64748B] group-hover:text-[#20B8CD]" />
                <span className="text-sm font-medium text-[#13343B] dark:text-[#e7e7e2] font-ui">Thread</span>
              </div>
              <Plus className="w-4 h-4 text-[#64748B] group-hover:text-[#20B8CD]" />
            </button>
            <button
              onClick={handleCreatePage}
              className="flex items-center justify-between p-4 bg-white dark:bg-[#1f2121] border border-[#E5E5E5] dark:border-[#2a2a2a] rounded-xl hover:border-[#20B8CD] transition-colors group"
            >
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-[#64748B] group-hover:text-[#20B8CD]" />
                <span className="text-sm font-medium text-[#13343B] dark:text-[#e7e7e2] font-ui">Page</span>
              </div>
              <Plus className="w-4 h-4 text-[#64748B] group-hover:text-[#20B8CD]" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-4 mb-4 border-b border-[#E5E5E5] dark:border-[#2a2a2a]">
            <button
              onClick={handleTabThreads}
              className={cn(
                "px-1 py-2 text-sm font-medium font-ui transition-colors touch-manipulation",
                activeTab === "threads"
                  ? "text-[#13343B] dark:text-[#e7e7e2] border-b-2 border-[#20B8CD]"
                  : "text-[#64748B] hover:text-[#13343B] dark:hover:text-[#e7e7e2]"
              )}
            >
              Threads
              {threads.length > 0 && (
                <span className="ml-1.5 text-xs text-[#64748B]">({threads.length})</span>
              )}
            </button>
            <button
              onClick={handleTabPages}
              className={cn(
                "px-1 py-2 text-sm font-medium font-ui transition-colors touch-manipulation",
                activeTab === "pages"
                  ? "text-[#13343B] dark:text-[#e7e7e2] border-b-2 border-[#20B8CD]"
                  : "text-[#64748B] hover:text-[#13343B] dark:hover:text-[#e7e7e2]"
              )}
            >
              Pages
              {pages.length > 0 && (
                <span className="ml-1.5 text-xs text-[#64748B]">({pages.length})</span>
              )}
            </button>
            <div className="flex-1" />
            <button className="p-1.5 text-[#64748B] hover:text-[#13343B] dark:hover:text-[#e7e7e2] rounded-lg hover:bg-[#E5E5E5] dark:hover:bg-[#2a2a2a]">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>

          {/* Content List */}
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="p-4 bg-white dark:bg-[#1f2121] rounded-xl animate-pulse">
                  <div className="h-5 bg-[#E5E5E5] dark:bg-[#2a2a2a] rounded w-2/3 mb-2" />
                  <div className="h-4 bg-[#E5E5E5] dark:bg-[#2a2a2a] rounded w-full mb-2" />
                  <div className="h-3 bg-[#E5E5E5] dark:bg-[#2a2a2a] rounded w-24" />
                </div>
              ))}
            </div>
          ) : activeTab === "threads" ? (
            // Threads List
            filteredThreads.length === 0 ? (
              <div className="p-8 bg-[#F5F5F5] dark:bg-[#1f2121] rounded-xl text-center">
                <ListFilter className="w-10 h-10 text-[#64748B] mx-auto mb-3" />
                <p className="text-[#64748B] font-ui mb-3">
                  {searchQuery ? `No threads matching "${searchQuery}"` : "No threads yet"}
                </p>
                <button
                  onClick={handleNewChat}
                  className="text-sm text-[#20B8CD] hover:underline font-ui"
                >
                  Start a new thread
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredThreads.map((thread: any) => {
                  const firstMessage = thread.messages?.[0]
                  const preview = firstMessage?.content?.slice(0, 150) || ""

                  return (
                    <div
                      key={thread.id}
                      className="group p-4 bg-white dark:bg-[#1f2121] border border-[#E5E5E5] dark:border-[#2a2a2a] rounded-xl hover:border-[#20B8CD] dark:hover:border-[#20B8CD] transition-colors cursor-pointer"
                      onClick={() => handleThreadClick(thread.id)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-medium text-[#13343B] dark:text-[#e7e7e2] font-ui mb-1 truncate">
                            {thread.title || "Untitled Thread"}
                          </h3>
                          {preview && (
                            <p className="text-sm text-[#64748B] line-clamp-2 mb-2 font-ui">
                              {preview}...
                            </p>
                          )}
                          <div className="flex items-center gap-1.5 text-xs text-[#94A3B8]">
                            <Clock className="w-3 h-3" />
                            <span>{formatRelativeTime(thread.updatedAt)}</span>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            className="p-1.5 text-[#64748B] hover:text-[#13343B] dark:hover:text-[#e7e7e2] rounded-lg hover:bg-[#F5F5F5] dark:hover:bg-[#2a2a2a] md:opacity-0 md:group-hover:opacity-100 transition-opacity touch-manipulation"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="bg-white dark:bg-[#1f2121] border border-[#E5E5E5] dark:border-[#2a2a2a] rounded-xl"
                          >
                            <DropdownMenuItem
                              className="text-red-600 cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation()
                                setThreadToDelete(thread.id)
                              }}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          ) : (
            // Pages Grid
            filteredPages.length === 0 ? (
              <div className="p-8 bg-[#F5F5F5] dark:bg-[#1f2121] rounded-xl text-center">
                <FileText className="w-10 h-10 text-[#64748B] mx-auto mb-3" />
                <p className="text-[#64748B] font-ui mb-3">
                  {searchQuery ? `No pages matching "${searchQuery}"` : "No pages yet"}
                </p>
                <button
                  onClick={handleCreatePage}
                  className="text-sm text-[#20B8CD] hover:underline font-ui"
                >
                  Create your first page
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredPages.map((page: any) => (
                  <div
                    key={page.id}
                    className="group p-4 bg-white dark:bg-[#1f2121] border border-[#E5E5E5] dark:border-[#2a2a2a] rounded-xl hover:border-[#20B8CD] dark:hover:border-[#20B8CD] transition-colors cursor-pointer"
                    onClick={() => handlePageClick(page.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-medium text-[#13343B] dark:text-[#e7e7e2] font-ui mb-1 truncate">
                          {page.title || "Untitled Page"}
                        </h3>
                        {page.summary && (
                          <p className="text-sm text-[#64748B] line-clamp-2 mb-2 font-ui">
                            {page.summary}
                          </p>
                        )}
                        <div className="flex items-center gap-3 text-xs text-[#94A3B8]">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3 h-3" />
                            <span>{formatRelativeTime(page.updatedAt)}</span>
                          </div>
                          {page.isPublic ? (
                            <div className="flex items-center gap-1 text-[#64748B]">
                              <Globe className="w-3 h-3" />
                              <span>{page.viewCount || 0} views</span>
                            </div>
                          ) : (
                            <span className="px-2 py-0.5 text-[#64748B] bg-[#F5F5F5] dark:bg-[#2a2a2a] rounded font-ui">
                              Draft
                            </span>
                          )}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          className="p-1.5 text-[#64748B] hover:text-[#13343B] dark:hover:text-[#e7e7e2] rounded-lg hover:bg-[#F5F5F5] dark:hover:bg-[#2a2a2a] md:opacity-0 md:group-hover:opacity-100 transition-opacity touch-manipulation"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="bg-white dark:bg-[#1f2121] border border-[#E5E5E5] dark:border-[#2a2a2a] rounded-xl"
                        >
                          <DropdownMenuItem
                            className="text-red-600 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation()
                              setPageToDelete(page.id)
                            }}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        {/* Delete Thread Confirmation Dialog */}
        <AlertDialog open={!!threadToDelete} onOpenChange={() => setThreadToDelete(null)}>
          <AlertDialogContent className="bg-white dark:bg-[#1f2121] border border-[#E5E5E5] dark:border-[#2a2a2a]">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-[#13343B] dark:text-[#e7e7e2]">
                Delete this thread?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-[#64748B]">
                This action cannot be undone. This will permanently delete this thread.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-[#E5E5E5] dark:border-[#2a2a2a]">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={() => {
                  if (threadToDelete) {
                    handleDeleteThread(threadToDelete)
                    setThreadToDelete(null)
                  }
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Page Confirmation Dialog */}
        <AlertDialog open={!!pageToDelete} onOpenChange={() => setPageToDelete(null)}>
          <AlertDialogContent className="bg-white dark:bg-[#1f2121] border border-[#E5E5E5] dark:border-[#2a2a2a]">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-[#13343B] dark:text-[#e7e7e2]">
                Delete this page?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-[#64748B]">
                This action cannot be undone. This will permanently delete this page and all its content.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-[#E5E5E5] dark:border-[#2a2a2a]">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={() => {
                  if (pageToDelete) {
                    handleDeletePage(pageToDelete)
                    setPageToDelete(null)
                  }
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
    </div>
  )
}

// Memoize and export
const MemoizedLibraryPage = memo(LibraryPageContent)

export default function LibraryPage() {
  return <MemoizedLibraryPage />
}
