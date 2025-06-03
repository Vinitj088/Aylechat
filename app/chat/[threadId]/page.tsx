"use client"

import type React from "react"
import { useState, useRef, useEffect, Suspense, useCallback } from "react"
import type { Model, ModelType } from "../../types"
import { useChat } from "@ai-sdk/react"
import Header from "../../component/Header"
import dynamic from "next/dynamic"
import type { ChatInputHandle } from "../../component/ChatInput"
import modelsData from "../../../models.json"
import { useRouter, useParams } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import { toast } from "sonner"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/ThemeToggle"

// Lazy load heavy components
const ChatMessages = dynamic(() => import("../../component/ChatMessages"), {
  loading: () => (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  ),
  ssr: false,
})

const DynamicChatInput = dynamic(() => import("../../component/ChatInput"), {
  ssr: false,
})

const DynamicSidebar = dynamic(() => import("../../component/Sidebar"), {
  ssr: false,
})

function ThreadPageContent() {
  const params = useParams()
  const threadId = params?.threadId as string
  const [selectedModel, setSelectedModel] = useState<ModelType>("gemini-2.0-flash")
  const [models, setModels] = useState<Model[]>([])
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [refreshSidebar, setRefreshSidebar] = useState(0)
  const [isLoadingThread, setIsLoadingThread] = useState(true)
  const [threadLoadError, setThreadLoadError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const { user, session, isLoading: authLoading, openAuthDialog } = useAuth()
  const router = useRouter()
  const chatInputRef = useRef<ChatInputHandle>(null)
  const [attachments, setAttachments] = useState<File[]>([])
  const [activeChatFiles, setActiveChatFiles] = useState<Array<{ name: string; type: string; uri: string }>>([])
  const [chatInputHeightOffset, setChatInputHeightOffset] = useState(0)
  const [hasLoadedThread, setHasLoadedThread] = useState(false)
  const [threadMessages, setThreadMessages] = useState<any[]>([])
  const latestMessagesRef = useRef<any[]>([])

  const isAuthenticated = !!user

  const {
    messages: chatMessages,
    input,
    setInput,
    handleInputChange,
    handleSubmit: chatHandleSubmit,
    append,
    isLoading: chatIsLoading,
    error: chatError,
    stop: stopChat,
    reload: reloadChat,
    setMessages: setChatMessages,
    data: chatData,
  } = useChat({
    api: "/api/ai",
    id: threadId,
    initialMessages: threadMessages,
    onFinish: async (message, { finishReason, usage }) => {
      console.log("Thread chat finished, updating thread...")

      if (user && isAuthenticated && threadId) {
        // Remove any message with the same id as the new message to avoid duplicates
        const filteredMessages = latestMessagesRef.current.filter(m => m.id !== message.id)
        // Ensure the new message has a unique id
        const newMessage = { ...message, id: message.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `msg-${Date.now()}-${Math.random()}`) }
        const allMessages = [...filteredMessages, newMessage]
        console.log("Updating thread with messages:", allMessages.length)

        await updateThread(threadId, allMessages, selectedModel)
        setRefreshSidebar((prev) => prev + 1)
      }
    },
    onError: (err) => {
      console.error("Chat error:", err)
      toast.error(err.message || "An error occurred with the AI chat connection.")
    },
  })

  useEffect(() => {
    latestMessagesRef.current = chatMessages
  }, [chatMessages])

  // Load models
  useEffect(() => {
    const groqModels = modelsData.models.filter((model) => model.providerId === "groq")
    const googleModels = modelsData.models.filter((model) => model.providerId === "google")
    const openRouterModels = modelsData.models.filter((model) => model.providerId === "openrouter")
    const cerebrasModels = modelsData.models.filter((model) => model.providerId === "cerebras")
    const xaiModels = modelsData.models.filter((model) => model.providerId === "xai")

    setModels([
      {
        id: "exa",
        name: "Exa Search",
        provider: "Exa",
        providerId: "exa",
        enabled: true,
        toolCallType: "native",
        searchMode: true,
      },
      ...xaiModels,
      ...googleModels,
      ...cerebrasModels,
      ...openRouterModels,
      ...groqModels,
    ])
  }, [])

  // FIXED: Load thread data with proper error handling and message setting
  useEffect(() => {
    let isMounted = true

    const loadThread = async () => {
      if (!threadId || !isAuthenticated || hasLoadedThread || authLoading) {
        return
      }

      console.log("Loading thread:", threadId)
      setIsLoadingThread(true)
      setThreadLoadError(null)

      try {
        const response = await fetch(`/api/chat/threads/${threadId}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
          },
          credentials: "include",
        })

        if (!isMounted) return

        if (!response.ok) {
          if (response.status === 401) {
            openAuthDialog()
            return
          }
          if (response.status === 404) {
            setThreadLoadError("Thread not found")
            toast.error("Thread not found")
            router.push("/")
            return
          }
          throw new Error(`Failed to load thread: ${response.status}`)
        }

        const data = await response.json()

        if (!isMounted) return

        if (data.success && data.thread) {
          console.log("Thread loaded successfully:", data.thread)
          console.log("Messages in thread:", data.thread.messages?.length || 0)

          // FIXED: Properly set messages in useChat
          if (data.thread.messages && Array.isArray(data.thread.messages) && data.thread.messages.length > 0) {
            // Ensure messages have proper format
            const formattedMessages = data.thread.messages.map((msg: any) => ({
              id: msg.id || `msg-${Date.now()}-${Math.random()}`,
              role: msg.role,
              content: msg.content,
              createdAt: msg.createdAt || new Date(),
            }))

            console.log("Setting formatted messages:", formattedMessages)
            setThreadMessages(formattedMessages)

            // IMPORTANT: Set messages immediately after loading
            setChatMessages(formattedMessages)
          } else {
            console.log("No messages found in thread")
            setThreadMessages([])
            setChatMessages([])
          }

          // Set the model if available
          if (data.thread.model) {
            setSelectedModel(data.thread.model)
          }

          setHasLoadedThread(true)
        } else {
          console.error("Invalid thread data received:", data)
          throw new Error("Invalid thread data received")
        }
      } catch (error: any) {
        if (!isMounted) return

        console.error("Error loading thread:", error)
        setThreadLoadError(error.message)
        toast.error("Failed to load conversation")

        setTimeout(() => {
          if (isMounted) {
            router.push("/")
          }
        }, 2000)
      } finally {
        if (isMounted) {
          setIsLoadingThread(false)
        }
      }
    }

    // Only load if we have auth and haven't loaded yet
    if (isAuthenticated && !authLoading && !hasLoadedThread) {
      loadThread()
    }

    return () => {
      isMounted = false
    }
  }, [threadId, isAuthenticated, authLoading, hasLoadedThread, setChatMessages, router, openAuthDialog])

  // Update thread function with better logging
  const updateThread = async (threadId: string, messages: any[], model: string) => {
    if (!isAuthenticated || !user) {
      console.log("Not authenticated, cannot update thread")
      return
    }

    console.log("Updating thread:", threadId)
    console.log("Messages to update:", messages.length)

    try {
      const plainMessages = messages.map((m, index) => ({
        id: m.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `msg-${Date.now()}-${index}`),
        role: m.role,
        content: m.content,
        createdAt: m.createdAt || new Date().toISOString(),
        ...((m as any).attachments ? { attachments: (m as any).attachments } : {}),
      }))

      const response = await fetch(`/api/chat/threads/${threadId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          messages: plainMessages,
          model: model,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error("Thread update error:", errorText)
        throw new Error(`Failed to update thread: ${response.status} - ${errorText}`)
      }

      const result = await response.json()
      console.log("Thread updated successfully:", result)

      if (result.success) {
        toast.success("Conversation updated")
      }

      return result
    } catch (error: any) {
      console.error("Error updating thread:", error)
      toast.error("Failed to save conversation", {
        description: error.message || "Please try again",
        duration: 5000,
      })
    }
  }

  // Handle file uploaded event
  const handleFileUploaded = useCallback((fileInfo: { name: string; type: string; uri: string }) => {
    setActiveChatFiles((prev) => {
      if (!prev.some((f) => f.uri === fileInfo.uri)) {
        return [...prev, fileInfo]
      }
      return prev
    })
  }, [])

  // Remove active file
  const removeActiveFile = useCallback((uri: string) => {
    setActiveChatFiles((prev) => prev.filter((f) => f.uri !== uri))
  }, [])

  // FIXED: Handle form submit - use the useChat handleSubmit directly
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() && attachments.length === 0) return
    if (!isAuthenticated || !user) {
      openAuthDialog()
      return
    }

    console.log("Submitting message in thread:", threadId)
    console.log("Current input:", input)
    console.log("Current messages before submit:", chatMessages.length)

    const getFileList = () => {
      if (attachments.length === 0) return undefined
      const dt = new DataTransfer()
      attachments.forEach((file) => dt.items.add(file))
      return dt.files
    }

    const fileList = getFileList()

    // Use the useChat handleSubmit directly - this will properly add the user message
    await chatHandleSubmitWrapper(e, fileList)

    setAttachments([])
  }

  const chatHandleSubmitWrapper = async (e: React.FormEvent, fileList: FileList | undefined) => {
    await chatHandleSubmit(e, {
      body: {
        selectedModel: selectedModel,
        activeChatFiles: activeChatFiles,
      },
      experimental_attachments: fileList,
    })
  }

  const handleModelChange = (modelId: string) => {
    setSelectedModel(modelId as ModelType)
  }

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen)
  }

  const handleNewChat = () => {
    router.push("/")
  }

  const handleActiveFilesHeightChange = useCallback((height: number) => {
    setChatInputHeightOffset(height > 0 ? height + 8 : 0)
  }, [])

  // Derived variables
  const isExa = selectedModel === "exa"
  const selectedModelObj = models.find((model) => model.id === selectedModel)
  const hasMessages = chatMessages.length > 0
  const providerName = selectedModelObj?.provider || "AI"

  // Show loading state
  if (authLoading || isLoadingThread) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="mt-4 text-muted-foreground">Loading conversation...</p>
      </main>
    )
  }

  // Show error state
  if (threadLoadError) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center">
        <p className="text-red-500">Error: {threadLoadError}</p>
        <Button onClick={() => router.push("/")} className="mt-4">
          Go Home
        </Button>
      </main>
    )
  }

  // Debug log to check messages
  console.log("Thread page rendering with messages:", chatMessages.length)
  console.log("Has messages:", hasMessages)
  console.log("Chat messages:", chatMessages)

  return (
    <main className="flex min-h-screen flex-col">
      <div className="md:hidden">
        <Header toggleSidebar={toggleSidebar} />
      </div>

      <Link
        href="/"
        className="hidden md:flex fixed top-4 left-4 z-50 items-center transition-colors duration-200 hover:text-[#121212] dark:hover:text-[#ffffff]"
        onClick={(e) => {
          e.preventDefault()
          window.location.href = "/"
        }}
      >
        <span
          className="text-3xl text-[var(--brand-default)]"
          style={{
            fontFamily: "var(--font-gebuk-regular)",
            letterSpacing: "0.05em",
            fontWeight: "normal",
            position: "relative",
            padding: "0 4px",
          }}
        >
          Ayle
        </span>
      </Link>

      <DynamicSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onSignInClick={openAuthDialog}
        refreshTrigger={refreshSidebar}
      />

      {hasMessages || threadMessages.length > 0 ? (
        <>
          <ChatMessages
            messages={chatMessages as any[]}
            isLoading={chatIsLoading}
            selectedModel={selectedModel}
            selectedModelObj={selectedModelObj}
            isExa={isExa}
            currentThreadId={threadId}
            bottomPadding={chatInputHeightOffset}
          />

          <DynamicChatInput
            ref={chatInputRef}
            input={input}
            handleInputChange={(e: any) => handleInputChange(e)}
            handleSubmit={handleSubmit}
            isLoading={chatIsLoading}
            selectedModel={selectedModel}
            handleModelChange={handleModelChange}
            models={models}
            isExa={isExa}
            onNewChat={handleNewChat}
            onAttachmentsChange={setAttachments}
            activeChatFiles={activeChatFiles}
            removeActiveFile={removeActiveFile}
            onActiveFilesHeightChange={handleActiveFilesHeightChange}
          />
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">This conversation is empty</p>
            <Button onClick={handleNewChat}>Start New Chat</Button>
          </div>
        </div>
      )}

      <div className="hidden md:block fixed bottom-4 left-4 z-50">
        <ThemeToggle />
      </div>
    </main>
  )
}

export default function ThreadPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen flex-col items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </main>
      }
    >
      <ThreadPageContent />
    </Suspense>
  )
}
