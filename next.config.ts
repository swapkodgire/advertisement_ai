import type { NextConfig } from "next";
import path from "path";

const isGithubPages = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  ...(isGithubPages
    ? {
        output: "export" as const,
        basePath: "/advertisement_ai",
        assetPrefix: "/advertisement_ai",
        trailingSlash: true,
        images: { unoptimized: true },
        env: {
          NEXT_PUBLIC_STATIC_DEMO: "true",
        },
      }
    : {}),
  serverExternalPackages: ["@cursor/sdk", "@imgly/background-removal-node", "sharp"],
  outputFileTracingExcludes: {
    "*": ["./output/**/*", "./.photoshoot-output.json"],
  },
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
