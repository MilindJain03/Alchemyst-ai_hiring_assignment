/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // Optimize images
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  // CORS headers - UPDATE the allowed origin for production
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: process.env.NODE_ENV === "production"
              ? "https://yourdomain.com"
              : "*",
          },
          { key: "Access-Control-Allow-Methods", value: "GET, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "*" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
        ],
      },
    ];
  },
};

export default nextConfig;
