import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'gateway.irys.xyz', pathname: '/**' },
      { protocol: 'https', hostname: '**', pathname: '/**' },
      { protocol: 'http', hostname: '**', pathname: '/**' },
    ],
  },
    turbopack: {
      resolveAlias: {},
      rules: {
        ignore: [
          "metaplex/**/test-ledger/**",
          "prebuilt-programs/**/test-ledger/**",
          "**/snapshot/**"
        ]
      }
    }
}

export default nextConfig
