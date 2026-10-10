import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "VENTUREX",
  description: "Ruang kerja VENTUREX untuk membaca peluang bisnis F&B.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
