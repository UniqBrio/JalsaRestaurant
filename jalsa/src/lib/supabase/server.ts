import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { publicConfig, serverConfig } from '@/lib/config';
import { logError } from '@/lib/logger';

/**
 * The ONE Supabase client the application reads and writes through (CP-4: one client, no
 * exceptions).
 *
 * WHY THERE IS NO BROWSER DATA CLIENT
 *   Every table carries row-level security with no permissive policy, so a browser holding the
 *   publishable key can read nothing at all. That is deliberate. A guest's phone is an
 *   untrusted device sitting on a table in a public room; if it could query PostgREST directly,
 *   then "which bills can this phone see" would be a policy question answered in SQL, separately
 *   from the same question answered in the UI - and the two would eventually disagree.
 *
 *   Instead the browser talks to this application's own route handlers, and those handlers hold
 *   the secret key. One enforcement point, in TypeScript, next to the permission matrix it
 *   enforces.
 *
 * WHY THE CLIENT IS LAZY
 *   Creating it at module scope would run serverConfig() during the build, and a build machine
 *   legitimately has no secrets. Failing at build time for a value only needed at request time
 *   turns a deployment misconfiguration into an unbuildable repository.
 */
let cached: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (cached) return cached;
  const cfg = serverConfig();
  cached = createClient(cfg.supabaseUrl, cfg.supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'x-application-name': 'jalsa' } },
  });
  return cached;
}

/**
 * True when the deployment has everything it needs to reach the database.
 *
 * This exists so a missing secret can be rendered as a DESIGNED screen naming the variable,
 * rather than as a stack trace. Standard 5.7: degrade honestly - say what is wrong and what
 * would fix it.
 */
export function isConfigured(): boolean {
  try {
    serverConfig();
    return true;
  } catch {
    return false;
  }
}

/** What the configuration screen tells the operator. Never guesses; reports what threw. */
export function configurationProblem(): string | null {
  try {
    serverConfig();
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Configuration could not be read.';
  }
}

/**
 * The restaurant this deployment serves.
 *
 * Multi-outlet is a roadmap item, so today there is exactly one row - but resolving it by slug
 * rather than assuming "the only row" means the day a second outlet appears, this function is
 * where the change lands instead of forty queries.
 */
let restaurantId: Promise<string> | null = null;

/*
 * The LOOKUP is what is remembered, not only its answer. A screen starts several reads at once,
 * and each asks for this id first; caching only the finished value let every one of them, on a
 * freshly started instance, send its own copy of the same query — a burst of duplicates in front
 * of the first real read (requests/2026-09-24-app-feels-slow-measure-first.md). A failed lookup is
 * forgotten, so the next request tries again rather than inheriting the failure.
 */
export function currentRestaurantId(): Promise<string> {
  restaurantId ??= lookUpRestaurantId().catch((err: unknown) => {
    restaurantId = null;
    throw err;
  });
  return restaurantId;
}

async function lookUpRestaurantId(): Promise<string> {
  const { data, error } = await db().from('restaurant').select('id').eq('slug', RESTAURANT_SLUG).single();
  if (error || !data) {
    throw new Error(
      `No restaurant with slug "${RESTAURANT_SLUG}". Run the migrations in supabase/migrations against ${publicConfig.supabaseUrl}.`
    );
  }
  return data.id as string;
}

export const RESTAURANT_SLUG = 'jalsa-hosur';

/**
 * Run a server-side read, and say plainly whether it worked.
 *
 * WHY THIS EXISTS AS A HELPER AND NOT AS A try/catch PER PAGE
 *   Every surface has exactly the same three outcomes at the top of its render — not configured,
 *   configured but unreachable, loaded — and only the third differs between them. Written out
 *   three times, the second one is the one that gets forgotten, and a forgotten unreachable
 *   branch is a Next.js error page in a guest's hand.
 *
 * WHY IT SWALLOWS THE ERROR FOR THE SCREEN BUT NOT FOR THE LOG
 *   The person reading the screen can do nothing with a stack trace; the operator reading the
 *   log can do nothing without one. So the throw is logged in full and the screen is given a
 *   single sentence — and, outside production, the message too, because in development the
 *   person on the screen IS the operator.
 */
export async function attempt<T>(context: string, run: () => Promise<T>): Promise<Attempt<T>> {
  try {
    return { ok: true, value: await run() };
  } catch (err) {
    logError(context, err);
    const detail = err instanceof Error ? err.message : String(err);
    return process.env.NODE_ENV === 'production' ? { ok: false } : { ok: false, detail };
  }
}

export type Attempt<T> = { ok: true; value: T } | { ok: false; detail?: string };
