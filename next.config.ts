import type { NextConfig } from "next";

const API_PROXY_TARGET = (process.env.API_PROXY_TARGET ?? "http://127.0.0.1:4006").replace(/\/$/, "");

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_PROXY_TARGET}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
