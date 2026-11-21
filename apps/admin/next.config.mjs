/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@bastiao/regras', '@bastiao/api-client'],
  // O navegador fala só com o painel; o painel repassa /api para a API. Sem CORS.
  async rewrites() {
    const api = process.env.API_URL ?? 'http://localhost:3000';
    return [{ source: '/api/:path*', destination: `${api}/:path*` }];
  },
};
export default nextConfig;
