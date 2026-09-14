import type { NextConfig } from "next";
const config: NextConfig = {
  devIndicators: false,
  async headers() {
    return [
      {
        source: "/og/home.jpg",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
    ];
  },
};
export default config;
