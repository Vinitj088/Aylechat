"use client"
import { useState, useEffect, useRef, memo, useCallback, useMemo } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import { toast } from "sonner"
import {
  Trash2,
  LogOut,
  User,
  AlertTriangle,
  ChevronDown,
  Plus,
  PanelLeft,
  Moon,
  Sun,
  Home,
  Library,
  Command,
  ChevronRight,
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

// Fixed width for icons area to ensure alignment
const ICON_WIDTH = "w-5"
const ICON_CONTAINER = "w-10 h-10 flex items-center justify-center flex-shrink-0"

// Memoized NavItem component
const NavItem = memo(function NavItem({
  href,
  icon: Icon,
  label,
  isActive,
  isExpanded,
  onClick,
  onNavigate
}: {
  href?: string
  icon: any
  label: string
  isActive?: boolean
  isExpanded: boolean
  onClick?: () => void
  onNavigate?: () => void
}) {
  const handleClick = () => {
    if (onClick) onClick()
    // Close sidebar on mobile after navigation
    if (onNavigate && typeof window !== 'undefined' && window.innerWidth < 768) {
      onNavigate()
    }
  }

  const content = (
    <>
      {isActive && !isExpanded && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[#13343B] dark:bg-[#2fa9b5] rounded-full" />
      )}
      <div className={ICON_CONTAINER}>
        <Icon className={cn(ICON_WIDTH, "h-5")} />
      </div>
      <span className={cn(
        "whitespace-nowrap text-sm font-medium transition-[opacity,width] duration-200",
        isExpanded ? "opacity-100 w-auto" : "opacity-0 w-0 overflow-hidden"
      )}>
        {label}
      </span>
    </>
  )

  const className = cn(
    "relative flex items-center w-full rounded-lg hover:bg-[#F5F5F5] dark:hover:bg-[#2a2a2a] transition-colors duration-150 touch-manipulation",
    isActive
      ? "text-[#13343B] dark:text-[#2fa9b5]"
      : "text-[#64748B] dark:text-[#9a9a95] hover:text-[#13343B] dark:hover:text-[#e7e7e2]"
  )

  if (href) {
    return (
      <Link href={href} className={className} prefetch={false} onClick={handleClick}>
        {content}
      </Link>
    )
  }

  return (
    <button onClick={handleClick} className={className}>
      {content}
    </button>
  )
})

// Memoized thread item component
const ThreadItem = memo(function ThreadItem({
  thread,
  isActive,
  onDelete,
  onClick
}: {
  thread: { id: string; title: string }
  isActive: boolean
  onDelete: (id: string) => void
  onClick: (id: string) => void
}) {
  return (
    <div
      className={cn(
        "group flex items-center gap-1 w-full text-left py-1.5 cursor-pointer min-w-0",
        isActive
          ? "text-[#13343B] dark:text-[#e7e7e2]"
          : "text-[#64748B] dark:text-[#9a9a95] hover:text-[#13343B] dark:hover:text-[#e7e7e2]",
      )}
      onClick={() => onClick(thread.id)}
    >
      <span className="truncate text-sm min-w-0 flex-1">{thread.title}</span>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onDelete(thread.id)
        }}
        className="p-0.5 text-[#64748B] dark:text-[#9a9a95] hover:text-red-500 rounded opacity-0 group-hover:opacity-100 flex-shrink-0"
        title="Delete thread"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  )
})

// Memoized threads list component
const ThreadsList = memo(function ThreadsList({
  threads,
  visibleChats,
  showMoreChats,
  setShowMoreChats,
  currentPath,
  onDelete,
  onClick,
  isLoading
}: {
  threads: any[]
  visibleChats: any[]
  showMoreChats: boolean
  setShowMoreChats: (show: boolean) => void
  currentPath: string
  onDelete: (id: string) => void
  onClick: (id: string) => void
  isLoading: boolean
}) {
  if (isLoading) {
    return (
      <div className="space-y-1 py-1">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-5 w-full" />
        ))}
      </div>
    )
  }

  if (threads.length === 0) {
    return <p className="text-sm text-[#64748B] py-1.5">No threads yet</p>
  }

  return (
    <>
      {visibleChats.map((thread: any) => (
        <ThreadItem
          key={thread.id}
          thread={thread}
          isActive={currentPath === `/chat/${thread.id}`}
          onDelete={onDelete}
          onClick={onClick}
        />
      ))}
      {threads.length > 5 && (
        <button
          onClick={() => setShowMoreChats(!showMoreChats)}
          className="flex items-center gap-1 w-full py-1.5 text-sm text-[#20B8CD] hover:text-[#1AA3B6] transition-colors"
        >
          <span>{showMoreChats ? "Show less" : "View more"}</span>
          <ChevronRight className={cn(
            "h-3 w-3 transition-transform duration-200",
            showMoreChats && "rotate-90"
          )} />
        </button>
      )}
    </>
  )
})

function LeftSidebar({
  onNewChat,
  isExpanded,
  setIsExpanded,
  isHydrating = false,
}: LeftSidebarProps) {
  const [threadToDelete, setThreadToDelete] = useState<string | null>(null)
  const [showMoreChats, setShowMoreChats] = useState(() => {
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

  // Query for the current user's profile
  const { data: profileData, isLoading: profileLoading } = db.useQuery(
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

  // Query threads - InstantDB handles real-time updates automatically
  const { data, isLoading } = db.useQuery(
    user?.id
      ? {
          threads: {
            $: {
              where: { "user.id": user.id },
              order: { updatedAt: "desc" },
            },
          },
        }
      : null,
  )

  const threads = useMemo(() => data?.threads || [], [data?.threads])
  const visibleChats = useMemo(
    () => (showMoreChats ? threads : threads.slice(0, 5)),
    [showMoreChats, threads]
  )

  // Memoized callbacks
  const handleThreadClick = useCallback((threadId: string) => {
    router.push(`/chat/${threadId}`)
    // Close sidebar on mobile after navigation
    if (window.innerWidth < 768) {
      setIsExpanded(false)
    }
  }, [router, setIsExpanded])

  const handleDeleteThread = useCallback(async (threadId: string) => {
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
  }, [pathname, router])

  const handleConfirmDeleteThread = useCallback(async () => {
    if (!threadToDelete) return
    await handleDeleteThread(threadToDelete)
    setThreadToDelete(null)
  }, [threadToDelete, handleDeleteThread])

  const handleSignOut = useCallback(async () => {
    try {
      await signOut()
      router.push("/")
    } catch (error) {
      console.error("Error signing out:", error)
    }
  }, [signOut, router])

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark")
  }, [theme, setTheme])

  const toggleSidebar = useCallback(() => {
    setIsExpanded(!isExpanded)
  }, [isExpanded, setIsExpanded])

  // Close sidebar on mobile
  const closeSidebarOnMobile = useCallback(() => {
    setIsExpanded(false)
  }, [setIsExpanded])

  // Memoize active states to prevent unnecessary re-renders
  const isHomeActive = pathname === "/"
  const isLibraryActive = pathname === "/library" || pathname?.startsWith("/library") || false

  return (
    <>
      {/* Sidebar Container - use transform for GPU acceleration */}
      <aside
        className={cn(
          "bg-white dark:bg-[#1f2121] border-r border-[#E5E5E5] dark:border-[#2a2a2a] flex flex-col h-screen fixed top-0 left-0 z-50",
          // Desktop: width transition
          "md:will-change-[width] md:transition-[width] md:duration-200 md:ease-out",
          // Mobile: slide from left with transform
          "max-md:w-64 max-md:will-change-transform max-md:transition-transform max-md:duration-300 max-md:ease-out",
          // Desktop widths
          isExpanded ? "md:w-64" : "md:w-14",
          // Mobile: slide in/out
          isExpanded ? "max-md:translate-x-0" : "max-md:-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center h-14 px-2 border-b border-[#E5E5E5] dark:border-[#2a2a2a] flex-shrink-0">
          <button
            onClick={toggleSidebar}
            className={cn(ICON_CONTAINER, "rounded-lg hover:bg-[#F5F5F5] dark:hover:bg-[#2a2a2a] text-[#64748B] dark:text-[#9a9a95] hover:text-[#13343B] dark:hover:text-[#e7e7e2] transition-colors")}
            aria-label="Toggle sidebar"
            title="Toggle sidebar"
          >
            <PanelLeft className={cn(ICON_WIDTH, "h-5")} />
          </button>

          <div className={cn(
            "overflow-hidden transition-[opacity,width] duration-200",
            isExpanded ? "opacity-100 ml-1 w-auto" : "opacity-0 w-0"
          )}>
            {!isHydrating ? (
              <Link href="/" className="flex items-center">
                <span
                  className="text-2xl text-[#13343B] dark:text-[#e7e7e2] whitespace-nowrap"
                  style={{
                    fontFamily: 'Gebuk, system-ui, sans-serif',
                    letterSpacing: '0.02em',
                  }}
                >
                  Ayle
                </span>
              </Link>
            ) : (
              <Skeleton className="h-8 w-16" />
            )}
          </div>
        </div>

        {isHydrating ? (
          <>
            <div className="flex-1 overflow-y-auto no-scrollbar p-2">
              <Skeleton className="h-10 w-10 mb-2" />
              {isExpanded && (
                <div className="space-y-1 mt-4">
                  {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              )}
            </div>
            <div className="flex-shrink-0 border-t border-[#E5E5E5] dark:border-[#2a2a2a] p-2">
              <Skeleton className="h-10 w-10" />
            </div>
          </>
        ) : isAuthenticated && user ? (
          <>
            {/* Main Content Area */}
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto no-scrollbar p-2">
              {/* New Thread Button */}
              <button
                onClick={() => {
                  onNewChat()
                  // Close sidebar on mobile
                  if (typeof window !== 'undefined' && window.innerWidth < 768) {
                    setIsExpanded(false)
                  }
                }}
                className={cn(
                  "relative flex items-center w-full rounded-lg text-[#13343B] dark:text-[#e7e7e2] transition-colors duration-150 mb-2 touch-manipulation",
                  "border border-[#E5E5E5] dark:border-[#2a2a2a] hover:bg-[#F5F5F5] dark:hover:bg-[#2a2a2a]"
                )}
                title="New Thread"
              >
                <div className={ICON_CONTAINER}>
                  <Plus className={cn(ICON_WIDTH, "h-5")} />
                </div>
                <div className={cn(
                  "flex items-center justify-between flex-1 pr-3 transition-[opacity,width] duration-200 overflow-hidden",
                  isExpanded ? "opacity-100 w-auto" : "opacity-0 w-0"
                )}>
                  <span className="whitespace-nowrap text-sm font-medium">New Thread</span>
                  <span className="text-xs text-[#64748B] dark:text-[#9a9a95] flex items-center gap-0.5">
                    <Command className="h-3 w-3" /> K
                  </span>
                </div>
              </button>

              {/* Navigation Items */}
              <nav className="space-y-1">
                <NavItem
                  href="/"
                  icon={Home}
                  label="Home"
                  isActive={isHomeActive}
                  isExpanded={isExpanded}
                  onNavigate={closeSidebarOnMobile}
                />

                <NavItem
                  href="/library"
                  icon={Library}
                  label="Library"
                  isActive={isLibraryActive}
                  isExpanded={isExpanded}
                  onNavigate={closeSidebarOnMobile}
                />

                {isExpanded && (
                  <div className="ml-10 pl-3 border-l border-[#E5E5E5] dark:border-[#2a2a2a]">
                    <ThreadsList
                      threads={threads}
                      visibleChats={visibleChats}
                      showMoreChats={showMoreChats}
                      setShowMoreChats={setShowMoreChats}
                      currentPath={pathname || ""}
                      onDelete={setThreadToDelete}
                      onClick={handleThreadClick}
                      isLoading={isLoading}
                    />
                  </div>
                )}
              </nav>
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 border-t border-[#E5E5E5] dark:border-[#2a2a2a] p-2">
              <div className="flex items-center w-full rounded-lg hover:bg-[#F5F5F5] dark:hover:bg-[#2a2a2a] transition-colors">
                <DropdownMenu open={isProfileDropdownOpen} onOpenChange={setIsProfileDropdownOpen}>
                  <DropdownMenuTrigger className="flex items-center w-full">
                    <div className={ICON_CONTAINER}>
                      <div className="flex items-center justify-center rounded-full bg-[#20B8CD] text-white w-7 h-7 text-xs font-medium">
                        {profileLoading ? "..." : (profile?.firstName?.[0] || user.email?.[0] || "U").toUpperCase()}
                      </div>
                    </div>
                    <div className={cn(
                      "flex items-center flex-1 min-w-0 pr-2 transition-[opacity,width] duration-200 overflow-hidden",
                      isExpanded ? "opacity-100 w-auto" : "opacity-0 w-0"
                    )}>
                      <span className="font-medium text-[#13343B] dark:text-[#e7e7e2] text-sm truncate flex-1 text-left">
                        {profileLoading ? "..." : (profile?.firstName || user.email?.split("@")[0] || "User")}
                      </span>
                      <ChevronDown className="h-4 w-4 text-[#64748B] dark:text-[#9a9a95] flex-shrink-0 ml-2" />
                    </div>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    side="top"
                    className="w-48 bg-white dark:bg-[#1f2121] border border-[#E5E5E5] dark:border-[#2a2a2a] shadow-lg rounded-xl"
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
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Non-authenticated sidebar content */}
            <div className="flex-1 overflow-y-auto no-scrollbar p-2">
              <button
                onClick={() => {
                  onNewChat()
                  // Close sidebar on mobile
                  if (typeof window !== 'undefined' && window.innerWidth < 768) {
                    setIsExpanded(false)
                  }
                }}
                className={cn(
                  "relative flex items-center w-full rounded-lg text-[#13343B] dark:text-[#e7e7e2] transition-colors duration-150 mb-2 touch-manipulation",
                  "border border-[#E5E5E5] dark:border-[#2a2a2a] hover:bg-[#F5F5F5] dark:hover:bg-[#2a2a2a]"
                )}
                title="New Thread"
              >
                <div className={ICON_CONTAINER}>
                  <Plus className={cn(ICON_WIDTH, "h-5")} />
                </div>
                <div className={cn(
                  "flex items-center justify-between flex-1 pr-3 transition-[opacity,width] duration-200 overflow-hidden",
                  isExpanded ? "opacity-100 w-auto" : "opacity-0 w-0"
                )}>
                  <span className="whitespace-nowrap text-sm font-medium">New Thread</span>
                  <span className="text-xs text-[#64748B] dark:text-[#9a9a95] flex items-center gap-0.5">
                    <Command className="h-3 w-3" /> K
                  </span>
                </div>
              </button>

              <nav className="space-y-1">
                <NavItem
                  href="/"
                  icon={Home}
                  label="Home"
                  isActive={isHomeActive}
                  isExpanded={isExpanded}
                  onNavigate={closeSidebarOnMobile}
                />

                <NavItem
                  href="/library"
                  icon={Library}
                  label="Library"
                  isActive={pathname === "/library"}
                  isExpanded={isExpanded}
                  onNavigate={closeSidebarOnMobile}
                />
              </nav>
            </div>

            {/* Footer with Sign Up and Log In */}
            <div className="flex-shrink-0 border-t border-[#E5E5E5] dark:border-[#2a2a2a] p-2">
              {isExpanded ? (
                <div className="space-y-3 p-2">
                  <div>
                    <p className="text-sm font-medium text-[#13343B] dark:text-[#e7e7e2] mb-1">Try Pro</p>
                    <p className="text-xs text-[#64748B] dark:text-[#9a9a95] mb-3">
                      Upgrade to more powerful AI models, increased limits and more advanced answers.
                    </p>
                    <button
                      onClick={openAuthDialog}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-[#20B8CD] hover:bg-[#1AA3B6] rounded-lg transition-colors"
                    >
                      <span>Learn More</span>
                    </button>
                  </div>

                  <button
                    onClick={openAuthDialog}
                    className="w-full px-4 py-2.5 text-sm font-medium text-white bg-[#13343B] dark:bg-[#20B8CD] hover:bg-[#0d2529] dark:hover:bg-[#1AA3B6] rounded-lg transition-colors"
                  >
                    Sign Up
                  </button>
                  <button
                    onClick={openAuthDialog}
                    className="w-full px-4 py-2.5 text-sm font-medium text-[#13343B] dark:text-[#e7e7e2] border border-[#E5E5E5] dark:border-[#2a2a2a] hover:bg-[#F5F5F5] dark:hover:bg-[#2a2a2a] rounded-lg transition-colors bg-transparent"
                  >
                    Log in
                  </button>
                </div>
              ) : (
                <button
                  onClick={openAuthDialog}
                  className={cn(ICON_CONTAINER, "w-full rounded-lg hover:bg-[#F5F5F5] dark:hover:bg-[#2a2a2a] text-[#64748B] dark:text-[#9a9a95] hover:text-[#13343B] dark:hover:text-[#e7e7e2] transition-colors")}
                  title="Sign In"
                >
                  <User className={cn(ICON_WIDTH, "h-5")} />
                </button>
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
        <AlertDialogContent className="bg-white dark:bg-[#1f2121] border border-gray-200 dark:border-[#2a2a2a]">
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

export default memo(LeftSidebar)
