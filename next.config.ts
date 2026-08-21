import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 16+ moved this out of experimental
  serverExternalPackages: ["pg", "@prisma/adapter-pg"],
  allowedDevOrigins: ["localhost:3000", "0.0.0.0:3000", "brown-parents-drum.loca.lt"],
};

export default nextConfig;
