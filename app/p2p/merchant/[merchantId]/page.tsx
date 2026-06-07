import { MerchantPublicProfileView } from "@/components/p2p/MerchantPublicProfileView";

type PageProps = {
  params: Promise<{ merchantId: string }>;
};

export default async function MerchantProfilePage({ params }: PageProps) {
  const { merchantId } = await params;

  return (
    <div className="min-w-0 px-4 py-6 sm:px-6 lg:px-8">
      <MerchantPublicProfileView merchantId={merchantId} />
    </div>
  );
}
