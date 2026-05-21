/** Shared P2P UI helpers — presentation only. */

import { P2P_PAYMENT_METHOD_OPTIONS } from "@/lib/p2pPaymentMethods";

export function merchantInitials(displayName: string | null | undefined): string {
  const s = (displayName ?? "M").trim();
  if (!s) return "M";
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  return s.slice(0, 2).toUpperCase();
}

export function formatHMS(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}`;
}

export function orderStatusHeadline(status: string): string {
  switch (status) {
    case "pending_payment":
      return "Trade started";
    case "paid":
      return "Payment marked — follow up";
    case "completed":
      return "Trade completed";
    case "cancelled":
      return "Trade cancelled";
    default:
      return status.replace(/_/g, " ");
  }
}

export function paymentMethodLabel(code: string): string {
  const opt = P2P_PAYMENT_METHOD_OPTIONS.find((o) => o.code === code);
  if (opt) return opt.label;
  return code.replace(/_/g, " ");
}

export function paymentMethodLabelCaps(code: string): string {
  return paymentMethodLabel(code).toUpperCase();
}

export function fmtUsdt(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "0.00";
  return n.toFixed(2);
}
