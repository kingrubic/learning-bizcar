import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  typescript: { ignoreBuildErrors: false },
  experimental: {
    serverActions: { bodySizeLimit: "22mb" },
  },
  serverExternalPackages: ["mammoth", "unpdf"],
};

export default nextConfig;
