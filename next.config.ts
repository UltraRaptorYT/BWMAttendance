import type { NextConfig } from "next";

const nextConfig: NextConfig = process.env.VERCEL
  ? {}
  : { experimental: { cpus: 2 } };

export default nextConfig;
