import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Skip TypeScript validation during build (saves RAM on small VPS).
  // Code is type-checked locally before push.
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
