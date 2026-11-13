import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@salonbridge/ui', '@salonbridge/types'],
};

export default nextConfig;

