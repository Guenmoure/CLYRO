/** @type {import('next').NextConfig} */
const nextConfig = {
  // Transpile workspace packages (including Remotion which ships as ESM)
  transpilePackages: ['@clyro/shared', '@clyro/video', 'remotion', '@remotion/player'],

  // Security headers (CSP is managed in vercel.json to avoid duplicate headers)
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
        ],
      },
    ]
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'fal.media',
      },
    ],
  },
}

export default nextConfig
