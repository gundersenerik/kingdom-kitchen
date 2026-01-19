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
        hostname: '**.arla.com',  // Arla CDN uses .com domain
      },
      {
        protocol: 'https',
        hostname: 'images.arla.com',  // Explicit Arla image CDN
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
