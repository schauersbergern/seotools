import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SEO Workbench",
  description: "Ahrefs- und Semrush-aehnliches SEO-Dashboard auf Basis der DataForSEO API"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
