# InstantDB Migration Plan for Aylechat

This document outlines the step-by-step plan to migrate all Redis-based data operations in your Aylechat project to InstantDB. The migration will cover both server and client usage, and ensure all thread/message storage, retrieval, and sharing features are ported to InstantDB.

---

## 1. **Preparation**
- [x] InstantDB CLI initialized and schema pulled (already done).
- [ ] Review and understand the generated `instant.schema.ts` and `instant.perms.ts` files.
- [ ] Decide on using `@instantdb/admin` (server) and/or `@instantdb/react` (client) for each use case.

## 2. **Identify Redis Usage**
- [x] All Redis operations are centralized in `lib/redis.ts`.
- [x] Data types are defined in `app/types.ts` and `lib/redis.ts`.
- [x] API endpoints in `app/api/chat/threads/`, `app/api/shared/`, etc. use RedisService for CRUD.
- [x] Client pages (`app/chat/[threadId]/page.tsx`, `app/shared/[shareId]/page.tsx`) fetch and display thread/message data.
- [x] `app/api/apiService.ts` uses fetch to interact with these endpoints.

## 3. **Migration Steps**

### 3.1. **Replace RedisService with InstantDB Service**
- [ ] Create a new `lib/instantdb.ts` (or similar) to encapsulate all InstantDB operations.
- [ ] Implement equivalents for:
  - getUserChatThreads
  - getChatThread
  - createChatThread
  - updateChatThread
  - makeThreadShareable
  - getSharedThread
  - deleteChatThread
  - deleteAllUserChatThreads
  - getLatestUserChatThreadsWithMessages
- [ ] Use the InstantDB SDK for all data access (read/write/query).
- [ ] Update types as needed to match InstantDB schema.

### 3.2. **Update API Endpoints**
- [ ] Refactor all API routes in `app/api/chat/threads/`, `app/api/shared/`, etc. to use the new InstantDB service instead of RedisService.
- [ ] Ensure all endpoints return the same shape of data as before for client compatibility.

### 3.3. **Update Client Fetch Logic**
- [ ] Ensure all client-side fetches (in `page.tsx` files and `apiService.ts`) continue to work with the new API responses.
- [ ] If any client code directly used Redis types, update to use InstantDB types.

### 3.4. **Test and Validate**
- [ ] Test all chat/thread CRUD operations (create, read, update, delete, share, fetch shared).
- [ ] Test edge cases (empty threads, sharing, deleting all, etc.).
- [ ] Validate data consistency and permissions (public/private threads).

### 3.5. **Cleanup**
- [ ] Remove all Redis dependencies and configuration.
- [ ] Remove `lib/redis.ts` after full migration.
- [ ] Update documentation and environment variables.

---

## 4. **File-by-File Checklist**

- [ ] `lib/redis.ts` → Replace with `lib/instantdb.ts` (all logic ported)
- [ ] `app/types.ts` → Update types if needed for InstantDB
- [ ] `app/api/chat/threads/route.ts` → Use InstantDB service
- [ ] `app/api/chat/threads/[threadId]/route.ts` → Use InstantDB service
- [ ] `app/api/chat/threads/[threadId]/share/route.ts` → Use InstantDB service
- [ ] `app/api/shared/[shareId]/route.ts` → Use InstantDB service
- [ ] `app/chat/[threadId]/page.tsx` → Ensure fetch logic works with new API
- [ ] `app/shared/[shareId]/page.tsx` → Ensure fetch logic works with new API
- [ ] `app/api/apiService.ts` → Ensure all thread/message API calls are compatible

---

## 5. **Notes & Recommendations**
- Use `@instantdb/admin` for all server-side (API route) operations.
- Use `@instantdb/react` only for direct client-side data access (if needed).
- Ensure all permissions and sharing logic is ported (public/private threads, shareId, etc.).
- Keep the API contract stable for the frontend to minimize breaking changes.
- Use the generated schema/types from InstantDB for type safety.

---

## 6. **Next Steps**
1. Implement `lib/instantdb.ts` with all CRUD logic.
2. Refactor API routes to use InstantDB.
3. Test all flows end-to-end.
4. Remove Redis and clean up.

---

**Migration can be done incrementally by first implementing InstantDB service and switching API endpoints one by one.** 