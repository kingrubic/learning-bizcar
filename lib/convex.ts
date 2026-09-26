import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

function client() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;
  if (!url) throw new Error("Missing CONVEX_URL");
  return new ConvexHttpClient(url, {
    // userFlags is the same query body on every login. Next's patched fetch can
    // otherwise reuse mustChangePassword: 1 after the account has already cleared it.
    fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
  });
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
