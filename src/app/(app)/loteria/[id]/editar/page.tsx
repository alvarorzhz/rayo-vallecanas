import { notFound } from "next/navigation";
import { requirePerm } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { CampaignForm } from "@/components/lottery/campaign-form";
import { updateCampaign } from "../../actions";
import type { Campaign } from "@/lib/types";

export const metadata = { title: "Editar campaña" };

export default async function EditCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePerm("lottery_admin", "update");
  const supabase = await createClient();
  const [{ data: campaign }, { count }] = await Promise.all([
    supabase.from("lottery_campaigns").select("*").eq("id", id).single<Campaign>(),
    supabase.from("lottery_sales").select("id", { count: "exact", head: true }).eq("campaign_id", id),
  ]);
  if (!campaign) notFound();
  return (
    <>
      <PageHeader title="Editar campaña" back={{ href: `/loteria/${id}`, label: campaign.name }} />
      <CampaignForm action={updateCampaign.bind(null, id)} campaign={campaign} hasSales={(count ?? 0) > 0} />
    </>
  );
}
