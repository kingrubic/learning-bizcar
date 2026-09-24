import { cookies } from "next/headers";
import { type Locale } from "./i18n";

export async function getLocale(): Promise<Locale> {
  const jar = await cookies();
  return jar.get("vabix_locale")?.value === "en" ? "en" : "vi";
}
