'use client'

import { useSession } from 'next-auth/react'
import { useState } from 'react'

export function useAuthCheck() {
  const { data: session } = useSession()
  const [showAuthDialog, setShowAuthDialog] = useState(false)

  const checkAuth = () => {
    if (!session) {
      setShowAuthDialog(true)
      return false
    }
    return true
  }

  return {
    isAuthenticated: !!session,
    showAuthDialog,
    setShowAuthDialog,
    checkAuth
  }
} 