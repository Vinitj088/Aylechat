import { useState, useEffect, useRef, useCallback } from "react"

/**
 * Optimized typewriter hook for smooth streaming text display.
 * Uses batched updates and adaptive speed for better performance.
 */
const useTypewriter = (text: string, enabled = true) => {
  const [displayedText, setDisplayedText] = useState(enabled ? "" : text)
  const charIndexRef = useRef(0)
  const rafIdRef = useRef<number | null>(null)
  const lastUpdateTimeRef = useRef(0)

  // Adaptive speed: characters per frame based on stream speed
  const getCharsToAdd = useCallback((remaining: number) => {
    // Fast catch-up for large gaps, smooth for small gaps
    if (remaining > 100) return Math.min(remaining, 20) // Fast catch-up
    if (remaining > 50) return Math.min(remaining, 10)  // Medium speed
    if (remaining > 20) return Math.min(remaining, 5)   // Moderate speed
    return Math.min(remaining, 3)                        // Smooth typing
  }, [])

  // Reset when text shrinks (new message)
  useEffect(() => {
    if (!enabled) {
      setDisplayedText(text)
      charIndexRef.current = text.length
      return
    }

    if (text.length < charIndexRef.current) {
      charIndexRef.current = 0
      setDisplayedText("")
    }
  }, [text, enabled])

  // Main animation loop
  useEffect(() => {
    if (!enabled) return

    // Already caught up
    if (charIndexRef.current >= text.length) {
      if (displayedText !== text) {
        setDisplayedText(text)
      }
      return
    }

    const animate = (timestamp: number) => {
      // Throttle updates to ~60fps for performance
      const elapsed = timestamp - lastUpdateTimeRef.current
      if (elapsed < 16) {
        rafIdRef.current = requestAnimationFrame(animate)
        return
      }
      lastUpdateTimeRef.current = timestamp

      const remaining = text.length - charIndexRef.current
      if (remaining <= 0) {
        setDisplayedText(text)
        return
      }

      const charsToAdd = getCharsToAdd(remaining)
      const newIndex = Math.min(text.length, charIndexRef.current + charsToAdd)

      charIndexRef.current = newIndex
      setDisplayedText(text.substring(0, newIndex))

      // Continue if not caught up
      if (newIndex < text.length) {
        rafIdRef.current = requestAnimationFrame(animate)
      }
    }

    rafIdRef.current = requestAnimationFrame(animate)

    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
    }
  }, [displayedText, text, enabled, getCharsToAdd])

  return displayedText
}

export default useTypewriter 