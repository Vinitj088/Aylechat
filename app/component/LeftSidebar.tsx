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
  Home,
  Compass,
  Sparkles,
  Library,
  Command,
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
        "group flex items-center gap-1 w-full text-left py-1.5 cursor-pointer min-w-0",
        pathname === `/chat/${thread.id}`
          ? "text-[#13343B] dark:text-[#F8F8F7]"
          : "text-[#64748B] hover:text-[#13343B] dark:hover:text-[#F8F8F7]",
      )}
      onClick={() => handleThreadClick(thread.id)}
    >
      <span className="truncate text-sm min-w-0 flex-1">{thread.title}</span>
      <button
        onClick={(e) => {
          e.stopPropagation()
          setThreadToDelete(thread.id)
        }}
        className="p-0.5 text-[#64748B] hover:text-red-500 rounded opacity-0 group-hover:opacity-100 flex-shrink-0"
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
          "bg-white dark:bg-[#0F1516] border-r border-[#E5E5E5] dark:border-[#2A3638] flex flex-col h-screen transition-[width,transform] duration-300 ease-in-out fixed top-0 left-0 overflow-hidden",
          // Mobile: slide from left, Desktop: fixed on left
          isExpanded
            ? "w-64 translate-x-0 z-50"
            : "w-64 -translate-x-full md:w-14 md:translate-x-0 md:z-50"
        )}
      >
        {/* Header with Toggle and Logo */}
        <div className={cn(
          "flex flex-col items-center p-2 gap-2",
          isExpanded && "border-b border-[#E5E5E5] dark:border-[#2A3638]"
        )} suppressHydrationWarning>
          {/* Row 1: Toggle/Logo when expanded, Logo icon when collapsed */}
          <div className="flex items-center gap-2 w-full min-w-0">
            {isExpanded ? (
              <>
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="p-1.5 rounded-md hover:bg-[#F5F5F5] dark:hover:bg-[#1A2426] text-[#13343B] dark:text-[#F8F8F7] flex-shrink-0"
                  aria-label="Toggle sidebar"
                  title="Toggle sidebar"
                >
                  <PanelLeft className="h-5 w-5" />
                </button>
                {!isHydrating && (
                  <Link href="/" className="flex items-center flex-1 min-w-0">
                    <span
                      className="text-2xl text-[#13343B] dark:text-[#F8F8F7] whitespace-nowrap"
                      style={{
                        fontFamily: 'Gebuk, system-ui, sans-serif',
                        letterSpacing: '0.02em',
                      }}
                    >
                      Ayle
                    </span>
                  </Link>
                )}
                {isHydrating && <Skeleton className="h-8 flex-1" />}
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 w-full">
                <button
                  onClick={() => setIsExpanded(true)}
                  className="p-1.5 rounded-md hover:bg-[#F5F5F5] dark:hover:bg-[#1A2426] text-[#64748B] hover:text-[#13343B] dark:hover:text-[#F8F8F7]"
                  aria-label="Expand sidebar"
                  title="Expand sidebar"
                >
                  <PanelLeft className="h-5 w-5" />
                </button>
              </div>
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
              {/* New Thread Button */}
              <button
                onClick={onNewChat}
                className={cn(
                  "flex items-center w-full rounded-lg text-[#13343B] dark:text-[#F8F8F7] transition-all duration-300",
                  isExpanded
                    ? "gap-2 mb-4 border border-[#E5E5E5] dark:border-[#2A3638] hover:bg-[#F5F5F5] dark:hover:bg-[#1A2426] px-3 py-2 text-sm font-medium"
                    : "mb-2 px-3 py-2.5 hover:bg-[#F5F5F5] dark:hover:bg-[#1A2426]"
                )}
                title="New Thread"
              >
                <Plus className={cn("flex-shrink-0 transition-all duration-300", isExpanded ? "h-4 w-4" : "h-5 w-5")} />
                <span className={cn(
                  "whitespace-nowrap flex-1 transition-all duration-300",
                  isExpanded ? "opacity-100 max-w-[120px]" : "opacity-0 max-w-0 overflow-hidden"
                )}>New Thread</span>
                <span className={cn(
                  "text-xs text-[#64748B] flex items-center gap-0.5 transition-all duration-300",
                  isExpanded ? "opacity-100" : "opacity-0 max-w-0 overflow-hidden"
                )}>
                  <Command className="h-3 w-3" /> K
                </span>
              </button>

              {/* Navigation Items */}
              <nav className="space-y-1">
                <Link
                  href="/"
                  className={cn(
                    "relative flex items-center w-full rounded-lg hover:bg-[#F5F5F5] dark:hover:bg-[#1A2426] min-w-0 transition-all duration-300 gap-3 px-3 py-2.5 text-sm font-medium",
                    pathname === "/"
                      ? "text-[#13343B] dark:text-[#F8F8F7]"
                      : "text-[#64748B]"
                  )}
                >
                  {pathname === "/" && !isExpanded && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[#13343B] dark:bg-[#F8F8F7] rounded-full" />
                  )}
                  <Home className="h-5 w-5 flex-shrink-0" />
                  <span className={cn(
                    "whitespace-nowrap transition-all duration-300",
                    isExpanded ? "opacity-100 max-w-[150px]" : "opacity-0 max-w-0 overflow-hidden"
                  )}>Home</span>
                </Link>

                <button
                  className={cn(
                    "relative flex items-center w-full rounded-lg hover:bg-[#F5F5F5] dark:hover:bg-[#1A2426] min-w-0 text-[#64748B] transition-all duration-300 gap-3 px-3 py-2.5 text-sm font-medium"
                  )}
                >
                  <Compass className="h-5 w-5 flex-shrink-0" />
                  <span className={cn(
                    "whitespace-nowrap transition-all duration-300",
                    isExpanded ? "opacity-100 max-w-[150px]" : "opacity-0 max-w-0 overflow-hidden"
                  )}>Discover</span>
                </button>

                {/* Spaces Section */}
                <div>
                  <button
                    className={cn(
                      "relative flex items-center w-full rounded-lg hover:bg-[#F5F5F5] dark:hover:bg-[#1A2426] min-w-0 text-[#13343B] dark:text-[#F8F8F7] transition-all duration-300 gap-3 px-3 py-2.5 text-sm font-medium"
                    )}
                  >
                    <Sparkles className="h-5 w-5 flex-shrink-0" />
                    <span className={cn(
                      "whitespace-nowrap transition-all duration-300",
                      isExpanded ? "opacity-100 max-w-[150px]" : "opacity-0 max-w-0 overflow-hidden"
                    )}>Spaces</span>
                  </button>
                  {/* Spaces sub-items placeholder - only when expanded */}
                  <div className={cn(
                    "ml-5 mt-0.5 space-y-0.5 border-l border-[#E5E5E5] dark:border-[#2A3638] pl-3 transition-all duration-300 overflow-hidden",
                    isExpanded ? "max-h-20 opacity-100" : "max-h-0 opacity-0"
                  )}>
                    <button className="text-sm text-[#64748B] hover:text-[#13343B] dark:hover:text-[#F8F8F7] py-1 text-left w-full truncate">
                      Create a Space
                    </button>
                  </div>
                </div>

                {/* Library Section with threads */}
                <div>
                  <Link
                    href="/library"
                    className={cn(
                      "relative flex items-center w-full rounded-lg hover:bg-[#F5F5F5] dark:hover:bg-[#1A2426] min-w-0 transition-all duration-300 gap-3 px-3 py-2.5 text-sm font-medium",
                      pathname === "/library" || pathname.startsWith("/library")
                        ? "text-[#13343B] dark:text-[#F8F8F7]"
                        : "text-[#64748B]"
                    )}
                  >
                    {(pathname === "/library" || pathname.startsWith("/library")) && !isExpanded && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[#13343B] dark:bg-[#F8F8F7] rounded-full" />
                    )}
                    <Library className="h-5 w-5 flex-shrink-0" />
                    <span className={cn(
                      "whitespace-nowrap transition-all duration-300",
                      isExpanded ? "opacity-100 max-w-[150px]" : "opacity-0 max-w-0 overflow-hidden"
                    )}>Library</span>
                  </Link>

                  {/* Thread list under Library - only when expanded */}
                  <div className={cn(
                    "ml-5 mt-0.5 space-y-0.5 border-l border-[#E5E5E5] dark:border-[#2A3638] pl-3 transition-all duration-300 overflow-hidden",
                    isExpanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
                  )}>
                      {!isLoading ? (
                        threads.length === 0 ? (
                          <p className="text-sm text-[#64748B] py-1">No threads yet</p>
                        ) : (
                          <>
                            {visibleChats.map(renderThread)}
                            {threads.length > 5 && (
                              <button
                                onClick={() => setShowMoreChats(!showMoreChats)}
                                className="w-full text-left py-1 text-sm text-[#64748B] hover:text-[#13343B] dark:hover:text-[#F8F8F7]"
                              >
                                {showMoreChats ? "Show less" : `${threads.length - 5} more`}
                              </button>
                            )}
                          </>
                        )
                      ) : (
                        <div className="space-y-1 py-1">
                          {[...Array(3)].map((_, i) => (
                            <Skeleton key={i} className="h-5 w-full" />
                          ))}
                        </div>
                      )}
                  </div>
                </div>
              </nav>
            </div>

            {/* Footer */}
            <div className="p-2 space-y-1" suppressHydrationWarning>
              {/* Profile Section */}
              <div className={cn(
                "flex items-center w-full rounded-lg min-w-0 transition-all duration-300",
                isExpanded ? "gap-2 p-2 hover:bg-[#F5F5F5] dark:hover:bg-[#1A2426]" : "p-2"
              )}>
                <DropdownMenu open={isProfileDropdownOpen} onOpenChange={setIsProfileDropdownOpen}>
                  <DropdownMenuTrigger className={cn(
                    "flex items-center gap-2 min-w-0 transition-all duration-300",
                    isExpanded ? "flex-1" : ""
                  )}>
                    <div className="flex items-center justify-center rounded-full bg-[#20B8CD] text-white w-7 h-7 text-xs font-medium flex-shrink-0">
                      {profileLoading ? "..." : (profile?.firstName?.[0] || user.email?.[0] || "U").toUpperCase()}
                    </div>
                    <span className={cn(
                      "font-medium text-[#13343B] dark:text-[#F8F8F7] text-sm truncate min-w-0 text-left transition-all duration-300",
                      isExpanded ? "flex-1 opacity-100 max-w-[150px]" : "opacity-0 max-w-0 overflow-hidden"
                    )}>
                      {profileLoading ? (
                        <Skeleton className="h-4 w-16" />
                      ) : (
                        profile?.firstName || user.email?.split("@")[0] || "User"
                      )}
                    </span>
                    <ChevronDown className={cn(
                      "h-4 w-4 text-[#64748B] flex-shrink-0 transition-all duration-300",
                      isExpanded ? "opacity-100" : "opacity-0 w-0 overflow-hidden"
                    )} />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    className="w-48 bg-white dark:bg-[#1A1A1A] border border-[#E5E5E5] dark:border-[#333] shadow-lg rounded-xl"
                  >
                    <DropdownMenuItem asChild>
                      <Link href="/settings" className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Account Settings
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={toggleTheme} className="flex items-center gap-2">
                      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                      {theme === "dark" ? "Light mode" : "Dark mode"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut} className="text-red-600">
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                {isExpanded && (
                  <button
                    onClick={() => router.push('/settings')}
                    className="p-1.5 rounded-lg hover:bg-[#E5E5E5] dark:hover:bg-[#2A3638] text-[#64748B] flex-shrink-0"
                    title="Settings"
                  >
                    <HelpCircle className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Non-authenticated sidebar content */}
            <div className="flex-1 overflow-y-auto no-scrollbar p-2">
              {/* New Thread Button */}
              {isExpanded ? (
                <button
                  onClick={onNewChat}
                  className="flex items-center gap-2 w-full mb-4 rounded-lg border border-[#E5E5E5] dark:border-[#2A3638] hover:bg-[#F5F5F5] dark:hover:bg-[#1A2426] px-3 py-2 text-sm font-medium text-[#13343B] dark:text-[#F8F8F7]"
                >
                  <Plus className="h-4 w-4 flex-shrink-0" />
                  <span className="whitespace-nowrap overflow-hidden flex-1">New Thread</span>
                  <span className="text-xs text-[#64748B] flex items-center gap-0.5">
                    <Command className="h-3 w-3" /> K
                  </span>
                </button>
              ) : (
                <button
                  onClick={onNewChat}
                  className="flex items-center justify-center w-full mb-2 p-2.5 rounded-lg hover:bg-[#F5F5F5] dark:hover:bg-[#1A2426] text-[#13343B] dark:text-[#F8F8F7]"
                  title="New Thread"
                >
                  <Plus className="h-5 w-5" />
                </button>
              )}

              {/* Navigation Items */}
              <nav className="space-y-1">
                <Link
                  href="/"
                  className={cn(
                    "relative flex items-center w-full rounded-lg hover:bg-[#F5F5F5] dark:hover:bg-[#1A2426] min-w-0 transition-colors",
                    isExpanded
                      ? "gap-3 text-left px-3 py-2.5 text-sm font-medium"
                      : "p-2.5 justify-center",
                    pathname === "/"
                      ? "text-[#13343B] dark:text-[#F8F8F7]"
                      : "text-[#64748B]"
                  )}
                >
                  {/* Active indicator bar */}
                  {pathname === "/" && !isExpanded && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[#13343B] dark:bg-[#F8F8F7] rounded-full" />
                  )}
                  <Home className="h-5 w-5 flex-shrink-0" />
                  {isExpanded && <span className="whitespace-nowrap overflow-hidden">Home</span>}
                </Link>

                <button
                  onClick={openAuthDialog}
                  className={cn(
                    "relative flex items-center w-full rounded-lg hover:bg-[#F5F5F5] dark:hover:bg-[#1A2426] min-w-0 text-[#64748B] transition-colors",
                    isExpanded
                      ? "gap-3 text-left px-3 py-2.5 text-sm font-medium"
                      : "p-2.5 justify-center"
                  )}
                >
                  <Compass className="h-5 w-5 flex-shrink-0" />
                  {isExpanded && <span className="whitespace-nowrap overflow-hidden">Discover</span>}
                </button>

                <button
                  onClick={openAuthDialog}
                  className={cn(
                    "relative flex items-center w-full rounded-lg hover:bg-[#F5F5F5] dark:hover:bg-[#1A2426] min-w-0 text-[#64748B] transition-colors",
                    isExpanded
                      ? "gap-3 text-left px-3 py-2.5 text-sm font-medium"
                      : "p-2.5 justify-center"
                  )}
                >
                  <Sparkles className="h-5 w-5 flex-shrink-0" />
                  {isExpanded && <span className="whitespace-nowrap overflow-hidden">Spaces</span>}
                </button>

                <Link
                  href="/library"
                  className={cn(
                    "relative flex items-center w-full rounded-lg hover:bg-[#F5F5F5] dark:hover:bg-[#1A2426] min-w-0 transition-colors",
                    isExpanded
                      ? "gap-3 text-left px-3 py-2.5 text-sm font-medium"
                      : "p-2.5 justify-center",
                    pathname === "/library"
                      ? "text-[#13343B] dark:text-[#F8F8F7]"
                      : "text-[#64748B]"
                  )}
                >
                  {pathname === "/library" && !isExpanded && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[#13343B] dark:bg-[#F8F8F7] rounded-full" />
                  )}
                  <Library className="h-5 w-5 flex-shrink-0" />
                  {isExpanded && <span className="whitespace-nowrap overflow-hidden">Library</span>}
                </Link>
              </nav>
            </div>

            {/* Footer with Dark Mode, Sign Up, and Log In */}
            <div className={cn(
              "p-2 space-y-1",
              isExpanded && "border-t border-[#E5E5E5] dark:border-[#2A3638] p-3 space-y-2"
            )}>
              {isExpanded ? (
                <>
                  {/* Try Pro Section - like Perplexity */}
                  <div className="mb-4 px-1">
                    <p className="text-sm font-medium text-[#13343B] dark:text-[#F8F8F7] mb-1">Try Pro</p>
                    <p className="text-xs text-[#64748B] mb-3">
                      Upgrade to more powerful AI models, increased limits and more advanced answers.
                    </p>
                    <button
                      onClick={openAuthDialog}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-[#20B8CD] hover:bg-[#1AA3B6] rounded-lg transition-colors"
                    >
                      <span>Learn More</span>
                    </button>
                  </div>

                  {/* Sign Up and Log In buttons */}
                  <button
                    onClick={openAuthDialog}
                    className="w-full px-4 py-2.5 text-sm font-medium text-white bg-[#13343B] hover:bg-[#0d2529] rounded-lg transition-colors"
                  >
                    Sign Up
                  </button>
                  <button
                    onClick={openAuthDialog}
                    className="w-full px-4 py-2.5 text-sm font-medium text-[#13343B] dark:text-[#F8F8F7] border border-[#E5E5E5] dark:border-[#2A3638] hover:bg-[#F5F5F5] dark:hover:bg-[#1A2426] rounded-lg transition-colors bg-transparent"
                  >
                    Log in
                  </button>
                </>
              ) : (
                <>
                  {/* Collapsed: Show expand arrow and user icon at bottom */}
                  <button
                    onClick={() => setIsExpanded(true)}
                    className="flex items-center justify-center w-full p-2.5 rounded-lg hover:bg-[#F5F5F5] dark:hover:bg-[#1A2426] text-[#64748B] transition-colors"
                    title="Expand sidebar"
                  >
                    <PanelLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={openAuthDialog}
                    className="flex items-center justify-center w-full p-2.5 rounded-lg hover:bg-[#F5F5F5] dark:hover:bg-[#1A2426] text-[#64748B] transition-colors"
                    title="Sign In"
                  >
                    <User className="h-5 w-5" />
                  </button>
                </>
              )}
            </div>
          </>
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
