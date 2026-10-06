import type { NextConfig } from "next";

/**
 * The frontend is the subsystem's only public origin. /api/* and the three
 * SSO endpoints (auth-contract.md 5) go on to the NestJS backend, so the
 * callback registered in Core Hub (http://localhost:<frontend port>/auth/callback),
 * the state cookie of /auth/login and the HttpOnly session cookie all live on
 * the same origin as these pages. Same setup as the reference subsystem
 * (CSMJU2030/demo-student-subsystem, frontend/next.config.ts).
 */
const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:4212";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` },
      { source: "/auth/login", destination: `${BACKEND_URL}/auth/login` },
      { source: "/auth/callback", destination: `${BACKEND_URL}/auth/callback` },
      { source: "/auth/logout", destination: `${BACKEND_URL}/auth/logout` },
    ];
  },
};

export default nextConfig;
