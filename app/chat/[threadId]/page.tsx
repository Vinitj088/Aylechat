import { Suspense } from 'react';
import { notFound, redirect } from 'next/navigation';
import { RedisService } from '@/lib/redis'; // Adjust path
import { ChatInterface } from '@/app/component/ChatInterface'; // Adjust path
import { createClient } from "@/utils/supabase/server"; // Adjust path

// Page is now an async Server Component
export default async function ChatThreadPage({ params }: { params: { threadId: string } }) {
  const threadId = params.threadId;

  // Server-side Data Fetching & Auth
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/?authRequired=true');
  }

  let thread;
  try {
    thread = await RedisService.getChatThread(user.id, threadId);
  } catch (redisError) {
    console.error(`Redis error fetching thread ${threadId}:`, redisError);
    notFound();
  }

  if (!thread) {
    console.warn(`Thread ${threadId} not found for user ${user.id}.`);
    notFound();
  }

  // Render Client Component with data
  return (
    <Suspense fallback={<div>Loading thread...</div>}>
      <ChatInterface id={thread.id} initialMessages={thread.messages} />
    </Suspense>
  );
} 