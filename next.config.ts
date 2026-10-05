import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @react-pdf/renderer ships Node-only code that must stay out of the bundler.
  serverExternalPackages: ["@react-pdf/renderer"],
  // PDF fonts are read from disk per request (same files feed next/font and
  // @react-pdf). Serverless functions only include traced files, so without
  // this the woff reads ENOENT in production and every print fails. The
  // letterhead artwork needs no entry — it is bundled as base64 instead.
  outputFileTracingIncludes: {
    "/api/documents/[id]/pdf": ["./src/assets/fonts/*.woff"],
  },
};

export default nextConfig;
