/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // Arla
      { protocol: 'https', hostname: '**.arla.se' },
      { protocol: 'https', hostname: '**.arla.com' },
      { protocol: 'https', hostname: 'images.arla.com' },
      // ICA
      { protocol: 'https', hostname: '**.ica.se' },
      { protocol: 'https', hostname: 'assets.icanet.se' },
      // Köket
      { protocol: 'https', hostname: '**.koket.se' },
      { protocol: 'https', hostname: 'img.koket.se' },
      // Tasteline
      { protocol: 'https', hostname: '**.tasteline.com' },
      { protocol: 'https', hostname: 'cdn.tasteline.com' },
      // Coop
      { protocol: 'https', hostname: '**.coop.se' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },  // Coop uses Cloudinary
      // Recept.se
      { protocol: 'https', hostname: 'recept.se' },
      { protocol: 'https', hostname: '**.recept.se' },
      // Godare
      { protocol: 'https', hostname: '**.godare.se' },
      // Common CDNs that recipe sites might use
      { protocol: 'https', hostname: '**.cloudinary.com' },
      { protocol: 'https', hostname: '**.imgix.net' },
      { protocol: 'https', hostname: '**.sanity.io' },
    ],
  },
};

module.exports = nextConfig;
