import { requirePerm } from "@/lib/session";
import { PageHeader } from "@/components/ui";
import { SponsorForm } from "@/components/sponsors/forms";
import { saveSponsor } from "../actions";

export const metadata = { title: "Nuevo patrocinador" };

export default async function NewSponsorPage() {
  await requirePerm("sponsors", "create");
  return (
    <>
      <PageHeader title="Nuevo patrocinador" subtitle="Después podrás añadirle el acuerdo de la temporada." back={{ href: "/admin/patrocinadores", label: "Patrocinadores" }} />
      <section className="card"><SponsorForm action={saveSponsor.bind(null, null)} /></section>
    </>
  );
}
