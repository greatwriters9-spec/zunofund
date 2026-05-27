"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  CANONICAL_INVESTMENT_PLANS,
  dailyCompoundLabel,
  displayPlanName,
  formatDepositRangeDescription,
} from "@/lib/investmentPlans";
import {
  EMPTY_PLATFORM_CONTACT,
  PLATFORM_CONTACT_ID,
  normalizePlatformContactRow,
  type PlatformContact,
} from "@/lib/platformContact";
import {
  normalizePlatformDepositNetworkRows,
  type PlatformDepositNetwork,
} from "@/lib/platformDepositNetworks";
import { normalizePlatformFaqRows, type PlatformFaq } from "@/lib/platformFaq";
import { useSupabase } from "@/lib/supabase";
import { AdminContactSettingsForm } from "@/components/admin/AdminContactSettingsForm";
import { AdminDepositNetworksForm } from "@/components/admin/AdminDepositNetworksForm";
import { AdminFaqSettingsForm } from "@/components/admin/AdminFaqSettingsForm";

function SettingsSection({
  title,
  description,
  tone = "default",
  children,
}: {
  title: string;
  description?: string;
  tone?: "default" | "gold" | "amber";
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const isAmber = tone === "amber";
  const isGold = tone === "gold";
  const sectionClass = isAmber
    ? "mb-6 rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] px-6 py-5"
    : isGold
      ? "mb-6 rounded-2xl border border-[#D4AF37]/25 bg-zinc-950 px-6 py-5"
      : "mb-6 rounded-2xl border border-zinc-800 bg-zinc-950 px-6 py-5";
  const titleClass = isAmber
    ? "text-lg font-semibold text-amber-300"
    : isGold
      ? "text-lg font-semibold text-[#F5E6B3]"
      : "text-lg font-semibold text-white";

  return (
    <section className={sectionClass}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-start justify-between gap-4 text-left"
      >
        <span className="min-w-0">
          <span className={titleClass}>{title}</span>
          {description ? (
            <span className="mt-1 block text-sm leading-relaxed text-zinc-400">
              {description}
            </span>
          ) : null}
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs font-semibold text-zinc-300">
          {open ? (
            <>
              <ChevronUp size={14} aria-hidden />
              Show less
            </>
          ) : (
            <>
              <ChevronDown size={14} aria-hidden />
              Show more
            </>
          )}
        </span>
      </button>
      {open ? <div className="mt-6">{children}</div> : null}
    </section>
  );
}

export default function AdminSettingsPage() {
  const supabase = useSupabase();
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [contact, setContact] = useState<PlatformContact>(EMPTY_PLATFORM_CONTACT);
  const [contactLoading, setContactLoading] = useState(true);
  const [faqs, setFaqs] = useState<PlatformFaq[]>([]);
  const [faqsLoading, setFaqsLoading] = useState(true);
  const [faqsError, setFaqsError] = useState<string | null>(null);
  const [depositNetworks, setDepositNetworks] = useState<PlatformDepositNetwork[]>([]);
  const [depositNetworksLoading, setDepositNetworksLoading] = useState(true);
  const [depositNetworksError, setDepositNetworksError] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSessionEmail(data.session?.user?.email ?? null);
    });
  }, [supabase.auth]);

  useEffect(() => {
    void supabase
      .from("platform_contact_settings")
      .select("support_email, support_phone, whatsapp, telegram, updated_at")
      .eq("id", PLATFORM_CONTACT_ID)
      .maybeSingle()
      .then(({ data }) => {
        setContact(normalizePlatformContactRow(data ?? undefined));
        setContactLoading(false);
      });
  }, [supabase]);

  useEffect(() => {
    void supabase
      .from("platform_faqs")
      .select("id, question, answer, sort_order, is_active, updated_at")
      .order("sort_order", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          setFaqsError(error.message);
        } else {
          setFaqsError(null);
        }
        setFaqs(normalizePlatformFaqRows(data));
        setFaqsLoading(false);
      });
  }, [supabase]);

  useEffect(() => {
    void supabase
      .from("platform_deposit_networks")
      .select("id, asset, network_name, network_label, wallet_address, sort_order, is_active, updated_at")
      .order("sort_order", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          setDepositNetworksError(error.message);
        } else {
          setDepositNetworksError(null);
        }
        setDepositNetworks(normalizePlatformDepositNetworkRows(data));
        setDepositNetworksLoading(false);
      });
  }, [supabase]);

  return (
    <div className="p-10 text-white min-h-screen max-w-4xl">
      <h1 className="text-3xl font-bold text-yellow-500 mb-2">Settings</h1>
      <p className="text-zinc-400 mb-10">
        Reference for how the platform is configured today and what admins can
        change from this dashboard.
      </p>

      <SettingsSection
        title="Platform contact information"
        description="Shown on the public contact page, investor dashboard support card, and transactional email footers."
        tone="gold"
      >
        {contactLoading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : (
          <AdminContactSettingsForm initial={contact} />
        )}
      </SettingsSection>

      <SettingsSection
        title="Contact page FAQs"
        description="Add, reorder, publish, or remove FAQ entries shown on the public contact page."
        tone="gold"
      >
        {faqsLoading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : faqsError ? (
          <p className="text-sm text-red-400" role="alert">
            Could not load FAQs: {faqsError}
          </p>
        ) : (
          <AdminFaqSettingsForm initial={faqs} onSaved={setFaqs} />
        )}
      </SettingsSection>

      <SettingsSection
        title="Deposit wallets & networks"
        description="Add or edit wallet addresses and blockchain networks shown on the exchange deposit page."
        tone="gold"
      >
        {depositNetworksLoading ? (
          <p className="text-sm text-zinc-500">Loading...</p>
        ) : depositNetworksError ? (
          <p className="text-sm text-red-400" role="alert">
            Could not load deposit networks: {depositNetworksError}
          </p>
        ) : (
          <AdminDepositNetworksForm
            initial={depositNetworks}
            onSaved={setDepositNetworks}
          />
        )}
      </SettingsSection>

      {sessionEmail ? (
        <SettingsSection title="Signed in">
          <p className="text-zinc-300 text-sm">
            {sessionEmail} — password and MFA are managed in Supabase Auth (see
            project dashboard → Authentication).
          </p>
        </SettingsSection>
      ) : null}

      <SettingsSection title="What admins can edit here">
        <ul className="list-disc list-inside text-zinc-300 text-sm space-y-2">
          <li>
            <strong>Contact information</strong> (email, phone, WhatsApp, Telegram) in the
            section above.
          </li>
          <li>
            <strong>Contact page FAQs</strong> in the section above.
          </li>
          <li>
            <strong>Deposit wallets & networks</strong> for USDT and Bitcoin in
            the section above.
          </li>
          <li>
            Investor <strong>tier / plan</strong> and{" "}
            <strong>automatic vs paused daily profit accrual</strong> (per
            investor) on the{" "}
            <Link href="/admin/investors" className="text-yellow-500 underline">
              Investors
            </Link>{" "}
            page. Manual profit entries use{" "}
            <Link href="/admin/profits" className="text-yellow-500 underline">
              Profits
            </Link>
            .
          </li>
          <li>
            <strong>Deposits & withdrawals</strong> approval queues on their
            respective pages—those actions run the audited server functions
            (deposit flow unchanged).
          </li>
        </ul>
      </SettingsSection>

      <SettingsSection
        title="Investment tiers (code + DB)"
        description="Daily percentages and USD principal brackets drive automatic tier and mirror lib/investmentPlans.ts."
      >
        <p className="text-zinc-400 text-sm leading-relaxed">
          Deposits enforce a global minimum ($20) only. Changing rates or
          brackets requires a migration or deploy.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border border-zinc-800 rounded-xl overflow-hidden">
            <thead className="bg-zinc-900 text-zinc-400">
              <tr>
                <th className="px-4 py-3 font-medium">Tier</th>
                <th className="px-4 py-3 font-medium">Principal bracket (USD)</th>
                <th className="px-4 py-3 font-medium">Daily compound</th>
              </tr>
            </thead>
            <tbody>
              {CANONICAL_INVESTMENT_PLANS.map((slug) => (
                <tr
                  key={slug}
                  className="border-t border-zinc-800 bg-black/40"
                >
                  <td className="px-4 py-3 text-white">
                    {displayPlanName(slug)}
                  </td>
                  <td className="px-4 py-3 text-zinc-300">
                    {formatDepositRangeDescription(slug)}
                  </td>
                  <td className="px-4 py-3 text-green-400/90">
                    {dailyCompoundLabel(slug)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SettingsSection>

      <SettingsSection title="Locks & withdrawals">
        <ul className="list-disc list-inside text-zinc-300 text-sm space-y-2">
          <li>
            Each <strong>approved deposit</strong> adds principal that stays{" "}
            <strong>locked for 30 days</strong>; after maturity it moves to{" "}
            <strong>withdrawable principal</strong> (profits sit in{" "}
            <strong>withdrawable profit</strong>). Withdrawals take profit
            first, then principal—principal withdrawals can lower tier.
          </li>
          <li>
            <strong>Daily automated profit</strong> uses the tier percentage on
            current <strong>balance</strong>, credits{" "}
            <strong>withdrawable profit</strong>, and runs at most about{" "}
            <strong>at most once per ~23 hours</strong> per investor (sliding
            window via{" "}
            <code className="text-yellow-400/90">last_compound_at</code>
            ). Vercel Cron hits{" "}
            <code className="text-yellow-400/90">/api/cron/run-daily-jobs</code>{" "}
            <strong>every hour</strong> so eligible accounts are not missed if
            one run fails. Turn auto accrual off per investor on the Investors
            page when crediting manually instead.
          </li>
        </ul>
      </SettingsSection>

      <SettingsSection title="Operations (must be scheduled)" tone="amber">
        <p className="text-zinc-300 text-sm leading-relaxed">
          Compounding and principal unlocks call{" "}
          <code className="text-yellow-400/90">run_daily_investment_jobs()</code>{" "}
          using the Supabase{" "}
          <code className="text-yellow-400/90">service_role</code> key. This
          repo can call it from{" "}
          <code className="text-yellow-400/90">/api/cron/run-daily-jobs</code>{" "}
          (see <code className="text-yellow-400/90">vercel.json</code>) with{" "}
          <code className="text-yellow-400/90">CRON_SECRET</code> and{" "}
          <code className="text-yellow-400/90">SUPABASE_SERVICE_ROLE_KEY</code>{" "}
          on Vercel, or schedule the same RPC from Supabase pg_cron or another
          runner.
        </p>
      </SettingsSection>

      <p className="text-zinc-500 text-xs">
        <Link href="/admin" className="text-yellow-500/80 underline">
          ← Back to admin dashboard
        </Link>
      </p>
    </div>
  );
}
