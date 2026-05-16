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
