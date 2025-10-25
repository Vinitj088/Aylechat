"use client"
import { useState, useEffect, useRef, useLayoutEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import { toast } from "sonner"
import {
  Trash2,
  LogOut,
  User,
  AlertTriangle,
  ChevronDown,
  MoreHorizontal,
  HelpCircle,
  Plus,
  PanelLeft,
  Moon,
  Sun,
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
import Link from "next/link"
import { db } from "@/lib/db"
import { useTheme } from "next-themes"

interface LeftSidebarProps {
  onNewChat: () => void
  isExpanded: boolean
  setIsExpanded: (expanded: boolean) => void
  isHydrating?: boolean
}

export default function LeftSidebar({
  onNewChat,
  isExpanded,
  setIsExpanded,
  isHydrating = false,
}: LeftSidebarProps) {
  const [threadToDelete, setThreadToDelete] = useState<string | null>(null)
  const [showMoreChats, setShowMoreChats] = useState(() => {
    // Initialize from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebarShowMoreChats')
      return saved ? JSON.parse(saved) : false
    }
    return false
  })
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false)
  const { theme, setTheme } = useTheme()
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const router = useRouter()
  const pathname = usePathname()
  const { user, signOut, openAuthDialog } = useAuth()
  const isAuthenticated = !!user

  // Persist showMoreChats state
  useEffect(() => {
    localStorage.setItem('sidebarShowMoreChats', JSON.stringify(showMoreChats))
  }, [showMoreChats])

  // Query for the current user's profile directly
  const {
    data: profileData,
    isLoading: profileLoading,
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
  const { data, isLoading } = db.useQuery(
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

  // Show limited number of chats initially
  const visibleChats = showMoreChats ? threads : threads.slice(0, 5)

  // Save scroll position when scrolling
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const handleScroll = () => {
      const scrollPos = container.scrollTop
      localStorage.setItem('sidebarScrollPosition', scrollPos.toString())
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [isExpanded])

  // Restore scroll position after DOM updates
  useEffect(() => {
    if (isHydrating || isLoading) return

    const savedScrollPosition = localStorage.getItem('sidebarScrollPosition')
    if (savedScrollPosition && scrollContainerRef.current) {
      const scrollPos = parseInt(savedScrollPosition, 10)

      // Use multiple frames to ensure DOM is fully settled
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = scrollPos
          }
        })
      })
    }
  }, [isHydrating, isLoading, pathname])

  const handleThreadClick = (threadId: string) => {
    router.push(`/chat/${threadId}`)
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
      toast.error("Failed to delete thread")
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
    } catch (error) {
      console.error("Error signing out:", error)
    }
  }

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark")
  }

  const renderThread = (thread: any) => (
    <div
      key={thread.id}
      className={cn(
        "group flex items-center gap-2 w-full text-left p-2 rounded-md  cursor-pointer min-w-0",
        pathname === `/chat/${thread.id}`
          ? "bg-[var(--brand-fainter)] text-[var(--brand-default)]"
          : "text-[var(--text-light-default)] hover:bg-[var(--secondary-darker)]",
      )}
      onClick={() => handleThreadClick(thread.id)}
    >
      <span className="truncate text-sm min-w-0 flex-1">{thread.title}</span>
      <button
        onClick={(e) => {
          e.stopPropagation()
          setThreadToDelete(thread.id)
        }}
        className="p-1 text-[var(--text-light-muted)] hover:text-[var(--accent-red)] rounded  opacity-0 group-hover:opacity-100 flex-shrink-0"
        title="Delete thread"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  )

  return (
    <>
      {/* Sidebar Container */}
      <aside
        suppressHydrationWarning
        className={cn(
          "bg-[var(--sidebar-bg)] border-r border-[var(--sidebar-border)] shadow-lg flex flex-col h-screen ease-in-out fixed top-0 overflow-hidden",
          // Mobile: slide from right, Desktop: fixed on left
          isExpanded
            ? "w-64 right-0 translate-x-0 z-50 md:left-0"
            : "w-64 right-0 translate-x-full md:left-0 md:w-14 md:translate-x-0 md:z-50"
        )}
      >
        {/* Header with Toggle and Logo */}
        <div className="border-b border-[var(--sidebar-border)] flex flex-col items-start p-2 gap-2" suppressHydrationWarning>
          {/* Row 1: Toggle and Ayle Logo */}
          <div className="flex items-center gap-2 w-full min-w-0">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 rounded-md hover:bg-[var(--secondary-darker)] text-[var(--text-light-default)] flex-shrink-0"
              aria-label="Toggle sidebar"
              title="Toggle sidebar"
            >
              <PanelLeft className="h-5 w-6" />
            </button>

            {/* Ayle Logo - only when expanded */}
            {isExpanded && !isHydrating && (
              <Link href="/" className="flex items-center flex-1 min-w-0">
                <span
                  className="text-2xl text-[var(--brand-default)] whitespace-nowrap"
                  style={{
                    fontFamily: 'var(--font-gebuk-regular)',
                    letterSpacing: '0.05em',
                    fontWeight: 'normal',
                  }}
                >
                  Ayle
                </span>
              </Link>
            )}
            {isExpanded && isHydrating && (
              <Skeleton className="h-8 flex-1" />
            )}
          </div>

        </div>

        {isHydrating ? (
          <>
            {/* Skeleton Content During Hydration */}
            <div className="flex-1 overflow-y-auto no-scrollbar p-2">
              {/* New Chat Button Skeleton */}
              <Skeleton className={cn("mb-2", isExpanded ? "h-12 w-full" : "h-10 w-10")} />

              {/* Chat History Skeleton - Only when expanded */}
              {isExpanded && (
                <div className="space-y-1">
                  <Skeleton className="h-4 w-16 mb-2" />
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              )}
            </div>

            {/* Footer Skeleton */}
            <div className="border-t border-[var(--sidebar-border)] p-2 space-y-1">
              <Skeleton className={cn(isExpanded ? "h-12 w-full" : "h-10 w-10")} />
              <Skeleton className={cn(isExpanded ? "h-12 w-full" : "h-10 w-10")} />
            </div>
          </>
        ) : isAuthenticated && user ? (
          <>
            {/* Main Content Area */}
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto no-scrollbar p-2" suppressHydrationWarning>
              {/* New Chat Button - Always visible */}
              <button
                onClick={onNewChat}
                className={cn(
                  "flex items-center w-full mb-2 rounded-md hover:bg-[var(--secondary-darkest)] min-w-0 justify-start",
                  isExpanded
                    ? "gap-2 text-left p-1.5 text-sm font-medium text-[var(--text-light-default)]"
                    : "p-1.5 text-[var(--text-light-default)]"
                )}
              >
                <Plus className="h-6 w-6 flex-shrink-0 bg-[var(--brand-dark)] text-white rounded-full p-1" />
                {isExpanded && <span className="whitespace-nowrap overflow-hidden">New chat</span>}
              </button>

              {/* Chats Section - Only when expanded */}
              {isExpanded && (
                <div className="space-y-1">
                  <div className="px-2 py-1 text-xs font-semibold text-[var(--text-light-muted)] uppercase tracking-wider">
                    Chats
                  </div>
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
                            className="flex items-center gap-2 w-full text-left p-2 text-sm text-[var(--text-light-muted)] hover:bg-[var(--secondary-darker)] rounded-md"
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
                        <Skeleton key={i} className="h-10 w-full" />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-[var(--sidebar-border)] p-2 space-y-1" suppressHydrationWarning>
              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="flex items-center gap-2 w-full text-left px-2 py-2 hover:bg-[var(--secondary-darker)] rounded-md min-w-0"
                title={theme === "dark" ? "Light mode" : "Dark mode"}
              >
                {theme === "dark" ? (
                  <Sun className="h-5 w-5 flex-shrink-0 text-[var(--text-light-default)]" />
                ) : (
                  <Moon className="h-5 w-5 flex-shrink-0 text-[var(--text-light-default)]" />
                )}
                {isExpanded && (
                  <span className="text-sm text-[var(--text-light-default)] whitespace-nowrap overflow-hidden">
                    {theme === "dark" ? "Light mode" : "Dark mode"}
                  </span>
                )}
              </button>

              {/* Profile Dropdown */}
              <DropdownMenu open={isProfileDropdownOpen} onOpenChange={setIsProfileDropdownOpen}>
                <DropdownMenuTrigger className="flex items-center gap-2 w-full text-left p-2 hover:bg-[var(--secondary-darker)] rounded-md min-w-0">
                  <div className="flex items-center justify-center rounded-full bg-[var(--brand-fainter)] text-[var(--brand-default)] flex-shrink-0 w-6 h-6">
                    <User className="h-4 w-4" />
                  </div>
                  {isExpanded && (
                    <>
                      <span className="font-medium text-[var(--text-light-default)] text-sm flex-1 truncate min-w-0">
                        {profileLoading ? (
                          <Skeleton className="h-4 w-16" />
                        ) : (
                          profile?.firstName || user.email?.split("@")[0] || "User"
                        )}
                      </span>
                      <ChevronDown className="h-4 w-4 text-[var(--text-light-muted)] flex-shrink-0" />
                    </>
                  )}
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
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center p-4">
            <button
              onClick={openAuthDialog}
              className="flex items-center gap-2 p-3 text-sm font-medium text-[var(--brand-default)] hover:bg-[var(--secondary-darker)] rounded-md  min-w-0"
            >
              <User className="h-5 w-5 flex-shrink-0" />
              {isExpanded && <span className="whitespace-nowrap overflow-hidden">Sign In</span>}
            </button>
          </div>
        )}
      </aside>

      {/* Alert Dialog for Delete Thread */}
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
