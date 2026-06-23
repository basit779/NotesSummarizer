// Security response headers applied to every route. CSP is intentionally
// omitted — a strict policy needs per-request nonces for Next's inline runtime
// scripts and would break the app; the headers below cover clickjacking, MIME
// sniffing, referrer leakage, HSTS, and feature access without that risk.
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // pdf-parse uses dynamic require; mark as external for server-side.
  serverExternalPackages: ['pdf-parse'],
  experimental: {
    // Allow body size up to 15MB for PDF uploads (Vercel's hard limit on Hobby is ~4.5MB)
    serverActions: { bodySizeLimit: '15mb' },
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};
export default nextConfig;
