import type { NextConfig } from "next";
const config: NextConfig = {
  devIndicators: false,
  async headers() {
    return [
      {
        source: "/og/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
          { key: "Access-Control-Allow-Origin", value: "*" },
        ],
      },
    ];
  },
};
export default config;
