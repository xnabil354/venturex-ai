import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permit the browser-visible hosts used for local development and the
  // temporary ngrok callback tunnel. Without these, Next's development
  // server blocks its HMR resources before React can hydrate the page.
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "riverboat-eternity-ramp.ngrok-free.dev",
  ],
  async headers() {
    return [{ source: "/notifications-sw.js", headers: [
      { key: "Content-Type", value: "application/javascript; charset=utf-8" },
      { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
      { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'; connect-src 'self'" },
    ] }];
  },
  ...(process.env.VENTUREX_E2E_PORT ? { distDir: ".next-e2e" } : {}),
  output: "standalone",
  serverExternalPackages: ["pdfkit", "exceljs", "argon2", "pg", "pg-hstore", "sequelize", "umzug"],
  outputFileTracingIncludes: {
    "/*": [
      "./src/reports/fonts/**/*",
      "./node_modules/pdfkit/**/*",
      "./node_modules/exceljs/**/*",
      "./node_modules/argon2/**/*",
      "./node_modules/pg/**/*",
      "./node_modules/pg-hstore/**/*",
      "./node_modules/sequelize/**/*",
      "./node_modules/umzug/**/*",
    ],
  },
};

export default nextConfig;
