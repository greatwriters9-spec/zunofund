import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  EMPTY_PLATFORM_CONTACT,
  PLATFORM_CONTACT_ID,
  normalizePlatformContactRow,
  type PlatformContact,
} from "@/lib/platformContact";

let serverCache: PlatformContact | null = null;
let serverCacheAt = 0;
const SERVER_CACHE_MS = 60_000;

export async function fetchPlatformContactServer(): Promise<PlatformContact> {
  const now = Date.now();
  if (serverCache && now - serverCacheAt < SERVER_CACHE_MS) {
    return serverCache;
  }

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("platform_contact_settings")
      .select("support_email, support_phone, whatsapp, telegram, updated_at")
      .eq("id", PLATFORM_CONTACT_ID)
      .maybeSingle();

    const next = error
      ? { ...EMPTY_PLATFORM_CONTACT }
      : normalizePlatformContactRow(data ?? undefined);

    serverCache = next;
    serverCacheAt = now;
    return next;
  } catch {
    return { ...EMPTY_PLATFORM_CONTACT };
  }
}
