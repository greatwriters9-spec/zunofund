export const ACCOUNT_STATUSES = ["active", "on_hold", "suspended", "banned"] as const;

export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export type AccountStatusSnapshot = {
  account_status: AccountStatus;
  status_reason: string | null;
  status_updated_at: string | null;
  balance: number;
  withdrawable_balance: number;
  withdrawal_eligible_at: string | null;
  full_name: string;
  email: string;
};

export type AccountStatusHistoryRow = {
  id: string;
  user_id: string;
  investor_id: string;
  old_status: string | null;
  new_status: string;
  reason: string | null;
  changed_by: string | null;
  created_at: string;
};
