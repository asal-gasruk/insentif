import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  experimental: {
    // Kurangi ukuran & churn HMR pada react-select
    optimizePackageImports: ["react-select"],
  },

  // Hindari cache webpack korup di dev (CSS/JS chunk 404)
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = false;
    }
    return config;
  },

  // Cegah browser menyimpan chunk _next stale saat HMR (penyebab "missing required error components")
  async headers() {
    if (!isDev) return [];
    return [
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate",
          },
        ],
      },
      {
        source: "/_next/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
