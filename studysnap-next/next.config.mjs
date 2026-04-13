/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // pdf-parse uses dynamic require; mark as external for server-side.
  serverExternalPackages: ['pdf-parse'],
  experimental: {
    // Allow body size up to 15MB for PDF uploads (Vercel's hard limit on Hobby is ~4.5MB)
    serverActions: { bodySizeLimit: '15mb' },
  },
};
export default nextConfig;
