import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["argon2", "pg", "pg-hstore", "sequelize", "umzug"],
  outputFileTracingIncludes: {
    "/*": [
      "./node_modules/argon2/**/*",
      "./node_modules/pg/**/*",
      "./node_modules/pg-hstore/**/*",
      "./node_modules/sequelize/**/*",
      "./node_modules/umzug/**/*",
    ],
  },
};

export default nextConfig;
