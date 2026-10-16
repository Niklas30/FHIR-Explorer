import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // @fhir-explorer/core ships TypeScript sources, so Next has to compile it.
  transpilePackages: ["@fhir-explorer/core", "@fhir-explorer/ui"],
  // The workspace root, not apps/web, is what standalone tracing has to walk.
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
};

export default nextConfig;
