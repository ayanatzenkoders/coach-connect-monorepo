import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV === 'development';

const nextConfig: NextConfig = {
  // PRODUCTION: build plain static files (HTML/CSS/JS). The NestJS backend serves them from the
  // same address as the API, so the browser keeps its secure cookie and needs no extra server.
  ...(isDev ? {} : { output: 'export' as const }),

  // DEVELOPMENT ONLY: the browser asks this app (port 3001) for /api/*, and Next forwards it to the
  // backend (port 3000). To the browser it is ONE address, which is what the cookie login needs.
  // (Rewrites are not allowed in a static export, hence the condition.)
  ...(isDev
    ? {
        async rewrites() {
          return [{ source: '/api/:path*', destination: `${process.env.BACKEND_URL ?? 'http://localhost:3000'}/:path*` }];
        },
      }
    : {}),
};

export default nextConfig;
