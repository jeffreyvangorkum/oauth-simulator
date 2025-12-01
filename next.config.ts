import type { NextConfig } from "next";

import { execSync } from "child_process";

let version = "0.0.0";
try {
  version = execSync("git describe --tags").toString().trim();
} catch (e) {
  console.warn("Failed to fetch git tag version", e);
}

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: "standalone",
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
  },
};

export default nextConfig;
