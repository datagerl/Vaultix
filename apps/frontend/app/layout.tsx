import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "@/components/Providers";
import Navbar from "@/components/layout/Navbar";
import MobileNav from "@/components/layout/MobileNav";
import { headers } from "next/headers";
import { themeInitScript } from "@/lib/theme";

export const metadata: Metadata = {
  title: "Vaultix - Secure Escrow Platform",
  description: "Decentralized escrow platform built on Stellar blockchain",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Check headers to conditionally handle mobile nav on landing or public routes
  const headersList = await headers();
  const pathname = headersList.get("x-invoke-path") || "";
  const isLandingPage = pathname === "/" || pathname === "/landing";

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Applies the saved theme before first paint to avoid a flash of the wrong theme. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="antialiased overflow-x-hidden">
        <Providers>
          <Navbar />
          <main className={`pt-16 min-w-0 overflow-x-hidden ${!isLandingPage ? 'pb-20 md:pb-0' : ''}`}>
            {children}
          </main>
          {!isLandingPage && <MobileNav />}
        </Providers>
      </body>
    </html>
  );
}
