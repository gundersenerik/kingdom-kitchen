/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.arla.se',
      },
      {
        protocol: 'https',
        hostname: '**.koket.se',
      },
      {
        protocol: 'https',
        hostname: '**.ica.se',
      },
    ],
  },
};

module.exports = nextConfig;
