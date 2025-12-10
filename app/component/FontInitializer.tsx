"use client";
import { useEffect } from "react";

export default function FontInitializer() {
  useEffect(() => {
    if (typeof window !== "undefined") {
      // FK Grotesk for paragraphs, FK Grotesk Neue for everything else
      document.documentElement.style.setProperty("--font-body", "'FK Grotesk', system-ui, sans-serif");
      document.documentElement.style.setProperty("--font-heading", "'FK Grotesk Neue', system-ui, sans-serif");
      document.documentElement.style.setProperty("--font-ui", "'FK Grotesk Neue', system-ui, sans-serif");
    }
  }, []);
  return null;
} 