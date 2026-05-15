import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Skip TypeScript + ESLint during build to reduce memory on small VPS.
  // Code is type-checked locally before push.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
