import type { Metadata } from "next";
import "./globals.css";
import "./brand.css";
import Link from "next/link";
import { BrandLogo } from "@fhir-explorer/ui/brand/BrandMark";
import { FloatingLanguageSwitcher } from "@/components/i18n/FloatingLanguageSwitcher";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { TerminologyBridge } from "@/components/terminology/TerminologyBridge";
import { Toaster } from "@fhir-explorer/ui/ui/sonner";

export const metadata: Metadata = {
  title: "FHIR-Explorer",
  description: "FHIR-Explorer for HL7 FHIR® projects, importing, and editing.",
  applicationName: "FHIR-Explorer",
  icons: {
    icon: [{ url: "/brand/icon.svg", type: "image/svg+xml" }, { url: "/favicon.ico", sizes: "16x16 32x32 48x48 256x256" }],
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
          <TerminologyBridge>
            <header className="border-b border-foreground/10 bg-background">
              <div className="mx-auto flex h-16 w-full max-w-6xl items-center px-4">
                <Link href="/" className="rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D8452B]"><BrandLogo /></Link>
              </div>
            </header>
            {children}
            <footer className="px-4 pb-3 text-center text-[11px] text-muted-foreground/80">
              FHIR® is a registered trademark of Health Level Seven International (HL7). Use of this
              trademark does not constitute endorsement by HL7.
            </footer>
            <FloatingLanguageSwitcher />
            <Toaster />
          </TerminologyBridge>
        </I18nProvider>
      </body>
    </html>
  );
}
