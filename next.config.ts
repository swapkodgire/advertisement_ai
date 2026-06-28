import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@cursor/sdk", "@imgly/background-removal-node"],
};

export default nextConfig;
