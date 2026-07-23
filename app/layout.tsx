import type { Metadata } from "next";
import "./globals.css";
import { FloatingLanguageSwitcher } from "@/components/i18n/FloatingLanguageSwitcher";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { Toaster } from "@/components/ui/sonner";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: {
    default: site.name,
    template: `%s · ${site.name}`,
  },
  description: site.description,
  applicationName: site.name,
  metadataBase: new URL(site.url),
  keywords: [...site.keywords],
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [{ url: "/favicon.ico" }],
    apple: [{ url: "/apple-icon.png" }],
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    locale: site.locale,
    url: site.url,
    siteName: site.name,
    title: site.name,
    description: site.description,
    // og:image wird über die Datei-Konvention app/opengraph-image.tsx gesetzt.
  },
  twitter: {
    card: "summary_large_image",
    title: site.name,
    description: site.description,
    // twitter:image fällt automatisch auf opengraph-image.tsx zurück.
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: site.name,
  url: site.url,
  description: site.description,
  applicationCategory: "HealthApplication",
  operatingSystem: "Web",
  browserRequirements: "Requires JavaScript. Requires HTML5.",
  inLanguage: "de-DE",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "EUR",
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData),
          }}
        />
        <I18nProvider>
          {children}
          <FloatingLanguageSwitcher />
          <Toaster />
        </I18nProvider>
      </body>
    </html>
  );
}
