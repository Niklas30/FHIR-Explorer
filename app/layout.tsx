import type { Metadata } from "next";
import "./globals.css";
import { FloatingLanguageSwitcher } from "@/components/i18n/FloatingLanguageSwitcher";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "FHIR Explorer",
  description: "FHIR Explorer projects, importer, and editor.",
  applicationName: "FHIR Explorer",
  icons: {
    icon: [{ url: "/favicon.ico" }],
    apple: [{ url: "/apple-icon.png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body className="antialiased">
        <I18nProvider>
          {children}
          <FloatingLanguageSwitcher />
          <Toaster />
        </I18nProvider>
      </body>
    </html>
  );
}
