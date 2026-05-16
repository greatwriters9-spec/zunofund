-- Legacy BEFORE/AFTER triggers conflict with SECURITY DEFINER RPCs:
-- approve_deposit / approve_withdrawal already mutate investors + ledger.
-- Leaving update_balance_* triggers caused double-counting balances.

DROP TRIGGER IF EXISTS deposit_approved_trigger ON public.deposits;
DROP TRIGGER IF EXISTS withdrawal_approved_trigger ON public.withdrawals;
DROP TRIGGER IF EXISTS profit_added_trigger ON public.profits;
