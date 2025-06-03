"use client"

import type React from "react"
import { useState, useRef, useEffect, Suspense, useCallback, useMemo } from "react"
import type { Message, Model, ModelType } from "./types"
import { useChat, type CreateMessage } from "@ai-sdk/react"
import Header from "./component/Header"
import dynamic from "next/dynamic"
import type { ChatInputHandle } from "./component/ChatInput"
import MobileSearchUI from "./component/MobileSearchUI"
import DesktopSearchUI from "./component/DesktopSearchUI"
import { fetchResponse } from "./api/apiService"
import modelsData from "../models.json"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import { toast } from "sonner"
import Link from "next/link"
import { prefetchAll } from "./api/prefetch"
import { ThemeToggle } from "@/components/ThemeToggle"

// Helper function to get provider description
const getProviderDescription = (providerName: string | undefined): string => {
  switch (providerName?.toLowerCase()) {
    case "google":
      return "Google provides higher context limits up to 1M tokens."
    case "openrouter":
      return "OpenRouter provides access to the latest AI models."
    case "cerebras":
      return "Cerebras offers exceptionally fast AI inference."
    case "groq":
      return "Groq delivers lightning-fast inference using LPUs."
    default:
      return `${providerName || "This provider"} offers fast AI inference.`
  }
}

// Lazy load heavy components
const ChatMessages = dynamic(() => import("./component/ChatMessages"), {
  loading: () => (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  ),
  ssr: false,
})

const DynamicChatInput = dynamic(() => import("./component/ChatInput"), {
  ssr: false,
})

const DynamicSidebar = dynamic(() => import("./component/Sidebar"), {
  ssr: false,
})

// Move allowedRoles to top-level scope
const allowedRoles = ['user', 'assistant', 'system', 'tool'];

function PageContent() {
  const [localMessages, setLocalMessages] = useState<Message[]>([])
  const [selectedModel, setSelectedModel] = useState<ModelType>("gemini-2.0-flash")
  const [models, setModels] = useState<Model[]>([
    {
      id: "exa",
      name: "Exa Search",
      provider: "Exa",
      providerId: "exa",
      enabled: true,
      toolCallType: "native",
      searchMode: true,
    },
  ])
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null)
  const [refreshSidebar, setRefreshSidebar] = useState(0)
  const abortControllerRef = useRef<AbortController | null>(null)
  const { user, session, isLoading: authLoading, openAuthDialog } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const chatInputRef = useRef<ChatInputHandle>(null)
  const [attachments, setAttachments] = useState<File[]>([])
  const scrapeAbortControllerRef = useRef<AbortController | null>(null)
  const [activeChatFiles, setActiveChatFiles] = useState<Array<{ name: string; type: string; uri: string }>>([])
  const [chatInputHeightOffset, setChatInputHeightOffset] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isAuthenticated = !!user

  const {
    messages: chatMessages,
    input,
    setInput,
    handleInputChange,
    handleSubmit: useChatHandleSubmit,
    append,
    isLoading: chatIsLoading,
    error: chatError,
    stop: stopChat,
    reload: reloadChat,
    setMessages: setChatMessages,
    data: chatData,
  } = useChat({
    api: "/api/ai",
    onFinish: async (message, { finishReason, usage }) => {
      // Only allow valid roles
      if (!['user', 'assistant', 'system', 'tool'].includes(message.role)) return;

      console.log("Chat finished, saving thread...")
      console.log("Current messages:", chatMessages)
      console.log("New message:", message)

      if (user && isAuthenticated) {
        // Remove any message with the same id as the new message to avoid duplicates
        const filteredMessages = latestMessagesRef.current.filter(m => m.id !== message.id)
        // Ensure the new message has a unique id
        const newMessage = { ...message, id: message.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `msg-${Date.now()}-${Math.random()}`) }
        const allMessages = [...filteredMessages, newMessage]
        console.log("All messages to save:", allMessages)

        const isFirstMessageAfterSubmit = allMessages.length === 2

        let titleToUse: string | null = null
        if (isFirstMessageAfterSubmit && allMessages[0].role === "user") {
          titleToUse = allMessages[0].content.substring(0, 50) + (allMessages[0].content.length > 50 ? "..." : "")
        }

        const newThreadId = await createOrUpdateThread(
          {
            messages: allMessages.filter(m => allowedRoles.includes(m.role)) as Message[],
            title: titleToUse,
          },
          currentThreadId,
          selectedModel,
        )

        if (newThreadId && !currentThreadId) {
          console.log("Created new thread:", newThreadId)
          setCurrentThreadId(newThreadId)
          window.history.pushState({}, "", `/chat/${newThreadId}`)
          setRefreshSidebar((prev) => prev + 1)
        } else if (newThreadId && currentThreadId) {
          console.log("Updated existing thread:", newThreadId)
          setRefreshSidebar((prev) => prev + 1)
        }
      }
    },
    onError: (err) => {
      console.error("Chat error:", err)
      toast.error(err.message || "An error occurred with the AI chat connection.")
    },
  })

  // Add this after chatMessages is defined
  const latestMessagesRef = useRef<Message[]>([])
  useEffect(() => {
    latestMessagesRef.current = chatMessages.filter(m => allowedRoles.includes(m.role)) as Message[];
  }, [chatMessages])

  // Combine messages from useChat with local messages for display
  const messages = useMemo(() => {
    return (chatMessages.length > 0 ? chatMessages : localMessages).filter(m => ['user', 'assistant', 'system', 'tool'].includes(m.role));
  }, [chatMessages, localMessages])

  const setMessages = (msgs: Message[]) => setLocalMessages(msgs.filter(m => ['user', 'assistant', 'system', 'tool'].includes(m.role)));

  // Prefetch API modules and data when the app loads
  useEffect(() => {
    prefetchAll().catch(() => {
      // Silently ignore prefetch errors
    })
  }, [])

  // Check URL parameters for auth dialog control
  useEffect(() => {
    if (!searchParams) return

    const authRequired = searchParams.get("authRequired")
    const expired = searchParams.get("expired")
    const error = searchParams.get("error")
    const sessionError = searchParams.get("session_error")
    const cookieError = searchParams.get("cookie_error")

    if (authRequired === "true" || expired === "true" || error || sessionError || cookieError) {
      if (authRequired === "true" || expired === "true" || error) {
        openAuthDialog()
      }

      if (expired === "true") {
        toast.error("Your session has expired. Please sign in again.")
      }
      if (error) {
        toast.error("Authentication error. Please sign in again.")
      }

      if (sessionError === "true" || cookieError === "true") {
        toast.error("Session issue detected", {
          description: "Please sign in again to get a fresh session",
          duration: 6000,
          action: {
            label: "Sign In",
            onClick: () => {
              openAuthDialog()
            },
          },
        })
      }

      const url = new URL(window.location.href)
      url.searchParams.delete("authRequired")
      url.searchParams.delete("expired")
      url.searchParams.delete("error")
      url.searchParams.delete("session_error")
      url.searchParams.delete("cookie_error")
      window.history.replaceState({}, "", url)
    }
  }, [searchParams, openAuthDialog])

  // Load models and set initially selected model
  useEffect(() => {
    const groqModels = modelsData.models.filter((model) => model.providerId === "groq")
    const googleModels = modelsData.models.filter((model) => model.providerId === "google")
    const openRouterModels = modelsData.models.filter((model) => model.providerId === "openrouter")
    const cerebrasModels = modelsData.models.filter((model) => model.providerId === "cerebras")
    const xaiModels = modelsData.models.filter((model) => model.providerId === "xai")
    // Remove Together AI models
    // const togetherModels = modelsData.models.filter((model) => model.providerId === "together")

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
      // ...togetherModels, // Removed Together AI models
    ])

    const searchParams = new URLSearchParams(window.location.search)
    const modelParam = searchParams.get("model")

    if (modelParam) {
      setSelectedModel(modelParam)
    }
  }, [])

  // Handle initial URL search parameters for search engine functionality
  useEffect(() => {
    if (messages.length === 0 && !chatIsLoading) {
      const urlParams = new URLSearchParams(window.location.search)

      let searchQuery = urlParams.get("q")

      if (searchQuery && (searchQuery === "$1" || searchQuery === "%s")) {
        searchQuery = ""
      }

      if (searchQuery !== null) {
        const decodedQuery = decodeURIComponent(searchQuery)
        setInput(decodedQuery)
        setSelectedModel("exa")

        const timer = setTimeout(async () => {
          if (decodedQuery.trim()) {
            const userMessageLocal: Message = {
              id: crypto.randomUUID(),
              role: "user",
              content: decodedQuery,
            }

            const assistantMessageLocal: Message = {
              id: `ai-${Date.now()}`,
              role: "assistant",
              content: "...",
              provider: selectedModelObj?.provider,
            }

            setLocalMessages([userMessageLocal, assistantMessageLocal])

            try {
              const controller = new AbortController()
              abortControllerRef.current = controller

              const completedAssistantMessage = await fetchResponse(
                decodedQuery,
                [],
                "exa",
                controller,
                setLocalMessages,
                assistantMessageLocal,
                attachments,
                activeChatFiles,
                handleFileUploaded,
              )

              const finalMessages = [userMessageLocal, completedAssistantMessage]
              setLocalMessages(finalMessages)
              abortControllerRef.current = null
            } catch (error: any) {
              console.error("Error performing search:", error)

              const updatedMessages = [
                userMessageLocal,
                {
                  ...assistantMessageLocal,
                  content: `Error: ${error.message || "Failed to perform search. Please try again."}`,
                  completed: true,
                },
              ]

              setLocalMessages(updatedMessages)
              abortControllerRef.current = null
            }
          }
        }, 800)

        return () => clearTimeout(timer)
      }
    }
  }, [authLoading])

  const handleFileUploaded = useCallback((fileInfo: { name: string; type: string; uri: string }) => {
    setActiveChatFiles((prev) => {
      if (!prev.some((f) => f.uri === fileInfo.uri)) {
        return [...prev, fileInfo]
      }
      return prev
    })
  }, [])

  const removeActiveFile = useCallback((uri: string) => {
    setActiveChatFiles((prev) => prev.filter((f) => f.uri !== uri))
  }, [])

  const getFileList = () => {
    if (attachments.length === 0) return undefined
    const dt = new DataTransfer()
    attachments.forEach((file) => dt.items.add(file))
    return dt.files
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() && attachments.length === 0) return

    if (!isAuthenticated || !user) {
      openAuthDialog()
      return
    }

    if (isSubmitting) return

    setIsSubmitting(true)

    try {
      console.log("Submitting message:", input)
      console.log("Current thread ID:", currentThreadId)

      await useChatHandleSubmit(e, {
        body: {
          selectedModel: selectedModel,
          activeChatFiles: activeChatFiles,
          isFirstMessage: chatMessages.length === 0,
          threadTitle:
            chatMessages.length === 0 ? input.substring(0, 50) + (input.length > 50 ? "..." : "") : undefined,
        },
        experimental_attachments: getFileList(),
      })
      setAttachments([])
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleLoginClick = useCallback(() => {
    openAuthDialog()
  }, [openAuthDialog])

  const handleModelChange = (modelId: string) => {
    setSelectedModel(modelId as ModelType)
  }

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen)
  }

  const handleAuthSuccess = async () => {
    setRefreshSidebar((prev) => prev + 1)

    if (input.trim()) {
      setTimeout(() => {
        const fakeEvent = { preventDefault: () => {} } as React.FormEvent
        handleSubmit(fakeEvent)
      }, 300)
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      setRefreshSidebar((prev) => prev + 1)
    }
  }, [isAuthenticated])

  const handleRequestError = async (error: Error) => {
    if (
      error.message.includes("authentication") ||
      error.message.includes("Authentication") ||
      error.message.includes("auth") ||
      error.message.includes("Auth") ||
      error.message.includes("401") ||
      error.message.includes("Unauthorized")
    ) {
      openAuthDialog()
    } else if (error.message.includes("Rate limit")) {
      // @ts-ignore
      const waitTime = error.waitTime || 30
      toast.error("RATE LIMIT", { description: `Please wait ${waitTime} seconds before trying again`, duration: 5000 })
    } else {
      toast.error("Error Processing Request", {
        description: error.message || "Please try again later",
        duration: 5000,
      })
    }
  }

  // FIXED: Create or update thread function with better error handling and logging
  const createOrUpdateThread = async (
    threadContent: { messages: Message[] | CreateMessage[]; title?: string | null },
    threadIdFromParam: string | null,
    modelForThread: string,
  ) => {
    if (!isAuthenticated || !user) {
      console.log("Not authenticated, cannot save thread")
      openAuthDialog()
      return null
    }

    console.log("Creating/updating thread...")
    console.log("Thread ID:", threadIdFromParam)
    console.log("Messages to save:", threadContent.messages.length)
    console.log("Model:", modelForThread)

    try {
      const method = threadIdFromParam ? "PUT" : "POST"
      const endpoint = threadIdFromParam ? `/api/chat/threads/${threadIdFromParam}` : "/api/chat/threads"

      const timestamp = Date.now()

      // Convert messages to plain objects with proper format
      const plainMessages = threadContent.messages
        .filter((m) => ['user', 'assistant', 'system', 'tool'].includes(m.role))
        .map((m, index) => ({
          id: m.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `msg-${timestamp}-${index}`),
          role: m.role,
          content: m.content,
          createdAt: new Date().toISOString(),
          ...((m as any).attachments ? { attachments: (m as any).attachments } : {}),
        }))

      console.log("Sending request to:", endpoint)
      console.log("Plain messages:", plainMessages)

      const requestBody = {
        messages: plainMessages,
        title: threadContent.title,
        model: modelForThread,
      }

      console.log("Request body:", requestBody)

      const response = await fetch(`${endpoint}?t=${timestamp}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
        credentials: "include",
        body: JSON.stringify(requestBody),
      })

      console.log("Response status:", response.status)
      console.log("Response ok:", response.ok)

      if (!response.ok) {
        if (response.status === 401) {
          console.log("Unauthorized, opening auth dialog")
          openAuthDialog()
          return null
        }

        const errorText = await response.text()
        console.error("Thread save error:", errorText)
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`)
      }

      const result = await response.json()
      console.log("Thread save result:", result)

      if (result.success && result.thread) {
        console.log("Thread saved successfully:", result.thread.id)
        setRefreshSidebar((prev) => prev + 1)
        toast.success("Conversation saved")
        return result.thread.id
      } else if (method === "PUT" && response.ok) {
        console.log("Thread updated successfully")
        setRefreshSidebar((prev) => prev + 1)
        toast.success("Conversation updated")
        return threadIdFromParam
      } else {
        console.error("Unexpected response format:", result)
        throw new Error("Unexpected response format")
      }
    } catch (error: any) {
      console.error("Error saving thread:", error)

      if (error.message?.toLowerCase().includes("unauthorized") || error.message?.includes("401")) {
        handleRequestError(error)
      } else {
        toast.error("Error saving conversation", {
          description: error.message || "Please try again",
          duration: 5000,
        })
      }
      return null
    }
  }

  // Derived variables
  const isExa = selectedModel === "exa"
  const selectedModelObj = models.find((model) => model.id === selectedModel)
  const hasMessages = messages.length > 0
  const providerName = selectedModelObj?.provider || "AI"
  const description = isExa ? "Exa search uses embeddings to understand meaning." : getProviderDescription(providerName)

  const handleNewChat = () => {
    window.scrollTo(0, 0)
    setMessages([])
    setChatMessages([])
    setInput("")
    setCurrentThreadId(null)
    setActiveChatFiles([])
    window.history.pushState({}, "", "/")
  }

  const handleStartChat = () => {
    if (user) {
      router.push("/chat/new")
    } else {
      openAuthDialog()
    }
  }

  const handleCreateThread = async () => {
    try {
      router.push("/chat/new")
    } catch (error) {
      toast.error("Failed to create new thread")
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return
      }
      if (e.key === "/" && !chatIsLoading) {
        e.preventDefault()
        chatInputRef.current?.focus()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [chatIsLoading])

  useEffect(() => {
    router.prefetch("/chat")
    router.prefetch("/auth")

    if (user) {
      const recentThreads = localStorage.getItem("recentThreads")
      if (recentThreads) {
        JSON.parse(recentThreads).forEach((threadId: string) => {
          router.prefetch(`/chat/${threadId}`)
        })
      }
    }
  }, [user, router])

  const handleActiveFilesHeightChange = useCallback((height: number) => {
    setChatInputHeightOffset(height > 0 ? height + 8 : 0)
  }, [])

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

      {!hasMessages ? (
        <>
          <MobileSearchUI
            input={input}
            handleInputChange={(e: any) => handleInputChange(e)}
            handleSubmit={(e) => {
              e.preventDefault()
              handleSubmit(e)
            }}
            isLoading={chatIsLoading}
            selectedModel={selectedModel}
            handleModelChange={handleModelChange}
            models={models}
            setInput={setInput}
            messages={messages}
            description={description}
            onAttachmentsChange={setAttachments}
          />
          <DesktopSearchUI
            input={input}
            handleInputChange={(e: any) => handleInputChange(e)}
            handleSubmit={(e) => {
              e.preventDefault()
              handleSubmit(e)
            }}
            isLoading={chatIsLoading}
            selectedModel={selectedModel}
            handleModelChange={handleModelChange}
            models={models}
            setInput={setInput}
            description={description}
            messages={messages}
            onAttachmentsChange={setAttachments}
          />
        </>
      ) : (
        <>
          <ChatMessages
            messages={messages as any[]}
            isLoading={chatIsLoading}
            selectedModel={selectedModel}
            selectedModelObj={selectedModelObj}
            isExa={isExa}
            currentThreadId={currentThreadId}
            bottomPadding={chatInputHeightOffset}
          />

          {hasMessages && (
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
          )}
        </>
      )}

      <div className="hidden md:block fixed bottom-4 left-4 z-50">
        <ThemeToggle />
      </div>
    </main>
  )
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PageContent />
    </Suspense>
  )
}
