import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Atestados e comprovantes são enviados junto do chamado.
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
