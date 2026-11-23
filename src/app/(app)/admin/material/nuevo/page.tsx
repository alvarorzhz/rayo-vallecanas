import { requirePerm } from "@/lib/session";
import { PageHeader } from "@/components/ui";
import { ItemForm } from "@/components/material/forms";
import { saveItem } from "../actions";

export const metadata = { title: "Nuevo artículo" };

export default async function NewMaterialItemPage() {
  await requirePerm("material", "create");
  return (
    <>
      <PageHeader title="Nuevo artículo" subtitle="Después podrás añadir sus piezas con talla, dorsal y quién las tiene." back={{ href: "/admin/material", label: "Material" }} />
      <section className="card"><ItemForm action={saveItem.bind(null, null)} /></section>
    </>
  );
}
