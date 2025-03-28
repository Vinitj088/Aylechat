  import { createServerClient } from '@supabase/ssr';
  import { cookies } from 'next/headers';

  export function createClient() {
    const cookieStore = cookies();

    return createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          async get(name: string) {
            return (await cookieStore).get(name)?.value;
          },
          async set(name: string, value: string, options: any) {
            try {
              (await cookieStore).set(name, value, options);
            } catch (error) {
              // The `set` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
          async remove(name: string, options: any) {
            try {
              (await cookieStore).set(name, '', { ...options, maxAge: 0 });
            } catch (error) {
              // The `delete` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    );
  } 