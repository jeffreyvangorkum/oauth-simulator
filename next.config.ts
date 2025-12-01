import type { NextConfig } from "next";

import { execSync } from "child_process";

import packageJson from "./package.json";

let version = packageJson.version;
try {
  const gitVersion = execSync("git describe --tags").toString().trim();
  if (gitVersion) {
    version = gitVersion;
  }
} catch (e) {
  // console.warn("Failed to fetch git tag version", e);
}

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: "standalone",
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
  },
};

export default nextConfig;
