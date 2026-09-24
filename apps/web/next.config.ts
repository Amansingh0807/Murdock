import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfjs-dist", "canvas", "pdf-parse"],
  poweredByHeader: false,
  compress: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
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
