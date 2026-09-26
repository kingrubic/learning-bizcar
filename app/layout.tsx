import type { Metadata } from "next";
import localFont from "next/font/local";
import { AppLoader } from "@/components/brand/AppLoader";
import { getLocale } from "@/lib/locale";
import "./globals.css";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const montserrat = localFont({
  src: [
    { path: "../fonts/Montserrat-Medium.ttf", weight: "500", style: "normal" },
    { path: "../fonts/Montserrat-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "../fonts/Montserrat-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-heading",
  display: "swap",
});

const pantone = localFont({
  src: [
    { path: "../fonts/SVN-Panton-Regular.otf", weight: "400", style: "normal" },
    { path: "../fonts/SVN-Panton-Italic.otf", weight: "400", style: "italic" },
    { path: "../fonts/SVN-Panton-SemiBold.otf", weight: "600", style: "normal" },
    { path: "../fonts/SVN-Panton-Bold.otf", weight: "700", style: "normal" },
  ],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "VABIX BizCar Learning System",
  description: "Executive learning lab cho chương trình BMDO BizCar của VABIX.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${montserrat.variable} ${pantone.variable}`}>
      <body>
        <AppLoader />
        {children}
      </body>
    </html>
  );
}
