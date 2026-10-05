import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  typescript: { ignoreBuildErrors: false },
  experimental: {
    serverActions: { bodySizeLimit: "22mb" },
  },
  async redirects() {
    return [
      { source: "/learn/course/bmdo-k03/lesson/04/vrim", destination: "/learn/course/bmdo-k03/lesson/04", permanent: false },
      { source: "/learn/course/bmdo-k03/lesson/04/vrim/:path*", destination: "/learn/course/bmdo-k03/lesson/04", permanent: false },
    ];
  },
};

export default nextConfig;
