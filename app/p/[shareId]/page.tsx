"use client"

import { useParams } from "next/navigation"
import { db } from "@/lib/db"
import { cn } from "@/lib/utils"
import { FileText, Lock, Globe } from "lucide-react"
import Link from "next/link"

// Content block types
interface ContentBlock {
  id: string
  type: "paragraph" | "heading1" | "heading2" | "heading3" | "bullet" | "numbered" | "quote" | "divider" | "image"
  content: string
  imageUrl?: string
}

// Format date
const formatDate = (date: Date | number | undefined): string => {
  if (!date) return ""
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

export default function PublicPage() {
  const params = useParams()
  const shareId = params?.shareId as string

  // Query page by shareId
  const { data, isLoading } = db.useQuery(
    shareId
      ? {
          pages: {
            $: {
              where: { shareId },
            },
            user: {
              profile: {},
            },
          },
        }
      : null
  )

  const page = data?.pages?.[0]

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F0F0ED] dark:bg-[#0F1516]">
        <div className="max-w-3xl mx-auto px-4 py-12 animate-pulse">
          <div className="h-10 bg-[#E5E5E5] dark:bg-[#333] rounded w-2/3 mb-8" />
          <div className="space-y-4">
            <div className="h-6 bg-[#E5E5E5] dark:bg-[#333] rounded w-full" />
            <div className="h-6 bg-[#E5E5E5] dark:bg-[#333] rounded w-4/5" />
            <div className="h-6 bg-[#E5E5E5] dark:bg-[#333] rounded w-3/4" />
          </div>
        </div>
      </div>
    )
  }

  if (!page) {
    return (
      <div className="min-h-screen bg-[#F0F0ED] dark:bg-[#0F1516] flex items-center justify-center">
        <div className="text-center">
          <FileText className="w-12 h-12 text-[#64748B] mx-auto mb-4" />
          <h2 className="text-xl font-medium text-[#13343B] dark:text-[#F8F8F7] font-ui mb-2">
            Page not found
          </h2>
          <p className="text-[#64748B] text-sm mb-4">
            This page may have been deleted or made private.
          </p>
          <Link href="/" className="text-[#20B8CD] hover:underline font-ui">
            Go to Ayle
          </Link>
        </div>
      </div>
    )
  }

  if (!page.isPublic) {
    return (
      <div className="min-h-screen bg-[#F0F0ED] dark:bg-[#0F1516] flex items-center justify-center">
        <div className="text-center">
          <Lock className="w-12 h-12 text-[#64748B] mx-auto mb-4" />
          <h2 className="text-xl font-medium text-[#13343B] dark:text-[#F8F8F7] font-ui mb-2">
            This page is private
          </h2>
          <p className="text-[#64748B] text-sm mb-4">
            The author has made this page private.
          </p>
          <Link href="/" className="text-[#20B8CD] hover:underline font-ui">
            Go to Ayle
          </Link>
        </div>
      </div>
    )
  }

  const content = (page.content as ContentBlock[]) || []
  const authorName = page.user?.profile?.firstName || "Anonymous"

  return (
    <div className="min-h-screen bg-[#F0F0ED] dark:bg-[#0F1516]">
      {/* Header */}
      <div className="border-b border-[#E5E5E5] dark:border-[#333] bg-white dark:bg-[#0F1516]">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="text-xl text-[#13343B] dark:text-[#F8F8F7]"
            style={{ fontFamily: "Gebuk, system-ui, sans-serif", letterSpacing: "0.02em" }}
          >
            Ayle
          </Link>
          <div className="flex items-center gap-2 text-xs text-[#64748B]">
            <Globe className="w-3.5 h-3.5" />
            Public Page
          </div>
        </div>
      </div>

      {/* Content */}
      <article className="max-w-3xl mx-auto px-4 py-12">
        {/* Icon & Title */}
        <header className="mb-8">
          {page.icon && <span className="text-5xl mb-4 block">{page.icon}</span>}
          <h1 className="text-4xl font-medium text-[#13343B] dark:text-[#F8F8F7] font-ui mb-4">
            {page.title || "Untitled"}
          </h1>
          <div className="flex items-center gap-3 text-sm text-[#64748B]">
            <span>By {authorName}</span>
            <span>•</span>
            <span>{formatDate(page.publishedAt || page.createdAt)}</span>
          </div>
        </header>

        {/* Content Blocks */}
        <div className="prose prose-lg dark:prose-invert max-w-none">
          {content.map((block) => {
            switch (block.type) {
              case "heading1":
                return (
                  <h1
                    key={block.id}
                    className="text-3xl font-semibold text-[#13343B] dark:text-[#F8F8F7] mt-8 mb-4 font-ui"
                  >
                    {block.content}
                  </h1>
                )
              case "heading2":
                return (
                  <h2
                    key={block.id}
                    className="text-2xl font-semibold text-[#13343B] dark:text-[#F8F8F7] mt-6 mb-3 font-ui"
                  >
                    {block.content}
                  </h2>
                )
              case "heading3":
                return (
                  <h3
                    key={block.id}
                    className="text-xl font-semibold text-[#13343B] dark:text-[#F8F8F7] mt-5 mb-2 font-ui"
                  >
                    {block.content}
                  </h3>
                )
              case "quote":
                return (
                  <blockquote
                    key={block.id}
                    className="border-l-4 border-[#20B8CD] pl-4 italic text-[#64748B] my-4 font-body"
                  >
                    {block.content}
                  </blockquote>
                )
              case "bullet":
                return (
                  <li
                    key={block.id}
                    className="text-[#13343B] dark:text-[#F8F8F7] ml-6 list-disc font-body"
                  >
                    {block.content}
                  </li>
                )
              case "numbered":
                return (
                  <li
                    key={block.id}
                    className="text-[#13343B] dark:text-[#F8F8F7] ml-6 list-decimal font-body"
                  >
                    {block.content}
                  </li>
                )
              case "divider":
                return <hr key={block.id} className="border-[#E5E5E5] dark:border-[#333] my-8" />
              case "image":
                return block.imageUrl ? (
                  <img
                    key={block.id}
                    src={block.imageUrl}
                    alt={block.content || ""}
                    className="rounded-xl my-6 w-full"
                  />
                ) : null
              default:
                return (
                  <p
                    key={block.id}
                    className="text-[#13343B] dark:text-[#F8F8F7] leading-relaxed my-4 font-body"
                  >
                    {block.content}
                  </p>
                )
            }
          })}
        </div>
      </article>

      {/* Footer */}
      <footer className="border-t border-[#E5E5E5] dark:border-[#333] mt-16">
        <div className="max-w-3xl mx-auto px-4 py-8 text-center">
          <p className="text-sm text-[#64748B] mb-4">
            Created with{" "}
            <Link href="/" className="text-[#20B8CD] hover:underline">
              Ayle
            </Link>
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#13343B] hover:bg-[#0d2529] rounded-lg transition-colors"
          >
            Try Ayle for free
          </Link>
        </div>
      </footer>
    </div>
  )
}
