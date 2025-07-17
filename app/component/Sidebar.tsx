"use client"
import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import { toast } from "sonner"
import {
  X,
  Trash2,
  LogOut,
  User,
  AlertTriangle,
  Pin,
  PinOff,
  Folder,
  Home,
  Search,
  MessageSquare,
  Plus,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  HelpCircle,
  Users,
  ThumbsUp,
} from "lucide-react"
import { cn } from "@/lib/utils"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import Link from "next/link"
import { db } from "@/lib/db"

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
  onSignInClick?: () => void
  refreshTrigger?: number
  pinned?: boolean
  setPinned?: (pinned: boolean) => void
}

export default function Sidebar({
  isOpen,
  onClose,
  onSignInClick,
  refreshTrigger = 0,
  pinned = false,
  setPinned,
}: SidebarProps) {
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [threadToDelete, setThreadToDelete] = useState<string | null>(null)
  const [showPinButton, setShowPinButton] = useState(false)
  const [chatsExpanded, setChatsExpanded] = useState(true)
  const [foldersExpanded, setFoldersExpanded] = useState(true)
  const [showMoreChats, setShowMoreChats] = useState(false)
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false)

  const router = useRouter()
  const pathname = usePathname()
  const { user, signOut, openAuthDialog } = useAuth()
  const isAuthenticated = !!user

  // Query for the current user's profile directly
  const {
    data: profileData,
    isLoading: profileLoading,
    error: profileError,
  } = db.useQuery(
    user
      ? {
          profiles: {
            $: { where: { userId: user.id } },
            user: {},
          },
        }
      : null,
  )

  const profile = profileData?.profiles?.[0]

  // Only run threads query if user?.id is defined
  const { data, isLoading, error } = db.useQuery(
    user?.id
      ? {
          threads: {
            $: {
              where: { "user.id": user.id },
              order: { updatedAt: "desc" },
            },
            user: {
              profile: {},
            },
          },
        }
      : null,
  )

  const threads = data?.threads || []

  // Mock usage data - replace with actual data from your backend
  const usageData = {
    plan: "Free",
    aiWords: { used: 0, limit: 1000 },
    imports: { used: 0, limit: 5 },
    recordings: { used: 0, limit: 1 },
  }

  // Show limited number of chats initially
  const visibleChats = showMoreChats ? threads : threads.slice(0, 5)

  useEffect(() => {
    const checkScreenWidth = () => {
      setShowPinButton(window.innerWidth >= 1300)
    }
    checkScreenWidth()
    window.addEventListener("resize", checkScreenWidth)
    return () => window.removeEventListener("resize", checkScreenWidth)
  }, [])

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  // For desktop: show sidebar when hovering near left edge
  useEffect(() => {
    if (isMobile) return
    const handleMouseMove = (e: MouseEvent) => {
      if (isProfileDropdownOpen) return // Prevent closing when dropdown is open
      const windowWidth = window.innerWidth
      if (e.clientX >= windowWidth - 20) {
        setIsHovered(true)
      } else if (e.clientX < windowWidth - 280) {
        setIsHovered(false)
      }
    }

    const handleMouseLeave = () => {
      if (isProfileDropdownOpen) return // Prevent closing when dropdown is open
      setIsHovered(false)
    }

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseleave", handleMouseLeave)
    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseleave", handleMouseLeave)
    }
  }, [isMobile, isProfileDropdownOpen])

  const shouldShowSidebar = isMobile ? isOpen : isHovered

  const handleThreadClick = (threadId: string) => {
    router.push(`/chat/${threadId}`)
    if (isMobile) {
      onClose()
    }
  }

  const handleDeleteThread = async (threadId: string) => {
    try {
      await db.transact(db.tx.threads[threadId].delete())
      if (pathname === `/chat/${threadId}`) {
        router.push("/")
      }
      toast.success("Thread deleted successfully")
    } catch (error) {
      console.error("Error deleting thread:", error)
      toast.error("Failed to delete thread", {
        description: "Please check your connection and try again",
      })
    }
  }

  const handleConfirmDeleteThread = async () => {
    if (!threadToDelete) return
    await handleDeleteThread(threadToDelete)
    setThreadToDelete(null)
  }

  const handleSignOut = async () => {
    try {
      await signOut()
      router.push("/")
      if (isMobile) {
        onClose()
      }
    } catch (error) {
      console.error("Error signing out:", error)
    }
  }

  const handleClearAllHistory = () => {
    if (threads.length > 0) {
      setIsClearConfirmOpen(true)
    } else {
      toast.info("No chat history to clear.")
    }
  }

  const handleConfirmClearAll = async () => {
    setIsClearConfirmOpen(false)
    const toastId = toast.loading("Clearing all chat history...")
    try {
      const txs = threads.map((t) => db.tx.threads[t.id].delete())
      await db.transact(txs)
      toast.success("Chat history cleared successfully", { id: toastId })
      if (pathname && pathname.startsWith("/chat/")) {
        router.push("/")
      }
      if (isMobile) {
        onClose()
      }
    } catch (error) {
      console.error("Error clearing all threads:", error)
      toast.error("Failed to clear history", {
        id: toastId,
        description: "An unexpected error occurred. Please check your connection and try again.",
      })
    }
  }

  const renderThread = (thread: any) => (
    <div
      key={thread.id}
      className={cn(
        "group flex items-center gap-2 w-full text-left p-2 rounded-md transition-all duration-200 cursor-pointer",
        pathname === `/chat/${thread.id}`
          ? "bg-[var(--brand-fainter)] text-[var(--brand-default)]"
          : "text-[var(--text-light-default)] hover:bg-[var(--secondary-darker)]",
      )}
      onClick={() => handleThreadClick(thread.id)}
    >
       <span className="truncate text-sm">{thread.title}</span>
      <button
        onClick={(e) => {
          e.stopPropagation()
          setThreadToDelete(thread.id)
        }}
        className={cn(
          "ml-auto p-1 text-[var(--text-light-muted)] hover:text-[var(--accent-red)] rounded transition-colors",
          isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        )}
        title="Delete thread"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  )

  return (
    <>
      {/* Overlay - only visible on mobile when sidebar is open */}
      {isMobile && (
        <div
          className={cn(
            "fixed inset-0 bg-black/40 dark:bg-black/60 z-40 transition-opacity",
            isOpen ? "opacity-100" : "opacity-0 pointer-events-none",
          )}
          onClick={onClose}
        />
      )}

      {/* Hover trigger area for desktop */}
      {!isMobile && !pinned && (
        <div
          className="fixed right-0 top-0 w-5 h-full z-30 pointer-events-auto"
          onMouseEnter={() => setIsHovered(true)}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-64 bg-[var(--secondary-default)] border-l border-[var(--secondary-darkest)] shadow-lg transform transition-transform duration-300 ease-in-out flex flex-col",
          shouldShowSidebar || pinned ? "translate-x-0" : "translate-x-full",
        )}
        onMouseEnter={() => !isMobile && setIsHovered(true)}
        onMouseLeave={() => !isMobile && !isProfileDropdownOpen && setIsHovered(false)}
      >
        {isAuthenticated && user ? (
          <>
            {/* Profile Header */}
            <div className="p-3 border-b border-[var(--secondary-darkest)]">
              <div className="flex items-center justify-between">
                <DropdownMenu open={isProfileDropdownOpen} onOpenChange={setIsProfileDropdownOpen}>
                  <DropdownMenuTrigger className="flex items-center gap-2 text-left hover:bg-[var(--secondary-darker)] rounded-md p-2 transition-colors">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[var(--brand-fainter)] text-[var(--brand-default)]">
                      <User className="h-3.5 w-3.5" />
                    </div>
                    <span className="font-medium text-[var(--text-light-default)] text-sm">
                      {profileLoading ? (
                        <Skeleton className="h-4 w-16" />
                      ) : (
                        profile?.firstName || user.email?.split("@")[0] || "User"
                      )}
                    </span>
                    <ChevronDown className="h-3 w-3 text-[var(--text-light-muted)]" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    className="w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg"
                  >
                    <DropdownMenuItem asChild>
                      <Link href="/settings" className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Account Settings
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut} className="text-red-600">
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <div className="flex items-center gap-1">
                  {showPinButton && setPinned && (
                    <button
                      onClick={() => setPinned(!pinned)}
                      className="p-1.5 rounded-full hover:bg-[var(--secondary-darker)] text-[var(--text-light-muted)] hover:text-[var(--text-light-default)] transition-colors"
                      aria-label={pinned ? "Unpin sidebar" : "Pin sidebar"}
                    >
                      {pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                    </button>
                  )}
                  {isMobile && (
                    <button
                      onClick={onClose}
                      className="p-1.5 rounded-full hover:bg-[var(--secondary-darker)] text-[var(--text-light-muted)] hover:text-[var(--text-light-default)] transition-colors"
                      aria-label="Close sidebar"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto p-3 space-y-4 no-scrollbar">
              {/* Folders Section */}
              {/* <div>
                <button
                  onClick={() => setFoldersExpanded(!foldersExpanded)}
                  className="flex items-center gap-2 w-full text-left text-sm font-medium text-[var(--text-light-default)] hover:bg-[var(--secondary-darker)] rounded-md p-2 transition-colors"
                >
                  {foldersExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  Folders
                </button>

                {foldersExpanded && (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-light-default)] hover:bg-[var(--secondary-darker)] rounded-md transition-colors cursor-pointer">
                      <Folder className="h-4 w-4" />
                      <span className="truncate">Age reversal research</span>
                    </div>
                    <div className="text-center py-2 px-3">
                      <p className="text-xs text-[var(--text-light-muted)]">Create folders to organize chats</p>
                    </div>
                  </div>
                )}
              </div> */}
              {/* Chats Section */}
              <div>
                <button
                  onClick={() => setChatsExpanded(!chatsExpanded)}
                  className="flex items-center gap-2 w-full text-left text-sm font-medium text-[var(--text-light-default)] hover:bg-[var(--secondary-darker)] rounded-md p-2 transition-colors"
                >
                  {chatsExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  Chats
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      router.push("/")
                    }}
                    className="ml-auto p-1 hover:bg-[var(--secondary-darkest)] rounded transition-colors"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </button>

                {chatsExpanded && (
                  <div className="mt-2 space-y-1">
                    {!isLoading ? (
                      threads.length === 0 ? (
                        <div className="text-center py-4 px-3">
                          <p className="text-xs text-[var(--text-light-muted)]">No chats yet</p>
                        </div>
                      ) : (
                        <>
                          {visibleChats.map(renderThread)}
                          {threads.length > 5 && (
                            <button
                              onClick={() => setShowMoreChats(!showMoreChats)}
                              className="flex items-center gap-2 w-full text-left p-2 text-sm text-[var(--text-light-muted)] hover:bg-[var(--secondary-darker)] rounded-md transition-colors"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                              {showMoreChats ? "Show less" : `${threads.length - 5} more`}
                            </button>
                          )}
                        </>
                      )
                    ) : (
                      <div className="space-y-1">
                        {[...Array(3)].map((_, i) => (
                          <div key={i} className="flex items-center gap-2 p-2">
                            <Skeleton className="h-4 w-4" />
                            <Skeleton className="h-4 flex-1" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              

              {threads.length > 0 && (
                <div className="pt-2 border-t border-dashed border-[var(--secondary-darker)]">
                  <button
                    onClick={handleClearAllHistory}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-[var(--accent-red)] hover:bg-[var(--accent-maroon-light)] rounded-md transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                    Clear All History
                  </button>
                </div>
              )}
            </div>

            {/* Usage Tracker & Footer */}
            {isAuthenticated && (
              <div className="p-3 border-t border-[var(--secondary-darkest)] space-y-3">
                {/* Plan Usage */}
                {/* <div className="bg-[var(--secondary-fainter)] rounded-lg p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[var(--text-light-default)]">Plan usage</span>
                    <span className="text-xs px-2 py-1 bg-[var(--brand-fainter)] text-[var(--brand-default)] rounded">
                      {usageData.plan}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[var(--text-light-default)]">AI words/day</span>
                        <span className="text-[var(--text-light-muted)]">
                          {usageData.aiWords.used}/{usageData.aiWords.limit}
                        </span>
                      </div>
                      <Progress value={(usageData.aiWords.used / usageData.aiWords.limit) * 100} className="h-1 mt-1" />
                    </div>

                    
                  </div>

                  <button className="w-full bg-white dark:bg-[var(--secondary-darkest)] text-black text-sm font-medium py-2 rounded-md hover:bg-gray-100 transition-colors">
                    Get unlimited
                  </button>
                </div> */}

                {/* Footer Links */}
                <div className="space-y-1">
                 
                  <a
                    href="https://github.com/Vinitj088/Aylechat/issues/new"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 w-full text-left px-2 py-1.5 text-sm text-[var(--text-light-default)] hover:bg-[var(--secondary-darker)] rounded transition-colors"
                  >
                    <HelpCircle className="h-4 w-4" />
                    Support
                  </a>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <button
              onClick={onSignInClick || openAuthDialog}
              className="flex items-center gap-2 text-sm font-medium text-[var(--brand-default)] hover:bg-[var(--secondary-darker)] rounded-md p-3 transition-colors"
            >
              <User className="h-4 w-4" />
              Sign In
            </button>
          </div>
        )}
      </div>

      {/* Alert Dialogs */}
      <AlertDialog open={isClearConfirmOpen} onOpenChange={setIsClearConfirmOpen}>
        <AlertDialogContent className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Are you absolutely sure?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete all your chat threads and remove your data from
              our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmClearAll} className="bg-red-600 hover:bg-red-700 text-white">
              Yes, delete all history
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!threadToDelete}
        onOpenChange={(open) => {
          if (!open) setThreadToDelete(null)
        }}
      >
        <AlertDialogContent className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Delete this chat thread?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this chat thread and remove its data from our
              servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDeleteThread} className="bg-red-600 hover:bg-red-700 text-white">
              Yes, delete thread
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
