import type { NextConfig } from "next";
const config: NextConfig = {
  devIndicators: false,
  async headers() {
    return [
      {
        source: "/og/ds-home-:hash.jpg",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Content-Disposition",
            value: 'inline; filename="drawstacks.jpg"',
          },
        ],
      },
      {
        source: "/og/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400",
          },
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};
export default config;
