"use client"

import { useEffect, useRef, useState, memo, useCallback } from "react"
import type { Message, Model } from "../types"
import MessageContent from "./MessageContent"
import Citation from "./Citation"
import ShareButton from "./ShareButton"
import { Button } from "@/components/ui/button"
import { Copy, Check, RefreshCw, Download } from "lucide-react"
import { toast } from "sonner"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import MediaCard from "@/components/MediaCard"
import WeatherCard from "./WeatherCard"

interface ChatMessagesProps {
  messages: Message[]
  isLoading: boolean
  selectedModel: string
  selectedModelObj?: Model
  isExa: boolean
  currentThreadId: string | null | undefined
  threadTitle?: string
  bottomPadding?: number
  onQuote?: (text: string) => void
  onRetry?: (message: Message) => void
}

// Memoized message component to prevent unnecessary re-renders
const ChatMessage = memo(
  ({
    message,
    messages,
    isUser,
    threadId,
    onQuote,
    onRetry,
    threadTitle,
  }: {
    message: Message
    messages: Message[]
    isUser: boolean
    threadId?: string | null | undefined
    threadTitle?: string
    onQuote?: (text: string) => void
    onRetry?: (message: Message) => void
  }) => {
    const [copySuccess, setCopySuccess] = useState(false)
    const [isExporting, setIsExporting] = useState(false)

    const handleCopyMessage = async () => {
      try {
        await navigator.clipboard.writeText(message.content || "")
        setCopySuccess(true)
        toast.success("Message copied to clipboard")

        // Reset the status after 2 seconds
        setTimeout(() => {
          setCopySuccess(false)
        }, 2000)
      } catch (err) {
        console.error("Failed to copy message:", err)
        toast.error("Failed to copy message")
      }
    }

    const handleExportPdf = async () => {
      setIsExporting(true)
      toast.info("Generating PDF...", { duration: 5000 })
  
      try {
        // Find all messages up to and including the current message
        const currentMessageIndex = messages.findIndex(msg => msg.id === message.id)
        
        if (currentMessageIndex === -1) {
          toast.error("Could not find message in conversation.")
          return
        }

        // Get all messages up to the current one
        const relevantMessages = messages.slice(0, currentMessageIndex + 1)

        if (relevantMessages.length === 0) {
          toast.error("No content to export.")
          return
        }

        // Format the conversation with proper styling for all user messages
        const formattedMessages = relevantMessages.map(msg => {
          if (msg.role === "user") {
            // Format user messages as headings
            return `# ${msg.content}`
          }
          return msg.content
        })

        const markdown = formattedMessages.join("\n\n---\n\n")
  
        const response = await fetch("/api/pdf", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ markdown }),
        })
  
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || "Failed to generate PDF")
        }
  
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        const safeTitle = (threadTitle || "chat-export").replace(/[\\/?%*:|"<>]/g, "-")
        a.download = `${safeTitle}.pdf`
        document.body.appendChild(a)
        a.click()
        a.remove()
        window.URL.revokeObjectURL(url)
  
        toast.success("PDF exported successfully!")
      } catch (error: any) {
        console.error("Failed to export PDF:", error)
        toast.error(error.message || "Failed to export PDF. See console for details.")
      } finally {
        setIsExporting(false)
      }
    }

    // Retry handler for user messages
    const handleRetry = () => {
      if (onRetry) onRetry(message)
    }

    // Debug log for message properties
    if (!isUser) {
      console.log(`ChatMessage (Assistant, ID: ${message.id}):`, {
        contentLength: message.content?.length,
        completed: message.completed,
        startTime: message.startTime,
        endTime: message.endTime,
        tps: message.tps,
        shouldDisplayTPS: message.completed && typeof message.tps === "number" && message.tps > 0,
        hasMediaData: !!message.mediaData,
      })
    }

    return (
      <div className="w-full">
        <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
          <div className={`flex flex-col items-end ${isUser ? "w-full max-w-[75%]" : "w-full"} group`}>
            {/* Quoted block outside the bubble */}
            {message.quotedText && message.quotedText.trim().length > 0 && (
              <div className={`mb-1 mr-0 ml-0 w-full flex ${isUser ? "justify-end" : "justify-start"}`}>
                <div className={`flex items-center ${isUser ? "self-end" : "self-start"}`}>
                  <div className="border-l-4 border-[var(--brand-default)] bg-[var(--secondary-faint)] rounded-md px-3 py-2 text-[var(--text-light-muted)] text-sm max-w-full whitespace-pre-line shadow-sm">
                    {(() => {
                      const words = message.quotedText.split(/\s+/)
                      return words.length > 40 ? words.slice(0, 40).join(" ") + " ..." : message.quotedText
                    })()}
                  </div>
                </div>
              </div>
            )}
            {/* Main message bubble */}
            <div
              className={
                isUser
                  ? "chat-bubble-user !rounded-lg bg-[var(--secondary-darker)] text-[var(--text-light-default)] text-base py-0.5 px-4"
                  : "w-full text-[var(--text-light-default)] text-base message-ai py-3 border-0 px-1 md:px-4"
              }
            >
              {!isUser && message.mediaData && (
                <div className="mb-3">
                  <MediaCard data={message.mediaData} />
                </div>
              )}
              {!isUser && message.weatherData && (
                <div className="mb-3">
                  <WeatherCard data={message.weatherData} />
                </div>
              )}
              <div className="whitespace-pre-wrap text-[15px]">
                <MessageContent
                  content={message.content || ""}
                  role={message.role}
                  images={message.images}
                  attachments={message.attachments}
                  provider={message.provider}
                  onQuote={onQuote}
                  completed={message.completed}
                />
              </div>
              {message.citations && message.citations.length > 0 && <Citation citations={message.citations} />}
              {/* Action row for assistant (share/copy) - always visible on mobile, hover on desktop */}
              {!isUser && message.content && message.content.length > 0 && (
                <div className="mt-2 flex items-center justify-end gap-2 pt-2 border-0 px-1 md:px-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200">
                  <div className="flex items-center space-x-1 sm:space-x-2">
                    <ShareButton threadId={threadId} />
                    {message.content && message.content.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleExportPdf}
                        disabled={isExporting}
                        className="px-2 sm:px-3 text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 group h-8 rounded-md transition-all duration-300 ease-in-out overflow-hidden"
                        aria-label="Export to PDF"
                      >
                        <Download className={`h-4 w-4 flex-shrink-0 group-hover:mr-2 transition-all duration-300 ease-in-out ${isExporting ? "animate-pulse" : ""}`} />
                        <span className="max-w-0 group-hover:max-w-0 sm:group-hover:max-w-xs transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap text-xs">
                          {isExporting ? "Exporting..." : "Export PDF"}
                        </span>
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="px-2 sm:px-3 text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 group h-8 rounded-md transition-all duration-300 ease-in-out overflow-hidden"
                      aria-label="Copy message"
                      onClick={handleCopyMessage}
                    >
                      <div className="flex items-center justify-center">
                        {copySuccess ? (
                          <>
                            <Check className="h-4 w-4 flex-shrink-0 text-[var(--brand-default)] dark:text-[var(--brand-fainter)]" />
                            <span className="ml-2 text-xs text-[var(--brand-default)] dark:text-[var(--brand-default)]">
                              Copied!
                            </span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4 flex-shrink-0 group-hover:mr-2 transition-all duration-300 ease-in-out" />
                            <span className="max-w-0 group-hover:max-w-0 sm:group-hover:max-w-xs transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap text-xs">
                              Copy text
                            </span>
                          </>
                        )}
                      </div>
                    </Button>
                    {message.completed && typeof message.tps === "number" && message.tps > 0 && (
                      <TooltipProvider delayDuration={100}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap cursor-help">
                              {message.tps.toFixed(1)} tokens/s
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>
                              Frontend-perceived throughput. <br /> Includes network and processing time.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </div>
              )}
            </div>
            {/* Retry button below the user message bubble - always visible on mobile, hover on desktop */}
            {isUser && message.content && message.content.length > 0 && (
              <div className="flex justify-end w-full opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200 mt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-all duration-300 ease-in-out"
                  aria-label="Retry message"
                  onClick={handleRetry}
                >
                  <RefreshCw className="h-4 w-4" />
                  <span className="ml-2 text-xs">Retry</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  },
)

// Add display name to the component
ChatMessage.displayName = "ChatMessage"

// Loading indicator component
const LoadingIndicator = memo(({ isExa, modelName }: { isExa: boolean; modelName: string }) => (
  <div className="flex items-center gap-2 text-[var(--text-light-muted)] animate-pulse">
    <div className="w-2 h-2 rounded-full bg-[var(--brand-default)] animate-[bounce_1s_infinite]"></div>
    <div className="w-2 h-2 rounded-full bg-[var(--brand-default)] animate-[bounce_1s_infinite_200ms]"></div>
    <div className="w-2 h-2 rounded-full bg-[var(--brand-default)] animate-[bounce_1s_infinite_400ms]"></div>
    <span className="text-sm font-medium text-[var(--brand-dark)]">
      {isExa ? "Asking Exa..." : `Using ${modelName || ""}...`}
    </span>
  </div>
))

// Add display name to the component
LoadingIndicator.displayName = "LoadingIndicator"

const ChatMessages = memo(function ChatMessages({
  messages,
  isLoading,
  selectedModel,
  selectedModelObj,
  isExa,
  currentThreadId,
  threadTitle,
  bottomPadding,
  onQuote,
  onRetry,
}: ChatMessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [messageCount, setMessageCount] = useState(0)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [showScrollButton, setShowScrollButton] = useState(false)

  // Get the model name for display
  const modelName = (selectedModelObj?.name as string) || ""

  const renderMessage = useCallback(
    (message: Message) => {
      return (
        <ChatMessage
          key={message.id}
          message={message}
          messages={messages}
          isUser={message.role === "user"}
          threadId={currentThreadId}
          onQuote={onQuote}
          onRetry={onRetry}
          threadTitle={threadTitle}
        />
      )
    },
    [currentThreadId, onQuote, onRetry, messages, threadTitle],
  )

  // Scroll to bottom only on initial mount (when thread is opened), with no animation
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "auto" })
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      className="flex-1 overflow-y-auto pt-16 pb-[120px] md:px-4 md:pb-[150px] scroll-smooth relative"
      style={{ paddingBottom: `${(bottomPadding ?? 0) + 150}px` }}
    >
      <div className="w-full max-w-full md:max-w-4xl mx-auto px-2 md:px-4 py-6 space-y-6">
        {messages.map(renderMessage)}

        {isLoading && <LoadingIndicator isExa={isExa} modelName={modelName} />}

        <div ref={messagesEndRef} />
      </div>
    </div>
  )
})

// Add display name to the main component
ChatMessages.displayName = "ChatMessages"

export default ChatMessages
