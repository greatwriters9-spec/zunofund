"use client";

import { useEffect, useState } from "react";

import { RewardsCenterView } from "@/components/rewards/RewardsCenterView";
import { RewardsPublicView } from "@/components/rewards/RewardsPublicView";
import { useSupabase } from "@/lib/supabase";

export default function RewardsPage() {
  const supabase = useSupabase();
  const [hasUser, setHasUser] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (mounted) setHasUser(Boolean(user?.id));
    });
    return () => {
      mounted = false;
    };
  }, [supabase]);

  if (hasUser === null) {
    return <RewardsCenterView />;
  }

  if (hasUser) {
    return <RewardsCenterView />;
  }

  return <RewardsPublicView />;
}
