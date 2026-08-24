/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: false },
  typescript: { ignoreBuildErrors: false },
  output: 'export',
  distDir: 'out',
  // static export – no api routes, fully client-side
};
module.exports = nextConfig;
