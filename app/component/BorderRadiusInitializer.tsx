"use client";
import { useEffect } from "react";

export default function BorderRadiusInitializer() {
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("roundedCorners");
      // Explicitly check for "on" to set radius to rounded, otherwise default to 0px (not rounded).
      if (stored === "on") {
        document.documentElement.style.setProperty("--border-radius-default", "0.75rem");
      } else {
        document.documentElement.style.setProperty("--border-radius-default", "0px");
      }
    }
  }, []);
  return null;
} 