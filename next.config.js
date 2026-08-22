/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  outputFileTracing: false,
  output: 'export',
  distDir: 'out',
  // static export – no api routes, fully client-side
};
module.exports = nextConfig;
