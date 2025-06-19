/** @type {import('next').NextConfig} */

const nextConfig = {
    eslint: {
      // Warning: This allows production builds to successfully complete even if
      // your project has ESLint errors.
      ignoreDuringBuilds: true,
    },
    typescript: {
      // !! WARN !!
      // Dangerously allow production builds to successfully complete even if
      // your project has type errors.
      // !! WARN !!
      ignoreBuildErrors: true,
    },
    experimental: {
      serverActions: {
        allowedOrigins: ["demo.exa.ai"],
        allowedForwardedHosts: ["demo.exa.ai"],
      },
      outputFileTracingIncludes: {
        "/api/pdf": ["./node_modules/@sparticuz/chromium-min/**"],
      },
      serverComponentsExternalPackages: ["@sparticuz/chromium-min"],
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
