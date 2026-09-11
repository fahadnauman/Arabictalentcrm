import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 16+ moved this out of experimental
  serverExternalPackages: ["pg", "@prisma/adapter-pg"],
  allowedDevOrigins: ["localhost:3000", "0.0.0.0:3000", "brown-parents-drum.loca.lt"],
  compress: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        // Long-term immutable caching for static public assets (fonts, images, media)
        source: "/:all*(svg|jpg|jpeg|png|gif|ico|webp|avif|woff2|woff|ttf|eot)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Next.js hashed build artifacts
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/logo.png",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
