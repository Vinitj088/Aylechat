# Migrating from Neon.tech to Supabase

This document outlines the steps to migrate your ExaChat application from Neon.tech PostgreSQL database and NextAuth.js to Supabase with its built-in authentication system.

## Why Supabase?

Supabase offers several advantages over using Neon.tech + NextAuth:

1. **All-in-one platform**: Supabase combines database, authentication, storage, and more in a single platform.
2. **Built-in authentication**: No need for NextAuth.js, simplifying your authentication flow.
3. **Row Level Security (RLS)**: Built-in security at the database level.
4. **Real-time subscriptions**: Subscribe to database changes for real-time updates.
5. **Integrated storage**: Store and serve files with Supabase Storage.
6. **Edge functions**: Run serverless functions close to your users.

## Migration Steps

### 1. Set up a Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign up or sign in.
2. Create a new project and note your project's URL and API keys.
3. Run the SQL script in `supabase-schema.sql` in the Supabase SQL Editor to create the necessary tables and security policies.

### 2. Configure Environment Variables

Update your `.env` and `.env.local` files with the following Supabase variables:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 3. Migrate Users and Data

#### Option 1: Automatic Migration (Recommended)

Run the migration API endpoint to automatically migrate users and data:

```
POST /api/migration
```

⚠️ This endpoint should be secured or removed after migration!

#### Option 2: Manual Migration

1. Export users from your current database
2. Import users into Supabase using the Supabase Admin API
3. Export threads and messages data
4. Import data into Supabase

### 4. Update Application to Use Supabase

1. The main Supabase client is set up in `lib/supabase.ts`
2. The Supabase authentication context is in `context/SupabaseAuthContext.tsx`
3. Database utilities are in `lib/supabase-utils.ts`

### 5. Integrate Supabase Auth in Your App

Update your `app/layout.tsx` to use the Supabase Auth Provider:

```tsx
import { SupabaseAuthProvider } from '@/context/SupabaseAuthContext';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <SupabaseAuthProvider>
          {children}
        </SupabaseAuthProvider>
      </body>
    </html>
  );
}
```

Replace the existing NextAuth AuthDialog with the Supabase version:

```tsx
import SupabaseAuthDialog from './component/SupabaseAuthDialog';

// Replace
<AuthDialog 
  isOpen={showAuthDialog}
  onClose={() => setShowAuthDialog(false)}
  onSuccess={handleAuthSuccess}
/>

// With
<SupabaseAuthDialog 
  isOpen={showAuthDialog}
  onClose={() => setShowAuthDialog(false)}
  onSuccess={handleAuthSuccess}
/>
```

### 6. Update API Routes and Database Calls

Replace all NextAuth/Prisma/Kysely database calls with the Supabase client:

```tsx
// Before
const user = await prisma.user.findFirst({ where: { email } });

// After
const { data: user } = await supabase
  .from('profiles')
  .select('*')
  .eq('email', email)
  .single();
```

### 7. Testing

1. Test user authentication
2. Test data retrieval and storage
3. Test thread creation and message functionality

### 8. Clean Up

Once migration is complete and working properly:

1. Remove NextAuth dependencies
2. Remove Neon.tech configuration
3. Remove unused database code
4. Update environment variable templates

## Additional Supabase Features to Consider

- **Supabase Storage**: For storing files and images
- **Supabase Realtime**: For real-time chat updates
- **Edge Functions**: For serverless functionality
- **Supabase Auth UI**: Pre-built authentication UI components

## Need Help?

If you encounter any issues during migration, refer to:

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase JavaScript Client Reference](https://supabase.com/docs/reference/javascript/introduction)
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth) 