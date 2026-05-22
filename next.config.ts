import type { NextConfig } from "next";

function supabasePublicStorageHost(): string | undefined {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return undefined;
  try {
    return new URL(raw).hostname;
  } catch {
    return undefined;
  }
}

const avatarHost = supabasePublicStorageHost();

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/",
        has: [{ type: "host", value: "zunofund.com" }],
        destination: "https://www.zunofund.com/",
        permanent: true,
      },
      {
        source: "/:path((?!api/cron).*)",
        has: [{ type: "host", value: "zunofund.com" }],
        destination: "https://www.zunofund.com/:path*",
        permanent: true,
      },
    ];
  },
  ...(avatarHost
    ? {
        images: {
          remotePatterns: [
            {
              protocol: "https",
              hostname: avatarHost,
              pathname: "/storage/v1/object/public/investor-avatars/**",
            },
          ],
        },
      }
    : {}),
};

export default nextConfig;
