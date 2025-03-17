import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth-service';

export async function GET(req: NextRequest) {
  const user = await authService.getUser();
  if (!user) {
    return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start: (controller) => {
      // Send initial connection message
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'CONNECTED' })}\n\n`)
      );

      // Send heartbeat every 30 seconds to keep connection alive
      const heartbeatInterval = setInterval(() => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'HEARTBEAT' })}\n\n`)
        );
      }, 30000);

      // Clean up on connection close
      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeatInterval);
      });
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
} 