"use client";

import Image from "next/image";
import { useState } from "react";

import { merchantInitials } from "@/components/p2p/utils";

type MerchantOfferAvatarProps = {
  avatarUrl: string | null | undefined;
  displayName: string | null | undefined;
  size?: "sm" | "md";
  className?: string;
};

const sizeClasses = {
  sm: "h-10 w-10 text-[11px]",
  md: "h-12 w-12 text-[12px]",
} as const;

/** Merchant profile photo from their linked investor account (`investors.avatar_url`). */
export function MerchantOfferAvatar({
  avatarUrl,
  displayName,
  size = "sm",
  className = "",
}: MerchantOfferAvatarProps) {
  const [broken, setBroken] = useState(false);
  const showImage = Boolean(avatarUrl?.trim()) && !broken;

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full bg-black/55 ring-1 ring-[#D4AF37]/55 ${sizeClasses[size]} ${className}`}
      aria-hidden
    >
      {showImage ? (
        <Image
          src={avatarUrl!}
          alt=""
          fill
          sizes={size === "md" ? "48px" : "40px"}
          className="object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center font-extrabold uppercase text-[#F5E6B3]">
          {merchantInitials(displayName)}
        </span>
      )}
    </div>
  );
}
