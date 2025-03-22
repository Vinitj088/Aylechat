/** @type {import('next').NextConfig} */

const nextConfig = {
    experimental: {
      serverActions: {
        allowedOrigins: ["demo.exa.ai"],
        allowedForwardedHosts: ["demo.exa.ai"],
      },
    },
    transpilePackages: ['@lobehub/icons'],
  };
  
export default nextConfig;
