import type { NextConfig } from "next";

import { execSync } from "child_process";

import packageJson from "./package.json";

// Priority order:
// 1. NEXT_PUBLIC_APP_VERSION from Docker build arg (set in Dockerfile)
// 2. Git describe for local development
// 3. package.json version as final fallback
let version = process.env.NEXT_PUBLIC_APP_VERSION || packageJson.version;

if (!process.env.NEXT_PUBLIC_APP_VERSION) {
  try {
    const gitVersion = execSync("git describe --tags").toString().trim();
    if (gitVersion) {
      version = gitVersion;
    }
  } catch (e) {
    // Git not available, use package.json version
  }
}

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: "standalone",
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
  },
};

export default nextConfig;
