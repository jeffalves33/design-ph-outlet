import type { NextConfig } from "next";

const config: NextConfig = {
  agentRules: false,
  poweredByHeader: false,
  // Separate from any older local Next process owned by the user.
  distDir: ".next-p1",
};

export default config;
