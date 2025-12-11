"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import { db } from "@/lib/db"
import { Library, Search, Clock, MoreHorizontal, Trash2, Plus, ListFilter, FileText, Globe } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import LeftSidebar from "@/app/component/LeftSidebar"
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

export default function LibraryPage() {
  const router = useRouter()
  const { user, openAuthDialog } = useAuth()
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState<TabType>("threads")
  const [threadToDelete, setThreadToDelete] = useState<string | null>(null)
  const [pageToDelete, setPageToDelete] = useState<string | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const [sidebarMounted, setSidebarMounted] = useState(false)

  // Load sidebar state
  useEffect(() => {
    const saved = localStorage.getItem('sidebarExpanded')
    if (saved) setIsExpanded(JSON.parse(saved))
    setSidebarMounted(true)
  }, [])

  // Persist sidebar state
  useEffect(() => {
    if (sidebarMounted) {
      localStorage.setItem('sidebarExpanded', JSON.stringify(isExpanded))
    }
  }, [isExpanded, sidebarMounted])

  const handleNewChat = () => {
    router.push("/")
  }

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

  // Filter based on search query
  const filteredThreads = searchQuery.trim()
    ? threads.filter((thread: any) =>
        thread.title?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : threads

  const filteredPages = searchQuery.trim()
    ? pages.filter((page: any) =>
        page.title?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : pages

  const handleThreadClick = (threadId: string) => {
    router.push(`/chat/${threadId}`)
  }

  const handlePageClick = (pageId: string) => {
    router.push(`/page/${pageId}`)
  }

  const handleDeleteThread = async (threadId: string) => {
    try {
      await db.transact(db.tx.threads[threadId].delete())
      toast.success("Thread deleted")
    } catch (error) {
      console.error("Error deleting thread:", error)
      toast.error("Failed to delete thread")
    }
  }

  const handleDeletePage = async (pageId: string) => {
    try {
      await db.transact(db.tx.pages[pageId].delete())
      toast.success("Page deleted")
    } catch (error) {
      console.error("Error deleting page:", error)
      toast.error("Failed to delete page")
    }
  }

  const handleCreatePage = () => {
    router.push("/page/new")
  }

  const isLoading = activeTab === "threads" ? threadsLoading : pagesLoading

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!user) {
      openAuthDialog()
    }
  }, [user, openAuthDialog])

  if (!user) {
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

        <div className={cn(
          "flex-1 flex items-center justify-center bg-[#F0F0ED] dark:bg-[#0F1516] min-h-screen transition-all duration-300",
          "md:ml-14",
          isExpanded && "md:ml-64"
        )}>
          <div className="text-center">
            <Library className="w-12 h-12 text-[#64748B] mx-auto mb-4" />
            <h2 className="text-xl font-medium text-[#13343B] dark:text-[#F8F8F7] font-ui mb-2">
              Sign in to view your library
            </h2>
            <p className="text-[#64748B] text-sm">
              Your threads and conversations will appear here
            </p>
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
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setIsExpanded(false)}
          />
        )}
      </div>

      <div className={cn(
        "flex-1 bg-[#F0F0ED] dark:bg-[#0F1516] min-h-screen transition-all duration-300",
        "md:ml-14",
        isExpanded && "md:ml-64"
      )}>
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[#F0F0ED] dark:bg-[#0F1516] border-b border-[#E5E5E5] dark:border-[#333]">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between gap-4">
              {/* Title */}
              <div className="flex items-center gap-3">
                <Library className="w-6 h-6 text-[#20B8CD]" />
                <h1 className="text-2xl font-medium text-[#13343B] dark:text-[#F8F8F7] font-ui">
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
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white dark:bg-[#1A1A1A] border border-[#E5E5E5] dark:border-[#333] rounded-xl text-sm text-[#13343B] dark:text-[#F8F8F7] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#20B8CD] focus:border-transparent font-ui"
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
              className="flex items-center justify-between p-4 bg-white dark:bg-[#1A1A1A] border border-[#E5E5E5] dark:border-[#333] rounded-xl hover:border-[#20B8CD] transition-colors group"
            >
              <div className="flex items-center gap-3">
                <ListFilter className="w-5 h-5 text-[#64748B] group-hover:text-[#20B8CD]" />
                <span className="text-sm font-medium text-[#13343B] dark:text-[#F8F8F7] font-ui">Thread</span>
              </div>
              <Plus className="w-4 h-4 text-[#64748B] group-hover:text-[#20B8CD]" />
            </button>
            <button
              onClick={handleCreatePage}
              className="flex items-center justify-between p-4 bg-white dark:bg-[#1A1A1A] border border-[#E5E5E5] dark:border-[#333] rounded-xl hover:border-[#20B8CD] transition-colors group"
            >
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-[#64748B] group-hover:text-[#20B8CD]" />
                <span className="text-sm font-medium text-[#13343B] dark:text-[#F8F8F7] font-ui">Page</span>
              </div>
              <Plus className="w-4 h-4 text-[#64748B] group-hover:text-[#20B8CD]" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-4 mb-4 border-b border-[#E5E5E5] dark:border-[#333]">
            <button
              onClick={() => setActiveTab("threads")}
              className={cn(
                "px-1 py-2 text-sm font-medium font-ui transition-colors",
                activeTab === "threads"
                  ? "text-[#13343B] dark:text-[#F8F8F7] border-b-2 border-[#20B8CD]"
                  : "text-[#64748B] hover:text-[#13343B] dark:hover:text-[#F8F8F7]"
              )}
            >
              Threads
              {threads.length > 0 && (
                <span className="ml-1.5 text-xs text-[#64748B]">({threads.length})</span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("pages")}
              className={cn(
                "px-1 py-2 text-sm font-medium font-ui transition-colors",
                activeTab === "pages"
                  ? "text-[#13343B] dark:text-[#F8F8F7] border-b-2 border-[#20B8CD]"
                  : "text-[#64748B] hover:text-[#13343B] dark:hover:text-[#F8F8F7]"
              )}
            >
              Pages
              {pages.length > 0 && (
                <span className="ml-1.5 text-xs text-[#64748B]">({pages.length})</span>
              )}
            </button>
            <div className="flex-1" />
            <button className="p-1.5 text-[#64748B] hover:text-[#13343B] dark:hover:text-[#F8F8F7] rounded-lg hover:bg-[#E5E5E5] dark:hover:bg-[#2A2A2A]">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>

          {/* Content List */}
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="p-4 bg-white dark:bg-[#1A1A1A] rounded-xl animate-pulse">
                  <div className="h-5 bg-[#E5E5E5] dark:bg-[#333] rounded w-2/3 mb-2" />
                  <div className="h-4 bg-[#E5E5E5] dark:bg-[#333] rounded w-full mb-2" />
                  <div className="h-3 bg-[#E5E5E5] dark:bg-[#333] rounded w-24" />
                </div>
              ))}
            </div>
          ) : activeTab === "threads" ? (
            // Threads List
            filteredThreads.length === 0 ? (
              <div className="p-8 bg-[#F5F5F5] dark:bg-[#1A1A1A] rounded-xl text-center">
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
                      className="group p-4 bg-white dark:bg-[#1A1A1A] border border-[#E5E5E5] dark:border-[#333] rounded-xl hover:border-[#20B8CD] dark:hover:border-[#20B8CD] transition-colors cursor-pointer"
                      onClick={() => handleThreadClick(thread.id)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-medium text-[#13343B] dark:text-[#F8F8F7] font-ui mb-1 truncate">
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
                            className="p-1.5 text-[#64748B] hover:text-[#13343B] dark:hover:text-[#F8F8F7] rounded-lg hover:bg-[#F5F5F5] dark:hover:bg-[#2A2A2A] opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="bg-white dark:bg-[#1A1A1A] border border-[#E5E5E5] dark:border-[#333] rounded-xl"
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
              <div className="p-8 bg-[#F5F5F5] dark:bg-[#1A1A1A] rounded-xl text-center">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredPages.map((page: any) => (
                  <div
                    key={page.id}
                    className="group bg-white dark:bg-[#1A1A1A] border border-[#E5E5E5] dark:border-[#333] rounded-xl hover:border-[#20B8CD] dark:hover:border-[#20B8CD] transition-colors cursor-pointer overflow-hidden"
                    onClick={() => handlePageClick(page.id)}
                  >
                    {/* Cover Image */}
                    <div className="relative h-32 bg-gradient-to-br from-[#E5E5E5] to-[#D5D5D5] dark:from-[#2A2A2A] dark:to-[#1A1A1A]">
                      {page.coverImage ? (
                        <img
                          src={page.coverImage}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <FileText className="w-8 h-8 text-[#94A3B8]" />
                        </div>
                      )}
                      {/* Dropdown on hover */}
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          className="absolute top-2 right-2 p-1.5 text-white bg-black/30 hover:bg-black/50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="bg-white dark:bg-[#1A1A1A] border border-[#E5E5E5] dark:border-[#333] rounded-xl"
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

                    {/* Content */}
                    <div className="p-4">
                      <h3 className="text-base font-semibold text-[#13343B] dark:text-[#F8F8F7] font-ui mb-1 line-clamp-2">
                        {page.title || "Untitled Page"}
                      </h3>
                      {page.summary && (
                        <p className="text-sm text-[#64748B] line-clamp-2 mb-3 font-ui">
                          {page.summary}
                        </p>
                      )}
                      {/* Footer with status */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[#94A3B8]">
                          {formatRelativeTime(page.updatedAt)}
                        </span>
                        {page.isPublic ? (
                          <div className="flex items-center gap-1 text-xs text-[#64748B]">
                            <Globe className="w-3 h-3" />
                            <span>{page.viewCount || 0}</span>
                          </div>
                        ) : (
                          <span className="px-2 py-0.5 text-xs text-[#64748B] bg-[#F5F5F5] dark:bg-[#2A2A2A] rounded font-ui">
                            Draft
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        {/* Delete Thread Confirmation Dialog */}
        <AlertDialog open={!!threadToDelete} onOpenChange={() => setThreadToDelete(null)}>
          <AlertDialogContent className="bg-white dark:bg-[#1A1A1A] border border-[#E5E5E5] dark:border-[#333]">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-[#13343B] dark:text-[#F8F8F7]">
                Delete this thread?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-[#64748B]">
                This action cannot be undone. This will permanently delete this thread.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-[#E5E5E5] dark:border-[#333]">
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
              <AlertDialogCancel className="border-[#E5E5E5] dark:border-[#333]">
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
    </>
  )
}
