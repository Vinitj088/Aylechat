"use client";
import { useEffect } from "react";

export default function FontInitializer() {
  useEffect(() => {
    if (typeof window !== "undefined") {
      const fontTheme = localStorage.getItem("fontTheme");
      if (fontTheme === "alternative") {
        document.documentElement.style.setProperty("--font-sans", "var(--font-sentient)");
        document.documentElement.style.setProperty("--font-serif", "var(--font-ppeditorial)");
      } else {
        document.documentElement.style.setProperty("--font-sans", "var(--font-geist-sans)");
        document.documentElement.style.setProperty("--font-serif", "var(--font-space-grotesk)");
      }
    }
  }, []);
  return null;
} 