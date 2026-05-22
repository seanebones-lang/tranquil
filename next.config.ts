import type { NextConfig } from "next";

const config: NextConfig = {
  // Required for Railway / self-hosted: minimal runtime bundle + traced deps (see Railway Next.js guide).
  output: "standalone",
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb", // allow audio uploads in Phase 2
    },
  },
  // The Prisma client uses Node APIs; mark it external for the server bundle
  serverExternalPackages: ["@prisma/client"],
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        {
          key: "Referrer-Policy",
          value: "strict-origin-when-cross-origin",
        },
        {
          key: "Permissions-Policy",
          value: 'microphone=(self), camera=(), geolocation=()',
        },
      ],
    },
    {
      source: "/signin(.*)",
      headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
    },
    {
      source: "/signup(.*)",
      headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
    },
    {
      source: "/sign-in(.*)",
      headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
    },
    {
      source: "/sign-up(.*)",
      headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
    },
  ],
};

export default config;
