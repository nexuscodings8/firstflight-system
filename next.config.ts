import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pages read live database data and the session on every request, so Cache Components is off
  // and pages render dynamically (see app/layout.tsx).
  cacheComponents: false,
  experimental: {
    serverActions: { bodySizeLimit: "12mb" }, // document uploads (10 MB max per file, checked in code)
  },
  turbopack: {
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
};

export default nextConfig;
