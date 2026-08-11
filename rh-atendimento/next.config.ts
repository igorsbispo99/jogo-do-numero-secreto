import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Os anexos vão direto do navegador para o Supabase, então pelo servidor
      // só trafega texto. Mantido folgado por causa de descrições longas.
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
