import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

// sessionUser / userFlags keep the same POST body after a password change (token and
// user id do not change). Next's data cache keys that body, so cache: "no-store" on a
// wrapper alone still replayed mustChangePassword: 1. A new header misses that entry.
let fresh = 0;

type CacheClient = ConvexHttpClient & {
  setFetchOptions(options: { cache: "force-cache" | "no-store" }): void;
};

function client() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;
  if (!url) throw new Error("Missing CONVEX_URL");
  const convex = new ConvexHttpClient(url, {
    fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      headers.set("x-bizcar-fresh", String(++fresh));
      return fetch(input, { ...init, headers, cache: "no-store" });
    },
  });
  (convex as CacheClient).setFetchOptions({ cache: "no-store" });
  return convex;
}

export function appSecret() {
  const value = process.env.APP_SECRET;
  if (!value) throw new Error("Missing APP_SECRET");
  return value;
}

let ready: Promise<void> | null = null;

export function ensureCatalog() {
  if (!ready) {
    ready = client().mutation(api.seed.ensureCatalog, { secret: appSecret() }).then(() => undefined).catch((error) => {
      ready = null;
      throw error;
    });
  }
  return ready;
}

export async function q<T>(run: (convex: ConvexHttpClient, secret: string) => Promise<T>) {
  await ensureCatalog();
  return run(client(), appSecret());
}

export { api };
