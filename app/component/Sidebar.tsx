"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import { formatDistanceToNow } from "date-fns"
import { toast } from "sonner"
import { X, Trash2, LogOut, Clock, User, AlertTriangle, Pin, PinOff } from "lucide-react"
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
import { Skeleton } from "@/components/ui/skeleton"
import Link from 'next/link'
import { db } from "@/lib/db"

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
  onSignInClick?: () => void
  refreshTrigger?: number
  pinned?: boolean
  setPinned?: (pinned: boolean) => void
}

export default function Sidebar({ isOpen, onClose, onSignInClick, refreshTrigger = 0, pinned = false, setPinned }: SidebarProps) {
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [threadToDelete, setThreadToDelete] = useState<string | null>(null)

  const router = useRouter()
  const pathname = usePathname()
  const { user, signOut, openAuthDialog } = useAuth()
  const isAuthenticated = !!user

  // Query for the current user's profile directly
const { data: profileData, isLoading: profileLoading, error: profileError } = db.useQuery(
  user ? { 
    profiles: { 
      $: { where: { userId: user.id } },
      user: {}
    } 
  } : null
);
const profile = profileData?.profiles?.[0];

  // Only run threads query if user?.id is defined
  const { data, isLoading, error } = db.useQuery(
    user?.id ? {
      threads: {
        $: {
          where: { 'user.id': user.id },
          order: { updatedAt: 'desc' }
        },
        user: {
          profile: {}
        },
      }
    } : null
  );
  const threads = data?.threads || [];


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
      const windowWidth = window.innerWidth
      // Show sidebar when mouse is within 20px of right edge
      if (e.clientX >= windowWidth - 20) {
        setIsHovered(true)
      }
      // Hide sidebar when mouse moves away from sidebar area (beyond 280px from right)
      else if (e.clientX < windowWidth - 280) {
        setIsHovered(false)
      }
    }

    const handleMouseLeave = () => {
      setIsHovered(false)
    }

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseleave", handleMouseLeave)

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseleave", handleMouseLeave)
    }
  }, [isMobile])

  // Determine if sidebar should be visible
  const shouldShowSidebar = isMobile ? isOpen : isHovered

  const handleThreadClick = (threadId: string) => {
    router.push(`/chat/${threadId}`)
    if (isMobile) {
      onClose()
    }
  }

  const handleDeleteThread = async (threadId: string) => {
    try {
      await db.transact(db.tx.threads[threadId].delete());
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
    if (!threadToDelete) return;
    await handleDeleteThread(threadToDelete);
    setThreadToDelete(null);
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
      const txs = threads.map(t => db.tx.threads[t.id].delete());
      await db.transact(txs);
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

      {/* Hover trigger area for desktop - invisible area at right edge */}
      {!isMobile && !pinned && (
        <div
          className="fixed right-0 top-0 w-5 h-full z-30 pointer-events-auto"
          onMouseEnter={() => setIsHovered(true)}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-64 bg-gradient-to-b from-[var(--secondary-faint)] to-[var(--secondary-fainter)] border-l border-[var(--secondary-darkest)] shadow-lg transform transition-transform duration-300 ease-in-out",
          shouldShowSidebar || pinned ? "translate-x-0" : "translate-x-full",
        )}
        onMouseEnter={() => !isMobile && setIsHovered(true)}
        onMouseLeave={() => !isMobile && setIsHovered(false)}
        style={pinned ? { right: 0 } : {}}
      >
        {/* Sidebar content */}
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="px-4 py-3 border-b border-[var(--secondary-darkest)] bg-[var(--secondary-default)] flex items-center justify-between">
            <h2 className="text-base font-medium text-[var(--text-light-default)] flex items-center">
              <Clock className="h-4 w-4 mr-2 text-[var(--brand-default)]" />
              Chat History
            </h2>
            <div className="flex items-center gap-1">
              {/* Pin/unpin button - desktop only */}
              {!isMobile && setPinned && (
                <button
                  onClick={() => setPinned(!pinned)}
                  className="p-1.5 rounded-full hover:bg-[var(--secondary-darker)] text-[var(--text-light-muted)] hover:text-[var(--text-light-default)] transition-colors"
                  aria-label={pinned ? "Unpin sidebar" : "Pin sidebar"}
                >
                  {pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                </button>
              )}
            {/* Only show close button on mobile */}
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

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {!isAuthenticated ? (
              <div className="flex flex-col items-center justify-center h-full space-y-4">
                <p className="text-sm text-[var(--text-light-muted)]">Sign in to view your chat history</p>
                <button
                  onClick={onSignInClick || openAuthDialog}
                  className="px-4 py-2 text-sm font-medium text-white bg-[var(--brand-default)] dark:bg-[var(--brand-fainter)] border-2 border-[var(--secondary-darkest)] shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,0.2)] hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[1px_1px_0px_0px_rgba(255,255,255,0.2)] transition-all"
                >
                  Sign In
                </button>
              </div>
            ) : isLoading ? (
              <ul className="space-y-2.5">
                {[...Array(6)].map((_, i) => (
                  <li key={i} className="relative">
                    <div className="w-full text-left p-3 rounded-md border border-[var(--secondary-darkest)] bg-[var(--secondary-fainter)]">
                      <div className="flex justify-between items-start">
                         {/* Title skeleton */} 
                         <Skeleton className="h-4 w-32 mb-2" />
                        {/* Delete button skeleton */}
                        <Skeleton className="h-5 w-5 rounded-full" />
                      </div>
                      {/* Time skeleton */}
                      <Skeleton className="h-3 w-20 mt-2" />
                    </div>
                  </li>
                ))}
              </ul>
            ) : error ? (
              <div className="text-center py-4 px-3 bg-[var(--accent-maroon-light)] border border-[var(--accent-maroon-dark)] rounded-md">
                <p className="text-[var(--accent-red)] text-sm">{error.message}</p>
              </div>
            ) : threads.length === 0 ? (
              <div className="text-center py-6 px-3 bg-[var(--secondary-fainter)] rounded-md border border-dashed border-[var(--secondary-darker)]">
                <p className="text-[var(--text-light-muted)] text-sm">No chat history yet</p>
                <p className="text-xs text-[var(--text-light-faint)] mt-1">Start a new chat to see your history here</p>
              </div>
            ) : (
              <ul className="space-y-2.5">
                {threads.map((thread) => (
                  <li key={thread.id} className="relative">
                    <div
                      className={cn(
                        "w-full text-left p-3 rounded-md border transition-all duration-200",
                        pathname === `/chat/${thread.id}`
                          ? "bg-[var(--brand-fainter)] border-[var(--brand-muted)] shadow-[0_0_0_1px_var(--brand-faint)]"
                          : "border-[var(--secondary-darkest)] hover:bg-[var(--secondary-darker)] hover:border-[var(--secondary-darkest)]",
                      )}
                    >
                      <div className="flex justify-between items-start">
                        <div
                          className="font-medium truncate pr-2 text-sm text-[var(--text-light-default)] cursor-pointer"
                          onClick={() => handleThreadClick(thread.id)}
                        >
                          {thread.title}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setThreadToDelete(thread.id);
                          }}
                          className="p-1 text-[var(--text-light-muted)] hover:text-[var(--accent-red)] hover:bg-[var(--accent-maroon-light)] rounded-full transition-colors"
                          title="Delete thread"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div
                        className="text-xs text-[var(--text-light-muted)] mt-1.5 flex items-center cursor-pointer"
                        onClick={() => handleThreadClick(thread.id)}
                      >
                        <Clock className="h-3 w-3 mr-1 inline-block text-[var(--brand-faint)]" />
                        {formatDistanceToNow(new Date(thread.updatedAt ?? 0), { addSuffix: true })}
                      </div>
                    </div>
                  </li>
                ))}
                {threads.length > 0 && (
                  <li className="pt-3 border-t border-dashed border-[var(--secondary-darker)] mt-3">
                    <button
                      onClick={handleClearAllHistory}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-[var(--accent-red)] hover:bg-[var(--accent-maroon-light)] rounded-md transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                      Clear All History
                    </button>
                  </li>
                )}
                {threads.length === 0 && !isLoading && !error && (
                  <li className="text-center mt-4 pt-3 border-t border-dashed border-[var(--secondary-darker)]">
                    <span className="text-xs text-[var(--text-light-muted)] italic">— History is empty —</span>
                  </li>
                )}
              </ul>
            )}
          </div>

 {isAuthenticated && user && (
  <div className="p-3 border-t border-[var(--secondary-darkest)] bg-gradient-to-b from-[var(--secondary-faint)] to-[var(--secondary-default)]">
    <div className="flex justify-between items-center">
      <Link
        href="/settings"
        className="text-sm truncate flex items-center text-[var(--text-light-default)] hover:text-[var(--brand-default)] focus:text-[var(--brand-default)] transition-colors cursor-pointer outline-none"
        tabIndex={0}
        title="Account settings"
      >
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[var(--brand-fainter)] text-[var(--brand-default)] mr-2">
          <User className="h-3.5 w-3.5" />
        </div>
        <span className="font-medium">
          {profileLoading ? (
            <Skeleton className="h-4 w-16" />
          ) : (
            profile?.firstName || user.email?.split('@')[0] || user.email || 'User'
          )}
        </span>
      </Link>
      <button
        onClick={handleSignOut}
        className="px-2 py-1.5 text-[var(--text-light-muted)] hover:text-[var(--text-light-default)] hover:bg-[var(--secondary-darker)] rounded-md flex items-center gap-1.5 text-xs transition-colors"
        title="Sign out"
      >
        <LogOut className="h-3.5 w-3.5" />
        <span>Sign Out</span>
      </button>
    </div>
  </div>
)}
        </div>
      </div>

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

      {/* Thread delete dialog */}
      <AlertDialog open={!!threadToDelete} onOpenChange={(open) => { if (!open) setThreadToDelete(null); }}>
        <AlertDialogContent className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Delete this chat thread?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this chat thread and remove its data from our servers.
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
