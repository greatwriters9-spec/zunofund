"use client";

import { useEffect, useState } from "react";

import { useSupabase } from "@/lib/supabase";

export function useAuthUser() {
  const supabase = useSupabase();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!cancelled) {
        setUserId(user?.id ?? null);
        setLoading(false);
      }
    }

    void loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
      setLoading(false);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [supabase]);

  return {
    userId,
    isAuthenticated: Boolean(userId),
    loading,
  };
}
