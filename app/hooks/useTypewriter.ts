import { useState, useEffect, useRef } from "react"

const useTypewriter = (text: string) => {
  const [displayedText, setDisplayedText] = useState("")
  const charIndexRef = useRef(0)

  useEffect(() => {
    // Reset if the text content shrinks, indicating a new message
    if (text.length < displayedText.length) {
      charIndexRef.current = 0
      setDisplayedText("")
    }
  }, [text, displayedText.length])

  useEffect(() => {
    // If we're already up to date, do nothing.
    if (charIndexRef.current >= text.length) {
      // Ensure the final text is accurate
      if (displayedText !== text) {
        setDisplayedText(text)
      }
      return
    }

    const animate = () => {
      // Determine how many characters to add in this frame.
      // This creates a "catch-up" effect if the stream is fast.
      const charsToAdd = Math.max(1, Math.floor((text.length - charIndexRef.current) / 10))

      const newIndex = Math.min(text.length, charIndexRef.current + charsToAdd)
      const newDisplayedText = text.substring(0, newIndex)

      charIndexRef.current = newIndex
      setDisplayedText(newDisplayedText)
    }

    const animationFrameId = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(animationFrameId)
    }
    // This effect runs on every frame as long as we're not caught up.
    // The dependency on displayedText and text creates this loop.
  }, [displayedText, text])

  return displayedText
}

export default useTypewriter 