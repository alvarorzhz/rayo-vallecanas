"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPush } from "@/lib/push";
import { buildPrompt, kindOf, newsSlug, readDraft, KIND_LABEL, NEWS_NAME, teaser } from "@/lib/news";
import { fetchMatchSheet, fetchPlayerFacts } from "@/lib/news-queries";

export type NewsState = { error?: string; ok?: string } | undefined;

function refresh(id?: string) {
  revalidatePath("/la-voz", "layout");
  if (id) revalidatePath(`/la-voz/${id}`);
  revalidatePath("/");
}

/** La portada solo puede ser una foto subida a la carpeta de La Voz del Rayo. */
function coverFrom(f: FormData): string | null {
  const url = String(f.get("cover_url") ?? "").trim();
  if (!url) return null;
  const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/news-photos/`;
  return url.startsWith(base) && url.length <= 500 ? url : null;
}

/** Avisa a todo el que puede leer La Voz del Rayo (menos a quien publica). Solo la primera vez. */
async function announce(id: string, by: string) {
  const admin = createAdminClient();
  const { data: a } = await admin.from("news_articles").select("id, kind, title, summary, body, status, notified_at").eq("id", id).maybeSingle();
  if (!a || a.status !== "published" || a.notified_at) return;
  // Se marca antes de mandar: si dos personas publican a la vez, solo sale un aviso
  const { data: claimed } = await admin.from("news_articles").update({ notified_at: new Date().toISOString() }).eq("id", id).is("notified_at", null).select("id");
  if (!claimed?.length) return;
  const { data: readers } = await admin.rpc("users_with_perm", { p_module: "news", p_action: "read" });
  const users = ((readers ?? []) as string[]).filter((u) => u !== by);
  await sendPush(users, {
    title: `🗞️ ${NEWS_NAME} · ${KIND_LABEL[a.kind as keyof typeof KIND_LABEL]}`,
    body: `${a.title}${a.summary || a.body ? ` · ${teaser(a, 110)}` : ""}`,
    url: `/la-voz/${id}`,
    tag: `la-voz-${id}`,
  });
}

/** Guarda la pieza. Con «publish», además la publica (y avisa al equipo la primera vez). */
export async function saveArticle(id: string | null, _: NewsState, f: FormData): Promise<NewsState> {
  const s = await getSession();
  if (!(s.can("news", "create") || (id && s.can("news", "update")))) return { error: "No tienes permiso para escribir en La Voz del Rayo" };
  const publish = f.get("intent") === "publish";
  const { draft, error } = readDraft(f, publish);
  if (!draft) return { error };
  const supabase = await createClient();
  const row = { ...draft, cover_url: coverFrom(f) };

  let aid = id;
  if (id) {
    const { data: old } = await supabase.from("news_articles").select("status, published_at").eq("id", id).maybeSingle();
    if (!old) return { error: "Esta pieza ya no existe" };
    const status = publish ? "published" : old.status;
    const { error: e } = await supabase.from("news_articles")
      .update({ ...row, status, published_at: status === "published" ? old.published_at ?? new Date().toISOString() : null }).eq("id", id);
    if (e) return { error: "No se pudo guardar. ¿Tienes permiso para editar esta pieza?" };
  } else {
    const { data, error: e } = await supabase.from("news_articles")
      .insert({ ...row, status: publish ? "published" : "draft", published_at: publish ? new Date().toISOString() : null, created_by: s.user.id })
      .select("id").single();
    if (e || !data) return { error: "No se pudo guardar la pieza" };
    aid = data.id as string;
  }
  if (publish && f.get("notify") === "on") await announce(aid!, s.user.id);
  refresh(aid!);
  redirect(publish ? `/la-voz/${aid}?publicada=1` : `/la-voz/${aid}/editar?guardada=1`);
}

/** Vuelve a borrador una pieza publicada (deja de verse en la portada). */
export async function unpublishArticle(id: string): Promise<NewsState> {
  const s = await getSession();
  if (!s.can("news", "update")) return { error: "No tienes permiso para retirar piezas" };
  const supabase = await createClient();
  const { error } = await supabase.from("news_articles").update({ status: "draft", published_at: null }).eq("id", id);
  if (error) return { error: "No se pudo retirar" };
  refresh(id);
  redirect(`/la-voz/${id}/editar?retirada=1`);
}

export async function deleteArticle(id: string): Promise<NewsState> {
  await getSession();
  const supabase = await createClient();
  const { data: a } = await supabase.from("news_articles").select("cover_url").eq("id", id).maybeSingle();
  const { data, error } = await supabase.from("news_articles").delete().eq("id", id).select("id");
  if (error || !data?.length) return { error: "No se pudo eliminar. ¿Tienes permiso?" };
  const path = a?.cover_url?.split("/news-photos/")[1];
  if (path) await supabase.storage.from("news-photos").remove([decodeURIComponent(path)]);
  refresh();
  redirect("/la-voz?eliminada=1");
}

/** Prompt para copiar en una IA con los datos de la app y las notas de quien escribe. */
export async function promptFor(input: { kind: string; matchId?: string | null; playerId?: string | null; notes?: string | null }): Promise<{ prompt?: string; error?: string }> {
  const s = await getSession();
  if (!s.can("news", "create") && !s.can("news", "update")) return { error: "No tienes permiso" };
  const kind = kindOf(input.kind);
  if (!kind) return { error: "Elige el tipo de pieza" };
  const supabase = await createClient();
  const sheet = (kind === "cronica" || kind === "previa") && input.matchId ? await fetchMatchSheet(supabase, input.matchId) : null;
  if ((kind === "cronica" || kind === "previa") && !sheet) return { error: "Elige primero el partido" };
  if (kind === "cronica" && sheet && !sheet.facts.played) return { error: "Ese partido aún no tiene resultado: para antes del partido, elige «Previa»" };
  const player = kind === "entrevista" && input.playerId ? await fetchPlayerFacts(supabase, input.playerId) : null;
  if (kind === "entrevista" && !player) return { error: "Elige primero al jugador" };
  return { prompt: buildPrompt({ kind, match: sheet?.facts, player, notes: input.notes?.slice(0, 3000) }) };
}

/** Enciende o apaga la página pública de una pieza publicada. Solo superadministradores (la base de datos lo vuelve a comprobar). */
export async function setNewsPublic(id: string, on: boolean): Promise<NewsState & { slug?: string | null }> {
  const s = await getSession();
  if (s.profile.role !== "superadmin") return { error: "Solo un superadministrador puede hacer pública una noticia" };
  const supabase = await createClient();
  const { data: a } = await supabase.from("news_articles").select("title, status, public_slug").eq("id", id).maybeSingle();
  if (!a) return { error: "Esta pieza ya no existe" };
  if (on && a.status !== "published") return { error: "Primero hay que publicarla" };
  let slug = a.public_slug as string | null;
  if (on && !slug) {
    // El enlace sale del titular y no cambia nunca (aunque luego se cambie el titular)
    for (let i = 0; i < 4 && !slug; i++) {
      const candidate = newsSlug(a.title, crypto.randomUUID().slice(0, 4));
      const { count } = await supabase.from("news_articles").select("id", { count: "exact", head: true }).eq("public_slug", candidate);
      if (!count) slug = candidate;
    }
    if (!slug) return { error: "No se pudo crear el enlace. Prueba otra vez." };
  }
  const { error } = await supabase.from("news_articles").update(on ? { is_public: true, public_slug: slug } : { is_public: false }).eq("id", id);
  if (error) return { error: "No se pudo cambiar. ¿Eres superadministrador?" };
  refresh(id);
  revalidatePath("/noticias", "layout");
  return { ok: on ? "Hecha pública. Ya puedes compartir el enlace." : "Ya no es pública: el enlace deja de funcionar.", slug };
}
