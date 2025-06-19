/** @type {import('next').NextConfig} */

const nextConfig = {
    experimental: {
      serverActions: {
        allowedOrigins: ["demo.exa.ai"],
        allowedForwardedHosts: ["demo.exa.ai"],
      },
      outputFileTracingIncludes: {
        "/api/pdf": ["./node_modules/@sparticuz/chromium/**"],
      },
      serverComponentsExternalPackages: ["@sparticuz/chromium"],
    },
    transpilePackages: ['@lobehub/icons'],
    webpack: (config, { isServer }) => {
      if (isServer) {
        config.externals = ["@sparticuz/chromium", ...config.externals]
      }
      return config
    },
  };
  
export default nextConfig;
