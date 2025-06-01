# 🛠️ ExaChat → Vercel AI SDK Refactor Plan

---

## 1. **Project Analysis & Inventory**

### **Backend (app/api)**
- **Providers:**  
  - `cerebras/route.ts`
  - `exaanswer/route.ts` (custom, not AI SDK)
  - `groq/route.ts`
  - `together/route.ts`
  - `xai/route.ts`
  - `gemini/route.ts` (large, extra logic)
  - `openrouter/route.ts`
- **API Service Layer:**  
  - `apiService.ts` (main routing/middleware)
- **Threads/Chat Management:**  
  - `chat/threads/route.ts` (all threads metadata)
  - `chat/threads/[threadid]/route.ts` (individual thread data)
- **Command Handler:**  
  - `command-handler/route.ts` (MCP/tooling experiment, ignore for now)
- **Prefetch:**  
  - `prefetch.ts` (API prefetching, likely no refactor needed)
- **Scraping:**  
  - `scrape.ts` (site scraping, likely no refactor needed)
- **DB:**  
  - `lib/redis.ts` (Upstash Redis, check for compatibility)
- **Types:**  
  - `types.ts` (ensure types are compatible with AI SDK)

### **Frontend**
- **Main Pages:**  
  - `page.tsx` (home/new chat)
  - `chat/[threadid]/page.tsx` (individual thread)
  - `share/[shareid]/page.tsx` (public thread)
- **Components:**  
  - `ChatInput.tsx`, `DesktopSearchUI.tsx`, `MobileSearchUI.tsx`, `ChatMessages.tsx`, `QueryEnhancer.tsx`, `ShareButton.tsx`, `ShareDialog.tsx`, `UserProfile.tsx`, `Sidebar.tsx`, `Header.tsx`, `ModelSelector.tsx`, etc.
  - `/components/ChatThreadsList.tsx`, `/components/MediaCard.tsx`, etc.
- **Thread Caching:**  
  - `context/ThreadCacheContext.tsx` (thread cache, check for compatibility)

### **Other**
- **Environment:**  
  - `.env` (API keys, ensure all are available for AI SDK)
- **Documentation:**  
  - `vercel-ai-sdk-llms.txt` (AI SDK docs, use for all implementation)

---

## 2. **Refactor Strategy**

### **A. Backend Refactor**

#### **Step 1: Design a Universal AI SDK API Route**
- **Create a single API route** (e.g., `app/api/ai/route.ts`) that:
  - Accepts requests for all providers (Groq, Gemini, OpenRouter, Together, Exa, Cerebras, XAI, etc.)
  - Uses Vercel AI SDK's unified interface for all LLM calls, streaming, and agentic/MCP features.
  - Handles model selection, tool calls, and agentic workflows.
  - Accepts a universal request format (messages, model, attachments, etc.).
  - Returns a universal response format (streamed or full, with citations, images, etc.).

> **Note:** Together provider is not available in the official AI SDK and is skipped for now.

#### **Step 2: Remove/Refactor Old Provider Routes**
- **Deprecate** all individual provider routes (`groq/route.ts`, `gemini/route.ts`, etc.).
- **Redirect** all frontend calls to the new universal route.
- **Remove** custom logic for provider-specific streaming, error handling, etc.—let AI SDK handle it.

> **Note:** All old provider routes have been deleted. All LLM requests are now handled by the universal handler at `/api/ai/route.ts`.

#### **Step 3: Refactor Thread Management APIs**
- **Update** `chat/threads/route.ts` and `chat/threads/[threadid]/route.ts` to:
  - Use the new AI SDK-compatible message format.
  - Store and retrieve threads/messages in a way that's compatible with AI SDK's message structure.
  - Ensure thread creation, update, and fetch all work with the new backend.

> **Note:** All thread APIs now validate and store messages in AI SDK compatible format (role, content, tool_calls, etc).

#### **Step 4: Check/Refactor Redis Integration**
- **Review** `lib/redis.ts`:
  - Ensure message/thread storage is compatible with AI SDK's message format.
  - Update types if needed.
  - Ensure thread sharing/public links still work.

#### **Step 5: Review/Update Other APIs**
- **Prefetch (`prefetch.ts`)**:  
  - Likely no changes needed, but ensure it prefetches the new universal route.
- **Scrape (`scrape.ts`)**:  
  - No changes unless you want to use AI SDK for web search/augmented retrieval.

---

### **B. Frontend Refactor**

#### **Step 6: Update API Service Layer**
- **Refactor** `apiService.ts`:
  - Route all LLM/chat requests to the new universal AI SDK API.
  - Update request/response handling to match AI SDK's streaming and message format.
  - Remove all provider-specific logic.

#### **Step 7: Update Main Pages**
- **Refactor** `page.tsx`, `chat/[threadid]/page.tsx`, `share/[shareid]/page.tsx`:
  - Update data fetching to use the new API.
  - Ensure message rendering, thread loading, and sharing all work with the new backend.

#### **Step 8: Refactor Components**
- **Update** all chat-related components (`ChatInput`, `ChatMessages`, etc.):
  - Use the new message format (role, content, tool calls, etc.).
  - Update streaming logic to use AI SDK's streaming response.
  - Update model selection to use the new API.
  - Ensure attachments, citations, and agentic/tool outputs are handled.

#### **Step 9: Update Thread Caching**
- **Update** `ThreadCacheContext.tsx`:
  - Ensure it caches threads/messages in the new format.
  - Update cache invalidation if needed.

#### **Step 10: Update Types**
- **Update** `types.ts`:
  - Ensure all types (Message, Thread, etc.) match AI SDK's types.

---

### **C. Final Steps**

#### **Step 11: Test & Lint**
- **After each file refactor:**
  - Run linter and fix errors.
  - Test the functionality (unit and integration).
  - Update this plan with notes on what was changed and any issues.

#### **Step 12: Remove Dead Code**
- **Delete** all old provider-specific code and unused files.

#### **Step 13: Documentation**
- **Update** README and in-code comments to reflect the new architecture.

---

## 3. **Reference: AI SDK Documentation**
- **All implementation should follow** the docs in `vercel-ai-sdk-llms.txt`.
- **If unclear, search the web for latest Vercel AI SDK agentic/MCP usage.**

---

## 4. **Trackable Checklist**

- [x] **Universal AI SDK API route created**
- [x] All provider routes refactored/removed
- [x] Thread APIs updated for new message format
- [x] Redis integration checked/updated
- [x] Prefetch/scrape reviewed
- [x] `apiService.ts` refactored
- [x] Main pages updated
- [x] All chat components refactored
- [x] Thread cache updated
- [x] Types updated
- [x] Lint/test after each step
- [x] Remove dead code
- [x] Update documentation

---

## 5. **Next Steps**

**Start with:**
- [ ] Reading `vercel-ai-sdk-llms.txt` for the universal API handler pattern.
- [ ] Designing the new `app/api/ai/route.ts` (universal handler).
- [ ] Refactoring/removing one provider route at a time, testing as you go.

---

**If you need more info on any file, search/read it as needed.  
If you hit a roadblock, check the AI SDK docs or web.**

> **Note:** Redis types and storage are now fully AI SDK compatible.
> **Note:** Prefetch now only warms up the universal AI SDK route. Scrape does not require changes.
> **Note:** All LLM/chat requests now use the universal AI SDK API. All provider-specific logic is removed from apiService.ts.
> **Note:** All main pages now use the universal AI SDK API and message format, and are fully compatible.
> **Note:** All chat components, thread cache, and types are now fully AI SDK compatible.
> **Note:** All critical linter errors have been fixed. Only minor warnings remain (e.g., image optimization, exhaustive deps).
> **Note:** All old provider directories and files have been removed or confirmed empty.
> **Note:** The README now reflects the new Vercel AI SDK architecture and migration details. 