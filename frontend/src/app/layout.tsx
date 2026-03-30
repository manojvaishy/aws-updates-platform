import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AWS Updates Platform",
  description: "Personalized AWS updates — simplified, translated, and role-filtered for you.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  // Mobile-first viewport config
  width: "device-width",
  initialScale: 1,
  maximumScale: 1, // Prevent unwanted zoom on input focus (mobile)
  themeColor: "#232F3E",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
