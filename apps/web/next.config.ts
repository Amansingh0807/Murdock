import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfjs-dist", "canvas", "pdf-parse"],
  webpack: (config, { isServer }) => {
    if (isServer) {
      // canvas is an optional peer dep of pdfjs-dist; ignore if not installed
      config.resolve = config.resolve ?? {};
      config.resolve.alias = config.resolve.alias ?? {};
      (config.resolve.alias as Record<string, string | false>)["canvas"] = false;
    }
    return config;
  },
};
export default nextConfig;
