import { NextResponse } from "next/server";

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type Body = {
  investorId?: string;
  withdrawalEligibleAt?: string | null;
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const investorId = String(body.investorId ?? "").trim();
  if (!investorId) {
    return NextResponse.json({ error: "investorId is required" }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: adminRow } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!adminRow) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let withdrawalEligibleAt: string | null = null;
  if (body.withdrawalEligibleAt != null && String(body.withdrawalEligibleAt).trim() !== "") {
    const parsed = new Date(body.withdrawalEligibleAt);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: "Invalid withdrawalEligibleAt" }, { status: 400 });
    }
    withdrawalEligibleAt = parsed.toISOString();
  }

  const service = createServiceRoleClient();
  const { data, error } = await service
    .from("investors")
    .update({ withdrawal_eligible_at: withdrawalEligibleAt })
    .eq("id", investorId)
    .select("id, withdrawal_eligible_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!data) {
    return NextResponse.json({ error: "Investor not found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    investorId: data.id,
    withdrawal_eligible_at: data.withdrawal_eligible_at,
  });
}
