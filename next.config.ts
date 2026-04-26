import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    turbopackUseSystemTlsCerts: true,
  },
};

export default nextConfig;
