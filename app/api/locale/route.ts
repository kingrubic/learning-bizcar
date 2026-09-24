import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json() as { locale?: string };
  const locale = body.locale === "en" ? "en" : "vi";
  const response = NextResponse.json({ locale });
  response.cookies.set("vabix_locale", locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  return response;
}
