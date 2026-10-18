import type { NextConfig } from 'next';

const config: NextConfig = {
  // Dev only. Two browser profiles sharing one origin also share localStorage,
  // so testing two players on one machine means loading the second from a
  // different host — which the dev server otherwise refuses.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  // The workspace packages ship TypeScript source rather than a build step, so
  // Next compiles them alongside the app. One fewer build to keep in sync, and
  // the same source is what the tests run against.
  transpilePackages: ['@pb/engine', '@pb/protocol', '@pb/client', '@pb/ai', '@pb/moments'],
};

export default config;
