"use client";

import { MerchantAppShell } from "@/components/merchant/MerchantAppShell";
import { MerchantOfferForm } from "@/components/merchant/MerchantOfferForm";

export default function MerchantNewOfferPage() {
  return (
    <MerchantAppShell
      heading="Publish listing"
      description="Form fields follow the merchant rail flow — segmented side, sideways numeric row, selectable payment chips, emerald submit."
    >
      <MerchantOfferForm mode="create" />
    </MerchantAppShell>
  );
}
