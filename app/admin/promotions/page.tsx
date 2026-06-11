"use client";

import { useCallback, useEffect, useState } from "react";

import { AdminAnnouncementsManager } from "@/components/admin/promotions/AdminAnnouncementsManager";
import { AdminInvestmentPlansManager } from "@/components/admin/promotions/AdminInvestmentPlansManager";
import { AdminPromotionSettingsForm } from "@/components/admin/promotions/AdminPromotionSettingsForm";
import { fetchPlatformConfig, notifyPlatformConfigChanged } from "@/lib/platformConfig";
import type {
  AnnouncementRow,
  InvestmentPlanRow,
  PromotionSettingsRow,
} from "@/lib/platformConfig/types";
import { formatSupabaseError, useSupabase } from "@/lib/supabase";

export default function AdminPromotionsPage() {
  const supabase = useSupabase();
  const [promotion, setPromotion] = useState<PromotionSettingsRow | null>(null);
  const [plans, setPlans] = useState<InvestmentPlanRow[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const config = await fetchPlatformConfig(supabase, {
      includeUnpublishedAnnouncements: true,
    });
    setPromotion(config.promotion);
    setPlans(config.plans);
    setAnnouncements(config.announcements);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  async function savePromotion() {
    if (!promotion) return;
    setSaving(true);
    setMessage(null);
    const { error } = await supabase
      .from("promotion_settings")
      .update({
        promotion_title: promotion.promotion_title,
        promotion_description: promotion.promotion_description,
        promotion_end_date: promotion.promotion_end_date,
        partner_fund_amount: promotion.partner_fund_amount,
        show_countdown: promotion.show_countdown,
        is_active: promotion.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", promotion.id);
    setSaving(false);
    setMessage(error ? formatSupabaseError(error) : "Promotion settings saved. Changes are live.");
    if (!error) {
      void load();
      notifyPlatformConfigChanged();
    }
  }

  async function savePlan(plan: InvestmentPlanRow) {
    setMessage(null);
    const { error } = await supabase
      .from("investment_plans")
      .update({
        name: plan.name,
        min_deposit: plan.min_deposit,
        max_deposit: plan.max_deposit,
        daily_roi: plan.daily_roi,
        promotion_return_target: plan.promotion_return_target,
        promotion_active: plan.promotion_active,
        sort_order: plan.sort_order,
        updated_at: new Date().toISOString(),
      })
      .eq("id", plan.id);
    setMessage(error ? formatSupabaseError(error) : `Plan "${plan.name}" saved. Changes are live.`);
    if (!error) {
      void load();
      notifyPlatformConfigChanged();
    }
  }

  async function createPlan(
    plan: Omit<InvestmentPlanRow, "id" | "created_at" | "updated_at">,
  ) {
    setMessage(null);
    const { error } = await supabase.from("investment_plans").insert(plan);
    setMessage(error ? formatSupabaseError(error) : `Plan "${plan.name}" created. Changes are live.`);
    if (!error) {
      void load();
      notifyPlatformConfigChanged();
    }
  }

  async function deletePlan(id: string) {
    setMessage(null);
    const { error } = await supabase.from("investment_plans").delete().eq("id", id);
    setMessage(error ? formatSupabaseError(error) : "Plan deleted. Changes are live.");
    if (!error) {
      void load();
      notifyPlatformConfigChanged();
    }
  }

  async function saveAnnouncement(row: AnnouncementRow) {
    setMessage(null);
    const { error } = await supabase
      .from("announcements")
      .update({
        title: row.title,
        content: row.content,
        category: row.category,
        featured: row.featured,
        published: row.published,
      })
      .eq("id", row.id);
    setMessage(error ? formatSupabaseError(error) : "Announcement saved. Changes are live.");
    if (!error) {
      void load();
      notifyPlatformConfigChanged();
    }
  }

  async function createAnnouncement(row: Omit<AnnouncementRow, "id" | "created_at">) {
    setMessage(null);
    const { error } = await supabase.from("announcements").insert(row);
    setMessage(error ? formatSupabaseError(error) : "Announcement created. Changes are live.");
    if (!error) {
      void load();
      notifyPlatformConfigChanged();
    }
  }

  async function deleteAnnouncement(id: string) {
    setMessage(null);
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    setMessage(error ? formatSupabaseError(error) : "Announcement deleted. Changes are live.");
    if (!error) {
      void load();
      notifyPlatformConfigChanged();
    }
  }

  if (loading) {
    return <p className="text-zinc-400">Loading promotion management…</p>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-[#F5E6B3]">Promotion Management</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Manage investment plans, promotion campaigns, and investor announcements from one place.
        </p>
      </header>

      {message ? (
        <p className="rounded-xl border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-4 py-3 text-sm text-[#F5E6B3]">
          {message}
        </p>
      ) : null}

      {promotion ? (
        <AdminPromotionSettingsForm
          settings={promotion}
          onChange={setPromotion}
          onSave={() => void savePromotion()}
          saving={saving}
        />
      ) : null}

      <AdminInvestmentPlansManager
        plans={plans}
        onSave={savePlan}
        onCreate={createPlan}
        onDelete={deletePlan}
      />

      <AdminAnnouncementsManager
        announcements={announcements}
        onSave={saveAnnouncement}
        onCreate={createAnnouncement}
        onDelete={deleteAnnouncement}
      />
    </div>
  );
}
