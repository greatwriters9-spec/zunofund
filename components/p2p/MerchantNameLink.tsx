"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { KeyboardEvent, MouseEvent, ReactNode } from "react";

type MerchantNameLinkProps = {
  merchantUserId: string;
  children: ReactNode;
  className?: string;
  title?: string;
  /** Use inside another link or button to avoid nested `<a>` hydration errors. */
  nested?: boolean;
};

export function MerchantNameLink({
  merchantUserId,
  children,
  className = "",
  title,
  nested = false,
}: MerchantNameLinkProps) {
  const router = useRouter();

  if (!merchantUserId?.trim()) {
    return <span className={className}>{children}</span>;
  }

  const href = `/p2p/merchant/${merchantUserId}`;
  const label = title ?? "View merchant profile";

  if (nested) {
    function goToProfile(ev: MouseEvent | KeyboardEvent) {
      ev.preventDefault();
      ev.stopPropagation();
      router.push(href);
    }

    return (
      <span
        role="link"
        tabIndex={0}
        title={label}
        className={`cursor-pointer transition hover:text-[#D4AF37] hover:underline ${className}`}
        onClick={goToProfile}
        onKeyDown={(ev) => {
          if (ev.key === "Enter" || ev.key === " ") goToProfile(ev);
        }}
      >
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className={`transition hover:text-[#D4AF37] hover:underline ${className}`}
      title={label}
    >
      {children}
    </Link>
  );
}
