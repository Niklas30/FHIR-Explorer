import type { Metadata } from "next";
import "./globals.css";
import { FloatingLanguageSwitcher } from "@/components/i18n/FloatingLanguageSwitcher";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "FHIR-Explorer",
  description: "FHIR-Explorer for HL7 FHIR® projects, importing, and editing.",
  applicationName: "FHIR-Explorer",
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
      <body className="min-h-screen antialiased">
        <I18nProvider>
          {children}
          <footer className="px-4 pb-3 text-center text-[11px] text-muted-foreground/80">
            FHIR® is a registered trademark of Health Level Seven International (HL7). Use of this
            trademark does not constitute endorsement by HL7.
          </footer>
          <FloatingLanguageSwitcher />
          <Toaster />
        </I18nProvider>
      </body>
    </html>
  );
}
