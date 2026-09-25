import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Keep native Node.js modules out of the webpack bundle.
   * pdf-parse, canvas, and pdfjs-dist run in the Node runtime only.
   */
  serverExternalPackages: ["pdfjs-dist", "canvas", "pdf-parse"],

  /** Remove the X-Powered-By header to reduce information exposure. */
  poweredByHeader: false,

  /** Enable brotli/gzip response compression for all routes. */
  compress: true,

  /**
   * Security and performance headers applied to every route.
   * Includes a strict Content-Security-Policy for XSS mitigation.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-DNS-Prefetch-Control", value: "on" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Clerk auth UI and Gemini API
              "connect-src 'self' https://clerk.murdock.app https://api.clerk.dev https://generativelanguage.googleapis.com",
              // Google Fonts
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              // Inline scripts required by Next.js hydration
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "img-src 'self' data: blob:",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },

  webpack: (config, { isServer }) => {
    if (isServer) {
      // canvas is an optional peer dep of pdfjs-dist; alias to false when not installed
      config.resolve = config.resolve ?? {};
      config.resolve.alias = config.resolve.alias ?? {};
      (config.resolve.alias as Record<string, string | false>)["canvas"] =
        false;
    }
    return config;
  },
};

export default nextConfig;
