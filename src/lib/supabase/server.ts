import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? { url, key } : null;
}

export function isSupabaseAuthConfigured() {
  return Boolean(config());
}

export async function createClient() {
  const values = config();
  if (!values) throw new Error("Supabase Auth is not configured. Add the project URL and publishable key.");
  const cookieStore = await cookies();

  return createServerClient(values.url, values.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot set cookies; proxy.ts refreshes sessions for requests.
        }
      },
    },
  });
}
