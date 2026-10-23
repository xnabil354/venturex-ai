import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "VENTUREX",
  applicationName: "VENTUREX",
  appleWebApp: { capable: true, title: "VENTUREX", statusBarStyle: "default" },
  icons: { apple: [{ url: "/notification-icon-192.png", sizes: "192x192", type: "image/png" }] },
  description: "Ruang kerja VENTUREX untuk membaca peluang bisnis F&B.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#421d24" };

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
