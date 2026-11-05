import { requirePerm } from "@/lib/session";
import { PageHeader } from "@/components/ui";
import { CampaignForm } from "@/components/lottery/campaign-form";
import { createCampaign } from "../actions";

export const metadata = { title: "Nueva campaña" };

export default async function NewCampaignPage() {
  await requirePerm("lottery_admin", "create");
  return (
    <>
      <PageHeader title="Nueva campaña" subtitle="Se crea en borrador. Actívala cuando esté lista para vender." back={{ href: "/loteria", label: "Sorteos" }} />
      <CampaignForm action={createCampaign} />
    </>
  );
}
