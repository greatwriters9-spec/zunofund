import {
  applyPlatformContactToBrand,
  getEmailBrandConfig,
  type EmailBrandConfig,
  type GetEmailBrandConfigOpts,
} from "@/lib/email/brand";
import { fetchPlatformContactServer } from "@/lib/platformContactServer";

export async function getEmailBrandWithPlatformContact(
  opts?: GetEmailBrandConfigOpts,
): Promise<EmailBrandConfig> {
  const base = getEmailBrandConfig(opts);
  const contact = await fetchPlatformContactServer();
  return applyPlatformContactToBrand(base, contact);
}
