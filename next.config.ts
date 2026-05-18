import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb", // allow audio uploads in Phase 2
    },
  },
  // The Prisma client uses Node APIs; mark it external for the server bundle
  serverExternalPackages: ["@prisma/client", "bcrypt"],
};

export default config;
