# ExaChat - Supabase Integration

This project uses Supabase for authentication and PostgreSQL database access, while continuing to use Upstash Redis for chat thread storage.

## Project Structure

### Authentication
- Authentication is handled by Supabase Auth
- The authentication context is in `context/SupabaseAuthContext.tsx`
- The auth dialog component is in `app/component/SupabaseAuthDialog.tsx`

### Database Structure
- The database schema is defined in `supabase-schema.sql`
- Tables:
  - `profiles` - User profiles linked to Supabase Auth
  - `threads` - Chat threads (used for Supabase, but currently storing in Redis)
  - `thread_messages` - Messages within threads (used for Supabase, but currently storing in Redis)

### API Routes
- `/api/chat/threads` - CRUD operations for chat threads (using Redis)
- `/api/exaanswer` - Handles Exa API requests
- `/api/groq` - Handles Groq API requests

### State Management
- Upstash Redis is used for storing chat threads and messages
- Supabase is used for authentication and will be used for future features

## Environment Variables

The application requires these environment variables:

```
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Redis Configuration
UPSTASH_REDIS_REST_URL=your_upstash_redis_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_token

# API Keys
EXA_API_KEY=your_exa_api_key
GROQ_API_KEY=your_groq_api_key
```

## Future Improvements

1. Migrate data from Redis to Supabase for better integration
2. Implement real-time chat features using Supabase Realtime
3. Add Supabase Storage for file uploads and sharing

## Key Components

- `middleware.ts` - Handles authentication protection for routes
- `context/SupabaseAuthContext.tsx` - Provides authentication context
- `app/providers.tsx` - Wraps the application with necessary providers
- `lib/supabase.ts` - Initializes the Supabase client
- `lib/redis.ts` - Handles Redis operations for chat storage 