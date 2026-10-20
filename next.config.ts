import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack(config, { dev }) {
    if (dev) {
      // The JSON "database" lives in ./data and is rewritten on every write
      // (e.g. an upvote). If the dev watcher sees those files it triggers a
      // rebuild on every request, which can clobber .next while pages are being
      // served. Data is only read via fs at runtime, never imported, so exclude it.
      config.watchOptions = {
        ...config.watchOptions,
        ignored: ["**/node_modules/**", "**/.git/**", "**/.next/**", "**/data/**"],
      };
    }
    return config;
  },
};

export default nextConfig;
