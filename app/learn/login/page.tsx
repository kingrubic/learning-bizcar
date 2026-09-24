import { LoginForm } from "@/components/learning/LoginForm";
import { getLocale } from "@/lib/locale";
import { messages } from "@/lib/i18n";
import { cmsBlock } from "@/lib/cms";

export default async function LoginPage() {
  const locale = await getLocale();
  const t = messages(locale);
  return <LoginForm locale={locale} story={await cmsBlock("login.story", locale, t.loginStory)} tagline={await cmsBlock("login.tagline", locale, t.tagline)} />;
}
