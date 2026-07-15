import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 上層資料夾另有專案的 lockfile，明確指定根目錄避免誤判
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
