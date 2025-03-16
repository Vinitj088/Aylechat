'use client'

import { History as HistoryIcon, Menu, UserCircle2 } from 'lucide-react'
import { signOut, useSession } from 'next-auth/react'
import { Suspense, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { HistoryListClient } from './history-list-client'
import { HistorySkeleton } from './history-skeleton'
import { Button } from './ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from './ui/sheet'

// Error boundary component
function ErrorBoundary({ children }: { children: React.ReactNode }) {
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    const handleError = () => {
      setHasError(true)
      toast.error('Failed to load chat history')
    }

    window.addEventListener('error', handleError)
    return () => window.removeEventListener('error', handleError)
  }, [])

  if (hasError) {
    return (
      <div className="text-center py-4 text-sm text-destructive">
        <p>Failed to load history</p>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => setHasError(false)}
          className="mt-2"
        >
          Retry
        </Button>
      </div>
    )
  }

  return children
}

export function HistoryContainer() {
  const { data: session } = useSession()
  const userId = session?.user?.id

  const content = (
    <div className="w-full h-full overflow-y-auto px-4 py-0">
      {!userId ? (
        <div className="flex h-full items-center justify-center">
          <p className="text-muted-foreground">History is disabled</p>
        </div>
      ) : (
        <ErrorBoundary>
          <HistoryListClient userId={userId} />
        </ErrorBoundary>
      )}
    </div>
  )

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-64 p-0 flex flex-col gap-0">
        <SheetHeader className="p-4 flex-shrink-0 space-y-0">
          <SheetTitle className="flex items-center gap-1 text-sm font-normal">
            <HistoryIcon size={14} />
            History
          </SheetTitle>
        </SheetHeader>
        {session && (
          <div className="p-4 flex items-center gap-2 border-b flex-shrink-0">
            <UserCircle2 className="w-5 h-5 text-muted-foreground" />
            <span className="text-sm font-medium truncate">
              {session.user?.name || session.user?.email}
            </span>
          </div>
        )}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0 pt-0">
          <Suspense fallback={<HistorySkeleton />}>
            {content}
          </Suspense>
        </div>
        {session && (
          <div className="p-4 border-t mt-auto flex-shrink-0">
            <Button
              variant="outline"
              className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => signOut()}
            >
              Sign Out
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
