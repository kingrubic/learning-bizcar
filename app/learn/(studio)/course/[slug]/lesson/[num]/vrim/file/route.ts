import fs from "fs";
import path from "path";
import { requireVrim } from "@/lib/vrim-open";
import { VRIM } from "@/lib/vrim-studio";

export async function GET(_request: Request, context: { params: Promise<{ slug: string; num: string }> }) {
  const { slug, num } = await context.params;
  await requireVrim(slug, num);
  const html = fs.readFileSync(path.join(process.cwd(), VRIM.htmlPath));
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "Content-Security-Policy": "frame-ancestors 'self'",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export const dynamic = "force-dynamic";
