"use client";
import { useEffect } from "react";

export default function BorderRadiusInitializer() {
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("roundedCorners");
      // Explicitly check for "off" to set radius to 0, otherwise default to rounded.
      if (stored === "off") {
        document.documentElement.style.setProperty("--border-radius-default", "0px");
      } else {
        document.documentElement.style.setProperty("--border-radius-default", "0.75rem");
      }
    }
  }, []);
  return null;
} 