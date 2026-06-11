"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  canPerformAccountAction,
  isPathAllowedForAccountStatus,
  type AccountAction,
} from "@/lib/accountStatus/access";
import { fetchInvestorAccountSnapshot } from "@/lib/accountStatus/fetchInvestorAccountSnapshot";
import type { AccountStatus, AccountStatusSnapshot } from "@/lib/accountStatus/types";
import { useSupabase } from "@/lib/supabase";

type AccountStatusContextValue = {
  snapshot: AccountStatusSnapshot | null;
  status: AccountStatus;
  loading: boolean;
  refresh: () => Promise<void>;
  canPerform: (action: AccountAction) => boolean;
  isPathAllowed: (pathname: string) => boolean;
};

const DEFAULT_SNAPSHOT: AccountStatusSnapshot = {
  account_status: "active",
  status_reason: null,
  status_updated_at: null,
  balance: 0,
  withdrawable_balance: 0,
  withdrawal_eligible_at: null,
  full_name: "",
  email: "",
};

const AccountStatusContext = createContext<AccountStatusContextValue | null>(null);

export function AccountStatusProvider({ children }: { children: ReactNode }) {
  const supabase = useSupabase();
  const [snapshot, setSnapshot] = useState<AccountStatusSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) {
      setSnapshot(null);
      setLoading(false);
      return;
    }

    const next = await fetchInvestorAccountSnapshot(supabase, user.id);
    setSnapshot(next ?? DEFAULT_SNAPSHOT);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void refresh().then(() => {
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user?.id) return;

      channel = supabase
        .channel(`account-status-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "investors",
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            void refresh();
          },
        )
        .subscribe();
    });

    return () => {
      if (channel) void supabase.removeChannel(channel);
    };
  }, [supabase, refresh]);

  const status = snapshot?.account_status ?? "active";

  const value = useMemo<AccountStatusContextValue>(
    () => ({
      snapshot,
      status,
      loading,
      refresh,
      canPerform: (action) => canPerformAccountAction(status, action),
      isPathAllowed: (pathname) => isPathAllowedForAccountStatus(status, pathname),
    }),
    [snapshot, status, loading, refresh],
  );

  return (
    <AccountStatusContext.Provider value={value}>{children}</AccountStatusContext.Provider>
  );
}

export function useAccountStatus(): AccountStatusContextValue {
  const ctx = useContext(AccountStatusContext);
  if (!ctx) {
    return {
      snapshot: null,
      status: "active",
      loading: false,
      refresh: async () => {},
      canPerform: () => true,
      isPathAllowed: () => true,
    };
  }
  return ctx;
}
