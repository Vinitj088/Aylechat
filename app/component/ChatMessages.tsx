"use client"

import { useEffect, useRef, useState, memo, useCallback } from "react"
import type { Message, Model } from "../types"
import MessageContent from "./MessageContent"
import Citation from "./Citation"
import { Copy, Check, Download, ChevronDown, ThumbsUp, ThumbsDown, MoreHorizontal, Sparkles, List } from "lucide-react"
import { toast } from "sonner"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import MediaCard from "@/components/MediaCard"
import WeatherCard from "./WeatherCard"
import React from "react"
import { useSidebarPin } from "@/context/SidebarPinContext"
import { cn } from "@/lib/utils"

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
  isSharedPage?: boolean
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
    isSharedPage,
  }: {
    message: Message
    messages: Message[]
    isUser: boolean
    threadId?: string | null | undefined
    threadTitle?: string
    onQuote?: (text: string) => void
    onRetry?: (message: Message) => void
    isSharedPage?: boolean
  }) => {
    const [copySuccess, setCopySuccess] = useState(false)
    const [isExporting, setIsExporting] = useState(false)

    const handleCopyMessage = async () => {
      try {
        await navigator.clipboard.writeText(message.content || "")
        setCopySuccess(true)
        toast.success("Copied to clipboard")
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
        const currentMessageIndex = messages.findIndex(msg => msg.id === message.id)
        if (currentMessageIndex === -1) {
          toast.error("Could not find message in conversation.")
          return
        }
        const relevantMessages = messages.slice(0, currentMessageIndex + 1)
        if (relevantMessages.length === 0) {
          toast.error("No content to export.")
          return
        }
        const formattedMessages = relevantMessages.map(msg => {
          if (msg.role === "user") {
            return `# ${msg.content}`
          }
          return msg.content
        })
        const markdown = formattedMessages.join("\n\n---\n\n")

        const response = await fetch("/api/pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
        toast.error(error.message || "Failed to export PDF.")
      } finally {
        setIsExporting(false)
      }
    }

    const handleRetry = () => {
      if (onRetry) onRetry(message)
    }

    // User message - displayed as a title/heading like Perplexity
    if (isUser) {
      return (
        <div id={`message-${message.id}`} className="w-full mb-4 scroll-mt-20">
          {/* Quoted text if present */}
          {message.quotedText && message.quotedText.trim().length > 0 && (
            <div className="mb-2">
              <div className="border-l-4 border-[#20B8CD] bg-[#F5F5F5] dark:bg-[#2a2a2a] rounded-r-lg px-3 py-2 text-[#64748B] text-sm max-w-full">
                {(() => {
                  const words = message.quotedText.split(/\s+/)
                  return words.length > 40 ? words.slice(0, 40).join(" ") + " ..." : message.quotedText
                })()}
              </div>
            </div>
          )}
          {/* User question as title */}
          <h1 className="text-2xl md:text-3xl font-medium text-[#13343B] dark:text-[#e7e7e2] leading-tight font-ui tracking-tight">
            {message.content}
          </h1>
          {/* Separator line */}
          <div className="mt-6 border-b border-[#E5E5E5] dark:border-[#2a2a2a]" />
        </div>
      )
    }

    // Assistant message - full content with action buttons like Perplexity
    const hasCitations = message.citations && message.citations.length > 0;

    return (
      <div className="w-full">
        {/* Sources tab header - like Perplexity */}
        {hasCitations && (
          <div className="mb-4">
            <div className="flex items-center gap-4 mb-3 border-b border-[#E5E5E5] dark:border-[#2a2a2a]">
              <button className="flex items-center gap-1.5 px-1 py-2 text-sm font-medium text-[#13343B] dark:text-[#e7e7e2] border-b-2 border-[#20B8CD] font-ui">
                <Sparkles className="w-4 h-4" />
                Sources
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-[#F5F5F5] dark:bg-[#2a2a2a] rounded-full text-[#64748B]">
                  {message.citations?.length}
                </span>
              </button>
            </div>
            {/* Citation cards */}
            <Citation citations={message.citations!} provider={message.provider} completed={message.completed} />
          </div>
        )}

        {/* Media cards if present */}
        {message.mediaData && (
          <div className="mb-4">
            <MediaCard data={message.mediaData} />
          </div>
        )}
        {message.weatherData && (
          <div className="mb-4">
            <WeatherCard data={message.weatherData} />
          </div>
        )}

        {/* Main content */}
        <div className="text-[#13343B] dark:text-[#e7e7e2] text-base leading-relaxed font-ui font-light">
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

        {/* Action row - Perplexity style */}
        {!isSharedPage && message.content && message.content.length > 0 && (
          <div className="mt-6 pt-4 border-t border-[#E5E5E5] dark:border-[#2a2a2a] flex items-center justify-between font-ui">
            {/* Left actions - Export */}
            <div className="flex items-center gap-1">
              <button
                onClick={handleExportPdf}
                disabled={isExporting}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[#64748B] hover:text-[#13343B] dark:hover:text-[#e7e7e2] hover:bg-[#F5F5F5] dark:hover:bg-[#2a2a2a] rounded-lg transition-colors text-sm"
              >
                <Download className={`w-4 h-4 ${isExporting ? 'animate-pulse' : ''}`} />
                <span>Export</span>
              </button>
            </div>

            {/* Right actions - TPS, Reactions, Copy, More */}
            <div className="flex items-center gap-1">
              {/* TPS indicator */}
              {message.completed && typeof message.tps === "number" && message.tps > 0 && (
                <TooltipProvider delayDuration={100}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-xs text-[#94A3B8] cursor-help px-2 py-1.5">
                        {message.tps.toFixed(1)} t/s
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="bg-[#1f2121] text-[#e7e7e2] border-[#2a2a2a]">
                      <p>Frontend-perceived throughput.<br />Includes network and processing time.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <button
                className="p-2 text-[#64748B] hover:text-[#13343B] dark:hover:text-[#e7e7e2] hover:bg-[#F5F5F5] dark:hover:bg-[#2a2a2a] rounded-lg transition-colors"
                title="Good response"
              >
                <ThumbsUp className="w-4 h-4" />
              </button>
              <button
                className="p-2 text-[#64748B] hover:text-[#13343B] dark:hover:text-[#e7e7e2] hover:bg-[#F5F5F5] dark:hover:bg-[#2a2a2a] rounded-lg transition-colors"
                title="Bad response"
              >
                <ThumbsDown className="w-4 h-4" />
              </button>
              <button
                onClick={handleCopyMessage}
                className="p-2 text-[#64748B] hover:text-[#13343B] dark:hover:text-[#e7e7e2] hover:bg-[#F5F5F5] dark:hover:bg-[#2a2a2a] rounded-lg transition-colors"
                title="Copy"
              >
                {copySuccess ? (
                  <Check className="w-4 h-4 text-[#20B8CD]" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
              <button
                className="p-2 text-[#64748B] hover:text-[#13343B] dark:hover:text-[#e7e7e2] hover:bg-[#F5F5F5] dark:hover:bg-[#2a2a2a] rounded-lg transition-colors"
                title="More options"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    )
  },
)

ChatMessage.displayName = "ChatMessage"

const LoadingIndicator = memo(({ isExa, modelName }: { isExa: boolean; modelName: string }) => {
  const text = isExa ? "Searching with Exa" : `Thinking with ${modelName || "AI"}`;

  return (
    <div className="flex items-center gap-3 py-4">
      {/* Animated wave bars */}
      <div className="flex items-center gap-0.5 h-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="w-0.5 bg-[#20B8CD] rounded-full animate-[wave_1.2s_ease-in-out_infinite]"
            style={{
              animationDelay: `${i * 0.15}s`,
              height: `${8 + (i % 2) * 4}px`,
            }}
          />
        ))}
      </div>

      {/* Shimmer text */}
      <span
        className="text-sm font-medium bg-gradient-to-r from-[#13343B] via-[#20B8CD] to-[#13343B] dark:from-[#e7e7e2] dark:via-[#20B8CD] dark:to-[#e7e7e2] bg-[length:200%_100%] bg-clip-text text-transparent animate-[shimmer_2s_linear_infinite]"
      >
        {text}
      </span>

      {/* Animated dots */}
      <span className="inline-flex text-[#20B8CD]">
        {[...Array(3)].map((_, i) => (
          <span
            key={i}
            className="animate-[loading-dots_1.4s_infinite] opacity-0"
            style={{ animationDelay: `${i * 0.2}s` }}
          >
            .
          </span>
        ))}
      </span>
    </div>
  );
})

LoadingIndicator.displayName = "LoadingIndicator"

// Table of Contents component for message navigation
const TableOfContents = memo(({ messages, activeMessageId }: { messages: Message[], activeMessageId: string | null }) => {
  const userMessages = messages.filter(m => m.role === "user")

  if (userMessages.length < 2) return null // Only show TOC if there are multiple questions

  const scrollToMessage = (messageId: string) => {
    const element = document.getElementById(`message-${messageId}`)
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  const truncateText = (text: string, maxLength: number = 40) => {
    if (!text) return ""
    if (text.length <= maxLength) return text
    return text.slice(0, maxLength) + "..."
  }

  return (
    <div className="hidden xl:block fixed right-8 top-16 w-48 max-h-[70vh] overflow-y-auto no-scrollbar">
      <div className="bg-white dark:bg-[#1f2121] border border-[#E5E5E5] dark:border-[#2a2a2a] rounded-xl p-3 shadow-sm">
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[#E5E5E5] dark:border-[#2a2a2a]">
          <List className="w-3.5 h-3.5 text-[#64748B]" />
          <span className="text-xs font-medium text-[#64748B] font-ui uppercase tracking-wide">Contents</span>
        </div>
        <div className="space-y-1">
          {userMessages.map((msg, idx) => (
            <button
              key={msg.id}
              onClick={() => scrollToMessage(msg.id)}
              className={cn(
                "w-full text-left px-2 py-1.5 rounded-lg text-xs font-ui transition-colors",
                "hover:bg-[#F5F5F5] dark:hover:bg-[#2a2a2a]",
                activeMessageId === msg.id
                  ? "text-[#20B8CD] bg-[#F0FDFA] dark:bg-[#2a3a3a]"
                  : "text-[#64748B]"
              )}
            >
              <div className="flex items-start gap-2">
                <span className={cn(
                  "flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-medium",
                  activeMessageId === msg.id
                    ? "bg-[#20B8CD] text-white"
                    : "bg-[#E5E5E5] dark:bg-[#2a2a2a] text-[#64748B]"
                )}>
                  {idx + 1}
                </span>
                <span className="line-clamp-2 leading-tight">
                  {truncateText(msg.content || "")}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
})

TableOfContents.displayName = "TableOfContents"

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
  isSharedPage,
}: ChatMessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLElement | Window | null>(null)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const { pinned } = useSidebarPin()
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null)

  // Get the model name for display
  const modelName = (selectedModelObj?.name as string) || ""

  // Find the scroll container - look for parent with overflow-y-auto
  const findScrollContainer = useCallback((): HTMLElement | Window => {
    if (messagesEndRef.current) {
      let parent = messagesEndRef.current.parentElement
      while (parent) {
        const style = window.getComputedStyle(parent)
        if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
          return parent
        }
        parent = parent.parentElement
      }
    }
    return window
  }, [])

  const scrollToBottom = useCallback((behavior: "smooth" | "auto" = "smooth") => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior, block: "end" })
    }
  }, [])

  // This effect listens to scroll events and tracks active message for TOC
  useEffect(() => {
    const handleScroll = (e?: Event) => {
      // Get scroll info from either the scroll container or window
      const target = e?.target as HTMLElement | null
      const container = target || document.documentElement
      const scrollTop = container === document.documentElement ? container.scrollTop : (container as HTMLElement).scrollTop
      const scrollHeight = container === document.documentElement ? container.scrollHeight : (container as HTMLElement).scrollHeight
      const clientHeight = container === document.documentElement ? container.clientHeight : (container as HTMLElement).clientHeight

      const isScrolledUp = scrollHeight - scrollTop - clientHeight > 300
      setShowScrollButton(isScrolledUp)
      setIsAtBottom(!isScrolledUp)

      // Track which user message is currently in view
      const userMsgs = messages.filter(m => m.role === "user")
      if (userMsgs.length === 0) return

      // Find the user message that is currently most visible
      // We look for the last message whose top has scrolled past a threshold near the top of viewport
      const threshold = 120 // pixels from top of viewport

      let activeMsg: Message | null = null

      // Iterate forward through messages to find which section we're in
      for (let i = 0; i < userMsgs.length; i++) {
        const msg = userMsgs[i]
        const element = document.getElementById(`message-${msg.id}`)
        if (element) {
          const rect = element.getBoundingClientRect()
          // If this message's top is above our threshold, it's a candidate
          if (rect.top <= threshold) {
            activeMsg = msg
          } else {
            // Once we find a message below threshold, stop
            // The previous message (if any) is our active one
            break
          }
        }
      }

      // If no message found above threshold, use the first one
      if (!activeMsg && userMsgs.length > 0) {
        activeMsg = userMsgs[0]
      }

      if (activeMsg) {
        setActiveMessageId(activeMsg.id)
      }
    }

    const scrollContainer = findScrollContainer()
    scrollContainerRef.current = scrollContainer

    scrollContainer.addEventListener("scroll", handleScroll, { passive: true })
    handleScroll() // Initial check on mount

    return () => scrollContainer.removeEventListener("scroll", handleScroll)
  }, [messages, findScrollContainer])

  // This effect ensures that if a new message arrives, we scroll down
  useEffect(() => {
    if (isInitialLoad) {
      scrollToBottom("smooth")
      setIsInitialLoad(false)
    } else if (isAtBottom) {
      scrollToBottom("smooth")
    }
  }, [messages, isAtBottom, isInitialLoad])

  const renderMessage = useCallback(
    (message: Message, index: number) => {
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
          isSharedPage={isSharedPage}
        />
      )
    },
    [currentThreadId, onQuote, onRetry, messages, threadTitle, isSharedPage],
  )

  // Instead of rendering all messages in a flat list, render user+assistant pairs
  const renderPairedMessages = () => {
    const pairs: JSX.Element[] = []
    let i = 0
    while (i < messages.length) {
      const userMsg = messages[i]
      const nextMsg = messages[i + 1]
      if (userMsg.role === "user" && nextMsg && nextMsg.role === "assistant") {
        pairs.push(
          <React.Fragment key={userMsg.id + "-" + nextMsg.id}>
            {renderMessage(userMsg, i)}
            {renderMessage(nextMsg, i + 1)}
          </React.Fragment>,
        )
        i += 2
      } else {
        pairs.push(<React.Fragment key={userMsg.id}>{renderMessage(userMsg, i)}</React.Fragment>)
        i += 1
      }
    }
    return pairs
  }

  return (
    <div className="flex-1 pt-8 pb-32 relative no-scrollbar">
      <div className="w-full max-w-3xl mx-auto px-4 py-6 space-y-8 no-scrollbar">
        {renderPairedMessages()}
        {isLoading && <LoadingIndicator isExa={isExa} modelName={modelName} />}
        <div ref={messagesEndRef} />
      </div>

      {/* Table of Contents - right sidebar */}
      {!isSharedPage && <TableOfContents messages={messages} activeMessageId={activeMessageId} />}

      {showScrollButton && !isSharedPage && (
        <div
          className={cn(
            "fixed bottom-[150px] md:bottom-[160px] z-10 transition-all duration-300 ease-in-out",
            "left-1/2 -translate-x-1/2",
            pinned && "md:left-[calc(50%-128px)]"
          )}
        >
          <button
            onClick={() => scrollToBottom("smooth")}
            className="px-3 py-1.5 rounded-full shadow-lg bg-white dark:bg-[#1f2121] border border-[#E5E5E5] dark:border-[#2a2a2a] hover:bg-[#F5F5F5] dark:hover:bg-[#2a2a2a] flex items-center justify-center gap-1.5 transition-colors"
            aria-label="Scroll to bottom"
          >
            <span className="text-xs text-[#13343B] dark:text-[#e7e7e2] font-medium">
              Scroll down
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-[#64748B]" />
          </button>
        </div>
      )}
    </div>
  )
})

// Add display name to the main component
ChatMessages.displayName = "ChatMessages"

export default ChatMessages
