import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { WorkspaceProvider } from "@/features/workspace/contexto";
import { Toaster } from "@/components/ui/sonner";
import { PwaRegistrar } from "@/components/pwa-registrar";
import "../styles.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "PH Outlet · Gestão das lojas",
  description: "Gestão das lojas PH Outlet e PH Outlet Kids.",
  applicationName: "PH Gestão",
  icons: { icon: "/favicon.png", apple: "/apple-touch-icon.png" },
  manifest: "/manifest.webmanifest",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "PH Gestão" },
  formatDetection: { telephone: false },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#101d3f",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=Manrope:wght@400;500;600;700&display=swap"
        />
      </head>
      <body>
        <PwaRegistrar />
        <WorkspaceProvider>
          {children}
          <Toaster position="top-center" richColors />
        </WorkspaceProvider>
      </body>
    </html>
  );
}
