import { Suspense } from 'react';
import { ChatInterface } from "@/app/component/ChatInterface"; // Adjust path as needed

export default function Page() {
  // This page is now very simple, just renders the client component
  return (
    <Suspense fallback={<div>Loading...</div>}>
      {/* Render ChatInterface without props for a new chat */}
      <ChatInterface /> 
    </Suspense>
  );
}
