import type { NextConfig } from "next";

const API_PROXY_TARGET = (process.env.API_PROXY_TARGET ?? "http://localhost:8080").replace(/\/$/, "");

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
