"use client";
import { useEffect } from "react";

export default function BorderRadiusInitializer() {
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("roundedCorners");
      if (stored === "off") {
        document.documentElement.style.setProperty("--border-radius-default", "0px");
      } else {
        document.documentElement.style.setProperty("--border-radius-default", "0.5rem");
      }
    }
  }, []);
  return null;
} 