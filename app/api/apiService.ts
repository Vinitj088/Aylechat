import type React from "react"
import { getAssetPath } from "../utils"
import type { Message } from "../types"
import { toast } from "sonner"

// URL detection regex
const URL_REGEX = /(https?:\/\/[^\s]+)/g

// Character limits for context windows
const MODEL_LIMITS = {
  exa: 4000,
  groq: 128000,
  google: 64000,
  default: 8000,
}

// K-Window Buffer Memory (number of message PAIRS)
const K_MESSAGE_PAIRS = 5

// Function to truncate conversation history to fit within context window
const truncateConversationHistory = (messages: Message[], modelId: string): Message[] => {
  // For Exa, include limited context for follow-up questions
  if (modelId === "exa") {
    const recentMessages = [...messages].slice(-3)

    if (recentMessages.length > 0 && recentMessages[recentMessages.length - 1].role !== "user") {
      const userMessages = messages.filter((msg) => msg.role === "user")
      if (userMessages.length > 0) {
        recentMessages[recentMessages.length - 1] = userMessages[userMessages.length - 1]
      }
    }

    return recentMessages
  }

  // K-Window Buffer Memory for LLMs
  const maxMessages = K_MESSAGE_PAIRS * 2

  if (messages.length <= maxMessages) {
    return messages
  }

  console.log(`Truncating history from ${messages.length} to ${maxMessages} messages (K=${K_MESSAGE_PAIRS}).`)
  return messages.slice(-maxMessages)
}

// Helper type for message updater function
type MessageUpdater = ((messages: Message[]) => void) | React.Dispatch<React.SetStateAction<Message[]>>

// Helper function to safely update messages
const updateMessages = (setMessages: MessageUpdater, updater: (prev: Message[]) => Message[]) => {
  if (typeof setMessages === "function") {
    try {
      ;(setMessages as React.Dispatch<React.SetStateAction<Message[]>>)(updater)
    } catch (_error) {
      try {
        const dummyArray: Message[] = []
        const updatedMessages = updater(dummyArray)
        ;(setMessages as (messages: Message[]) => void)(updatedMessages)
      } catch (innerE) {
        console.error("Failed to update messages:", innerE)
      }
    }
  }
}

// Function to enhance a query using llama-3.3-70b-versatile instant
export const enhanceQuery = async (query: string): Promise<string> => {
  try {
    // Use the new AI SDK route instead of the old groq route
    const response = await fetch("/api/ai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
      credentials: "include",
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            content:
              'You are PromptEnhancerBot, a specialized prompt enhancer that ONLY rewrites queries for improving clarity of prompt without ever answering them. Your sole purpose is to fix grammar and structure the prompt in a more LLM friendly way.\n\nFORMAT:\nInputs will be: REWRITE THIS QUERY ONLY, DO NOT ANSWER IT: "user query here"\nOutputs must be: REWRITTEN QUERY: "improved query here"\n\nRules:\n- You MUST use the exact output prefix "REWRITTEN QUERY: " followed by the rewritten text in quotes\n- You are FORBIDDEN from answering the query\n- DO NOT add information, explanations, or respond to the query content\n- Fix ONLY grammar, spelling, improve structure, and enhance clarity of the prompt\n- Preserve all references like "this text" or "above content"\n\nExamples:\n\nInput: REWRITE THIS QUERY ONLY, DO NOT ANSWER IT: "how computer work"\nOutput: REWRITTEN QUERY: "How do computers work?"\n\nInput: REWRITE THIS QUERY ONLY, DO NOT ANSWER IT: "tell me about earth"\nOutput: REWRITTEN QUERY: "Tell me about Earth in detailed structured way in easy words."\n\nInput: REWRITE THIS QUERY ONLY, DO NOT ANSWER IT: "what this code do explain"\nOutput: REWRITTEN QUERY: "What does this code do? Please explain."\n\nAfter I receive your output, I will extract only what\'s between the quotes after "REWRITTEN QUERY:". NEVER include ANY other text, explanations, or answers.',
          },
          {
            role: "user",
            content: `REWRITE THIS QUERY ONLY, DO NOT ANSWER IT: "${query}"`,
          },
        ],
        selectedModel: "llama-3.3-70b-versatile",
        temperature: 0.0,
      }),
    })

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error("No reader available")

    let enhancedQuery = ""

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = new TextDecoder().decode(value)
      const lines = chunk.split("\n").filter((line) => line.trim())

      for (const line of lines) {
        if (line.startsWith("0:")) {
          try {
            const jsonString = line.substring(2)
            const textChunk = JSON.parse(jsonString)
            if (typeof textChunk === "string") {
              enhancedQuery += textChunk
            }
          } catch (e) {
            continue
          }
        }
      }
    }

    // Post-process the response to extract only the rewritten query
    const rewrittenQueryMatch = enhancedQuery.match(/REWRITTEN QUERY: "(.*?)"/)
    if (rewrittenQueryMatch && rewrittenQueryMatch[1]) {
      return rewrittenQueryMatch[1].trim()
    }

    return query
  } catch (error) {
    console.error("Error enhancing query:", error)
    return query
  }
}

// Updated scrape function for hybrid caching
const scrapeUrlContent = async (url: string, abortController: AbortController): Promise<string | null> => {
  console.log(`[Scrape] Checking validity/content for URL: ${url}`)
  const scrapeApiEndpoint = getAssetPath("/api/scrape")
  const localStorageKey = `scrape_content:${url}`

  try {
    const response = await fetch(scrapeApiEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
      signal: abortController.signal,
      credentials: "include",
      body: JSON.stringify({ urlToScrape: url }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: "Failed to parse scrape error response" }))
      console.error(`[Scrape] Backend scrape request failed (${response.status}):`, errorData)
      toast.warning("URL Scraping Failed", {
        description: `Could not get content for the URL. Error: ${errorData.message || response.statusText}`,
        duration: 5000,
      })
      localStorage.removeItem(localStorageKey)
      return null
    }

    const result = await response.json()

    if (result.success) {
      if (result.cacheStatus === "valid") {
        console.log("[Scrape] Backend confirms cache is valid. Checking localStorage...")
        const localData = localStorage.getItem(localStorageKey)
        if (localData) {
          console.log("[Scrape] Found valid content in localStorage.")
          toast.info("Using Cached URL Content", {
            description: "Using previously scraped content for this URL.",
            duration: 2000,
          })
          return localData
        } else {
          console.warn("[Scrape] Backend confirmed cache validity, but no content found in localStorage.")
          toast.warning("URL Content Missing", {
            description: "Could not find cached content locally. You might need to resubmit.",
            duration: 4000,
          })
          return null
        }
      } else if (result.cacheStatus === "refreshed" && result.markdownContent) {
        console.log(
          `[Scrape] Received refreshed content. Length: ${result.markdownContent.length}. Storing in localStorage.`,
        )
        localStorage.setItem(localStorageKey, result.markdownContent)
        toast.success("URL Content Scraped", {
          description: "Fresh content from the URL will be used.",
          duration: 3000,
        })
        return result.markdownContent
      } else {
        console.warn("[Scrape] Backend response format unexpected.", result)
        localStorage.removeItem(localStorageKey)
        return null
      }
    } else {
      console.warn("[Scrape] Backend indicated scraping process failed.", result.message)
      toast.warning("URL Scraping Issue", {
        description: result.message || "Scraping completed but no content was returned.",
        duration: 5000,
      })
      localStorage.removeItem(localStorageKey)
      return null
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.log("[Scrape] Request aborted.")
      return null
    }
    console.error("[Scrape] Error calling backend scrape endpoint:", error)
    toast.error("Scraping Error", {
      description: `An error occurred while trying to scrape the URL: ${error instanceof Error ? error.message : "Unknown error"}`,
      duration: 5000,
    })
    localStorage.removeItem(localStorageKey)
    return null
  }
}

// UPDATED: Main fetch response function to use AI SDK route
export const fetchResponse = async (
  input: string,
  messages: Message[],
  selectedModel: string,
  abortController: AbortController,
  setMessages: MessageUpdater,
  assistantMessage: Message,
  attachments?: File[],
  activeFiles?: Array<{ name: string; type: string; uri: string }>,
  onFileUploaded?: (fileInfo: { name: string; type: string; uri: string }) => void,
) => {
  const trimmedInput = input.trim()
  let command: "/movies" | "/tv" | null = null
  let commandQuery: string | null = null
  let finalInput = trimmedInput

  // URL Detection and Scraping Logic
  const detectedUrls = trimmedInput.match(URL_REGEX)
  let scrapedContent: string | null = null

  if (detectedUrls && detectedUrls.length > 0 && selectedModel !== "exa") {
    const urlToScrape = detectedUrls[0]
    console.log(`[Fetch] URL detected: ${urlToScrape}. Checking/getting content...`)

    updateMessages(setMessages, (prev: Message[]) =>
      prev.map((msg: Message) => (msg.id === assistantMessage.id ? { ...msg, content: "Analyzing URL..." } : msg)),
    )

    scrapedContent = await scrapeUrlContent(urlToScrape, abortController)

    if (scrapedContent) {
      finalInput = `USER QUESTION: "${trimmedInput}"\n\nADDITIONAL CONTEXT FROM SCRAPED URL (${urlToScrape}):\n---\n${scrapedContent}\n---\n\nBased on the user question and the scraped context above, please provide an answer.`
      console.log("[Fetch] Input augmented with scraped content.")
    } else {
      console.log("[Fetch] No valid scraped content available. Proceeding with original query.")
    }

    updateMessages(setMessages, (prev: Message[]) =>
      prev.map((msg: Message) => (msg.id === assistantMessage.id ? { ...msg, content: "..." } : msg)),
    )
  }

  // Check for slash commands
  if (finalInput.startsWith("/movies ")) {
    command = "/movies"
    commandQuery = finalInput.substring(8).trim()
  } else if (finalInput.startsWith("/tv ")) {
    command = "/tv"
    commandQuery = finalInput.substring(5).trim()
  }

  // Prepare messages for conversation history
  const currentUserMessage: Message = {
    id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    role: "user",
    content: finalInput,
  }
  const updatedMessagesWithCurrentInput = [...messages, currentUserMessage]
  const truncatedMessages = truncateConversationHistory(updatedMessagesWithCurrentInput, selectedModel)

  let response

  try {
    // Handle Slash Commands
    if (command && commandQuery) {
      console.log(`Handling command: ${command} with query: ${commandQuery}`)
      const commandApiEndpoint = getAssetPath("/api/command-handler")

      response = await fetch(commandApiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
        signal: abortController.signal,
        body: JSON.stringify({ command, query: commandQuery }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`Command handler API request failed: ${response.status}`, errorText)
        throw new Error(`Command handler failed: ${response.statusText || errorText}`)
      }

      const result = await response.json()
      let finalAssistantMessage: Message

      if (result.type === "media_result") {
        console.log("Received media_result:", result.data)
        finalAssistantMessage = {
          ...assistantMessage,
          content: result.answer,
          mediaData: result.data,
          completed: true,
          startTime: assistantMessage.startTime || Date.now(),
          endTime: Date.now(),
          tps: 0,
        }
      } else if (result.type === "no_result" || result.type === "error") {
        console.log(`Command handler returned: ${result.type}`)
        finalAssistantMessage = {
          ...assistantMessage,
          content: result.message,
          completed: true,
          startTime: assistantMessage.startTime || Date.now(),
          endTime: Date.now(),
          tps: 0,
        }
      } else {
        throw new Error(`Unexpected response type from command handler: ${result.type}`)
      }

      updateMessages(setMessages, (prev: Message[]) =>
        prev.map((msg: Message) => (msg.id === assistantMessage.id ? finalAssistantMessage : msg)),
      )

      return finalAssistantMessage
    } else {
      // UPDATED: Use the new AI SDK route instead of old endpoints
      const apiEndpoint = getAssetPath("/api/ai")

      // Convert messages to the format expected by AI SDK
      const aiSdkMessages = truncatedMessages.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
      }))

      const requestOptions: RequestInit = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
        signal: abortController.signal,
        credentials: "include" as RequestCredentials,
      }

      const requestBody = JSON.stringify({
        messages: aiSdkMessages,
        selectedModel: selectedModel,
        ...(attachments && attachments.length > 0 ? { attachments } : {}),
        ...(activeFiles && activeFiles.length > 0 ? { activeChatFiles: activeFiles } : {}),
      })

      response = await fetch(apiEndpoint, {
        ...requestOptions,
        body: requestBody,
      })

      // Error handling
      if (!response.ok) {
        console.error(`API request failed with status ${response.status}`)

        if (response.status === 401) {
          toast.error("Authentication required", {
            description: "Please sign in to continue using this feature",
            duration: 5000,
          })
          throw new Error("Authentication required. Please sign in and try again.")
        }

        const contentType = response.headers.get("content-type")

        if (contentType && contentType.includes("application/json")) {
          const errorData = await response.json()

          if (response.status === 429) {
            let waitTime = 30
            let message = "Rate limit reached. Please try again later."

            if (errorData.error && errorData.error.message) {
              message = errorData.error.message

              const waitTimeMatch = message.match(/try again in (\d+\.?\d*)([ms]+)/)
              if (waitTimeMatch) {
                const timeValue = Number.parseFloat(waitTimeMatch[1])
                const timeUnit = waitTimeMatch[2]

                if (timeUnit === "ms") {
                  waitTime = Math.ceil(timeValue / 1000)
                } else {
                  waitTime = Math.ceil(timeValue)
                }
              }
            }

            toast.error("RATE LIMIT REACHED", {
              description: `Please wait ${waitTime} seconds before trying again.`,
              duration: 8000,
              action: {
                label: "DISMISS",
                onClick: () => {},
              },
            })

            const rateLimitError = new Error("Rate limit reached")
            rateLimitError.name = "RateLimitError"
            // @ts-expect-error - adding custom properties
            rateLimitError.waitTime = waitTime
            // @ts-expect-error - adding custom properties
            rateLimitError.details = message

            throw rateLimitError
          }

          console.error("API Error Data:", errorData)
          throw new Error(errorData.message || errorData.error?.message || `API error: ${response.status}`)
        }

        const errorText = await response.text()
        console.error("API Error Text:", errorText)
        throw new Error(errorText || `API request failed with status ${response.status}`)
      }

      // Special handling for Exa: parse as JSON, not as a stream
      if (selectedModel === 'exa') {
        const data = await response.json();
        // Use the answer and citations fields from Exa's /answer endpoint
        const exaContent = data.answer || 'No answer found.';
        const finalAssistantMessage: Message = {
          ...assistantMessage,
          content: exaContent,
          citations: data.citations || [],
          completed: true,
          startTime: Date.now(),
          endTime: Date.now(),
          tps: 0,
        };
        updateMessages(setMessages, (prev: Message[]) =>
          prev.map((msg: Message) => (msg.id === assistantMessage.id ? finalAssistantMessage : msg)),
        );
        return finalAssistantMessage;
      }

      // Stream handling for AI SDK response (all other models)
      if (!response.body) {
        throw new Error("Response body is null")
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let content = ""
      const citations: any[] | undefined = undefined
      let startTime: number | null = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split("\n").filter((line) => line.trim())

        for (const line of lines) {
          if (line.startsWith("0:")) {
            // Extract the JSON string part
            const jsonString = line.substring(2)
            try {
              const textChunk = JSON.parse(jsonString)
              if (typeof textChunk === "string") {
                content += textChunk
                if (startTime === null && textChunk.length > 0) {
                  startTime = Date.now()
                }

                // Update messages for UI
                updateMessages(setMessages, (prev: Message[]) =>
                  prev.map((msg: Message) =>
                    msg.id === assistantMessage.id
                      ? { ...msg, content: content, completed: false, startTime: startTime ?? undefined }
                      : msg,
                  ),
                )
              }
            } catch (e) {
              console.error("Failed to parse text chunk from stream:", line, e)
            }
          }
          // Handle other prefixes as needed (d:, e:, etc.)
        }
      }

      // Calculate final metrics
      const endTime = Date.now()
      const estimatedTokens = content.length > 0 ? content.length / 4 : 0
      const durationSeconds = startTime ? (endTime - startTime) / 1000 : 0
      const calculatedTps = durationSeconds > 0 ? estimatedTokens / durationSeconds : 0

      const finalAssistantMessage: Message = {
        ...assistantMessage,
        content,
        citations,
        completed: true,
        startTime: startTime ?? undefined,
        endTime,
        tps: calculatedTps,
      }

      updateMessages(setMessages, (prev: Message[]) =>
        prev.map((msg: Message) => (msg.id === assistantMessage.id ? finalAssistantMessage : msg)),
      )

      return finalAssistantMessage
    }
  } catch (err) {
    console.error("Error in fetchResponse:", err)

    if (err instanceof Error && err.message.includes("Authentication")) {
      throw err
    }

    if (err instanceof Error && err.name === "RateLimitError") {
      throw err
    }

    toast.error("Error processing request", {
      description: err instanceof Error ? err.message : "Unknown error occurred",
      duration: 5000,
    })

    throw err
  }
}
