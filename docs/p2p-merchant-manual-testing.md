# P2P merchant system — manual test matrix

Use after applying merchant P2P migrations and configuring cron (`/api/cron/run-p2p-expiry` + `CRON_SECRET` + service role).

## Preconditions

- Two investor accounts (A = buyer/seller, B unused or second browser).
- An **admin** registers existing investors as merchants under **`/admin/merchants`** (same email as their investor login — no separate merchant account). Users cannot self-register as merchants.
- Merchant creates at least one **sell USDT** offer (for “buy from merchant”) and one **buy USDT** offer (for “sell to merchant”), with overlapping limits and payment methods.
- **Buy USDT** listings: the merchant only picks **payment methods** (how they will pay fiat). They do **not** enter payout account details on the offer; the **investor** provides where to receive fiat when starting a sell trade.

## Concurrency / double finalize

| Case | Steps | Expected |
|------|--------|----------|
| Double release (buy flow) | Merchant opens two sessions on same `sell_usdt` order in `paid`; both click release | Second call fails (`FOR UPDATE` / invalid state); exactly one synthetic deposit and one `completed` order |
| Double release (sell / withdraw flow) | Investor opens two sessions on same `buy_usdt` order in `paid`; both click release USDT | Second call fails; merchant credited once |

## Sell-side (`buy_usdt` orders — investor sells USDT)

| Case | Steps | Expected |
|------|--------|----------|
| Happy path | Investor adds payout instructions → create order → merchant **Mark as paid** → investor **Release USDT** | A **`withdrawals`** row is inserted **`pending`** (P2P, tied to **`merchant_order_id`**), then **`approve_withdrawal_core`** runs **`apply_withdrawal_fifo_deduction`** when defer is **`true`** (new sell orders): investor **`balance` / withdrawable buckets** drop like an admin-approved wallet withdrawal, row becomes **`approved`**. **`tp_notify_withdrawal_approved`** (UPDATE trigger) fires in-app + email like other approvals. Merchant credited on their investor row; order **`completed`** |
| Legacy rows | Older `buy_usdt` orders with `defer_investor_deduction_until_release = false` (upfront escrow at order create, if any) | Release still completes and records **`withdrawals`**. Ledger always runs **`apply_withdrawal_fifo_deduction`** on approve; avoid re-testing stale rows that already deducted at create twice — use a **fresh** defer sell (`defer = true`, default for new sells) |
| Insufficient withdrawable | Investor with low withdrawable tries `investor_create_merchant_sell_order` above available | RPC error; no order row |
| Pending reservation | Two overlapping pending `buy_usdt` orders with defer | Second create respects reduced **available** withdrawable (sum of other defer orders in `pending_payment`/`paid`) |
| Missing payout instructions | Omit `p_investor_payout_instructions` on create | RPC error |
| Cancel defers | Create sell order (defer) → cancel while `pending_payment` | Order cancelled; **no** investor restore needed (nothing deducted yet) |
| Expiry defers | Create sell order (defer) → wait past `expires_at` → run `merchant_expire_stale_orders` | Order `cancelled`; investor unchanged |

## Buy-side credit (merchant release)

| Case | Steps | Expected |
|------|--------|----------|
| Happy path | Buy order → mark paid → merchant release | Investor `balance` and `locked_principal_balance` increase by `usdt_credit_amount`; `principal_locks` row exists with `deposit_id`; `merchant_orders.deposit_id` set; `deposits.skip_plan_amount_validation = true` |
| Tier / plan | Repeat with investor on a tier with high minimum deposit | Credit succeeds despite amount below normal deposit minimum |

## RLS

| Case | Steps | Expected |
|------|--------|----------|
| Merchant A vs B | As merchant A, query or act on merchant B’s order id via client | No row or RPC “not your order” |
| Stranger | Third user lists `merchant_orders` for others’ ids | No access |

## Trade chat (`merchant_order_messages`)

Requires migration **`20260624120000_merchant_order_trade_chat.sql`**.

| Case | Steps | Expected |
|------|--------|----------|
| Live sync | Open same `/p2p/order/<id>` as investor (session 1) and merchant (session 2); investor sends message | Merchant sees message without reload (Realtime); roles show as left/right correctly |
| After trade ends | Order `completed` or `cancelled` | History still visible; **send** blocked (insert policy) |

## Expiry (buy-side / fiat)

| Case | Steps | Expected |
|------|--------|----------|
| Pending payment timeout | `sell_usdt` order stays `pending_payment` past `expires_at`; run sweeper | Order `cancelled`; no deposit created |

## Cancellation rules

| Case | Steps | Expected |
|------|--------|----------|
| Merchant cancel sell after paid | `sell_usdt` in `paid` | Blocked (policy: contact support) |
| Merchant cancel buy escrow | `buy_usdt` `pending_payment`, legacy (`defer_investor_deduction_until_release = false`) | Allowed; escrow restored |
| Merchant cancel buy defer | `buy_usdt` `pending_payment`, defer | Allowed; no restore |
| Merchant cancel buy after marking paid | `buy_usdt` `paid` | Blocked — investor must release USDT or contact support |

## Helper smoke

- `select public.is_merchant('<active_merchant_user_id>');` → `true`
- `select public.is_merchant('<random_uuid>');` → `false`
