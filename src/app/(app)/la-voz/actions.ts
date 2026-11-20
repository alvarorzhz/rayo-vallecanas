"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPush } from "@/lib/push";
import { buildPrompt, buildQuestionsPrompt, interviewNotes, interviewToBody, kindOf, mergeAnswers, newsSlug, parseAiReply, parseQuestions, readDraft, readQuestions, KIND_LABEL, NEWS_NAME, teaser, type InterviewQA, type SponsorFacts } from "@/lib/news";
import { fetchInterview, fetchInterviewById, fetchMatchSheet, fetchPlayerFacts, sponsorCards } from "@/lib/news-queries";
import { askGemini, speakWithGemini } from "@/lib/gemini";
import { buildPressPrompt, parsePress, PRESS_MAX, pressCues, rateOf, speechScript, wavFile } from "@/lib/president";
import { shirtName } from "@/lib/squad";
import { REACTIONS, type Reaction } from "@/lib/news";

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
  const sendInterview = f.get("intent") === "interview";
  // Para mandar la entrevista aún no hace falta titular: se pone uno provisional
  if (sendInterview && String(f.get("title") ?? "").trim().length < 3) f.set("title", String(f.get("fallback_title") ?? "").slice(0, 140) || "Entrevista");
  const { draft, error } = readDraft(f, publish);
  if (!draft) return { error };
  let questions: string[] = [];
  if (sendInterview) {
    if (draft.kind !== "entrevista" || !draft.player_id) return { error: "Elige primero al jugador entrevistado" };
    const q = readQuestions(f.get("questions"));
    if (!q.questions) return { error: q.error };
    questions = q.questions;
  }
  const supabase = await createClient();
  const row = { ...draft, cover_url: coverFrom(f) };

  let aid = id;
  if (id) {
    // Si ya se le mandaron las preguntas a un jugador, la pieza sigue siendo su entrevista (si no, sus respuestas se quedan colgadas)
    const iv = await fetchInterview(supabase, id);
    if (iv && draft.kind !== "entrevista") return { error: "Esta pieza es una entrevista con preguntas ya mandadas: no se puede convertir en otra cosa. Para escribir otra pieza, empieza una nueva." };
    if (iv && draft.player_id !== iv.player_id) return { error: "Ya le mandaste las preguntas a otro jugador: no se puede cambiar el entrevistado. Para entrevistar a otro, empieza una pieza nueva." };
    const { data: old } = await supabase.from("news_articles").select("status, published_at, match_id, press_audio_url").eq("id", id).maybeSingle();
    if (!old) return { error: "Esta pieza ya no existe" };
    const status = publish ? "published" : old.status;
    // Otro partido u otro tipo de pieza: la rueda de prensa de Don Rayo ya no vale
    const pressGone = old.match_id !== draft.match_id || draft.kind !== "cronica";
    const { error: e } = await supabase.from("news_articles")
      .update({ ...row, status, published_at: status === "published" ? old.published_at ?? new Date().toISOString() : null, ...(pressGone ? NO_PRESS : {}) }).eq("id", id);
    if (!e && pressGone) await dropPressAudio(old.press_audio_url);
    if (e) return { error: "No se pudo guardar. ¿Tienes permiso para editar esta pieza?" };
  } else {
    const { data, error: e } = await supabase.from("news_articles")
      .insert({ ...row, status: publish ? "published" : "draft", published_at: publish ? new Date().toISOString() : null, created_by: s.user.id })
      .select("id").single();
    if (e || !data) return { error: "No se pudo guardar la pieza" };
    aid = data.id as string;
  }
  if (publish && f.get("notify") === "on") await announce(aid!, s.user.id);
  if (sendInterview) {
    const r = await sendInterviewTo(aid!, draft.player_id!, questions, s.user.id);
    refresh(aid!);
    if (r.error) redirect(`/la-voz/${aid}/editar?entrevista=${r.error}`);
    redirect(`/la-voz/${aid}/editar?enviada=1`);
  }
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
  const { data: a } = await supabase.from("news_articles").select("cover_url, press_audio_url").eq("id", id).maybeSingle();
  const { data, error } = await supabase.from("news_articles").delete().eq("id", id).select("id");
  if (error || !data?.length) return { error: "No se pudo eliminar. ¿Tienes permiso?" };
  await dropPressAudio(a?.press_audio_url);
  const path = a?.cover_url?.split("/news-photos/")[1];
  if (path) await supabase.storage.from("news-photos").remove([decodeURIComponent(path)]);
  refresh();
  redirect("/la-voz?eliminada=1");
}

type AiInput = { kind: string; matchId?: string | null; playerId?: string | null; sponsorId?: string | null; notes?: string | null; articleId?: string | null };

/** Prepara las instrucciones para la IA con los datos de la app (solo apodos) y las notas de quien escribe. */
async function promptOf(input: AiInput): Promise<{ prompt?: string; error?: string }> {
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
  if (kind === "comunicado" && !input.notes?.trim()) return { error: "Escribe en tus notas qué quiere comunicar el club" };
  let sponsor: SponsorFacts | null = null;
  if (kind === "promocion") {
    const sc = input.sponsorId && /^[0-9a-f-]{36}$/i.test(input.sponsorId) ? (await sponsorCards([input.sponsorId])).get(input.sponsorId) : null;
    if (!sc) return { error: "Elige primero el patrocinador" };
    sponsor = { name: sc.name, main: sc.tier === "main", website: sc.website };
  }
  // Entrevista contestada en la app: sus respuestas van a la IA tal cual
  let notes = input.notes?.slice(0, 3000) ?? "";
  if (kind === "entrevista" && input.articleId && /^[0-9a-f-]{36}$/i.test(input.articleId)) {
    const iv = await fetchInterview(supabase, input.articleId);
    if (iv && iv.player_id === input.playerId) notes = [notes.trim(), interviewNotes(iv.questions)].filter(Boolean).join("\n\n");
  }
  return { prompt: buildPrompt({ kind, match: sheet?.facts, player, sponsor, notes }) };
}

/** Prompt para copiar en una IA con los datos de la app y las notas de quien escribe. */
export async function promptFor(input: AiInput): Promise<{ prompt?: string; error?: string }> {
  return promptOf(input);
}

export type AiDraft = { kicker?: string; title?: string; summary?: string; body?: string; error?: string };

/** «Redactar borrador»: la IA gratuita (Gemini) escribe antetítulo, titular, entradilla y texto. Nunca guarda ni publica. */
export async function draftWithAi(input: AiInput): Promise<AiDraft> {
  const p = await promptOf(input);
  if (!p.prompt) return { error: p.error };
  const r = await askGemini(p.prompt);
  if (!r.text) return { error: r.error };
  const d = parseAiReply(r.text);
  if (!d?.body) return { error: "La IA no ha devuelto un texto que se pueda usar. Prueba otra vez." };
  return { kicker: d.kicker?.slice(0, 60), title: d.title?.slice(0, 140), summary: d.summary?.slice(0, 500), body: d.body.slice(0, 30000) };
}

/** La IA propone preguntas para la entrevista (solo con el apodo y los números de la temporada). */
export async function suggestQuestions(input: { playerId?: string | null; notes?: string | null }): Promise<{ questions?: string[]; error?: string }> {
  const s = await getSession();
  if (!s.can("news", "create") && !s.can("news", "update")) return { error: "No tienes permiso" };
  const supabase = await createClient();
  const player = input.playerId ? await fetchPlayerFacts(supabase, input.playerId) : null;
  if (!player) return { error: "Elige primero al jugador" };
  const r = await askGemini(buildQuestionsPrompt({ player, notes: input.notes?.slice(0, 3000) }), { temperature: 0.9, maxTokens: 2048 });
  if (!r.text) return { error: r.error };
  const questions = parseQuestions(r.text);
  return questions.length ? { questions } : { error: "La IA no ha devuelto preguntas. Prueba otra vez." };
}

// ------------------------------------------------------------------ Entrevistas en la app
/** Manda (o vuelve a mandar) las preguntas al jugador y le avisa en el móvil. */
async function sendInterviewTo(articleId: string, playerId: string, questions: string[], by: string): Promise<{ error?: "jugador" | "sin-usuario" | "fallo" }> {
  const supabase = await createClient();
  const { data: p } = await supabase.from("players").select("id, user_id").eq("id", playerId).maybeSingle<{ id: string; user_id: string | null }>();
  if (!p) return { error: "jugador" };
  if (!p.user_id) return { error: "sin-usuario" };
  const old = await fetchInterview(supabase, articleId);
  const qas = mergeAnswers(questions, old && old.player_id === playerId ? old.questions : null);
  const row = { article_id: articleId, player_id: playerId, questions: qas, status: "pending", sent_by: by, sent_at: new Date().toISOString(), answered_at: null };
  const { data, error } = old
    ? await supabase.from("news_interviews").update(row).eq("id", old.id).select("id").single()
    : await supabase.from("news_interviews").insert(row).select("id").single();
  if (error || !data) return { error: "fallo" };
  await sendPush([p.user_id], {
    title: `🎙️ ${NEWS_NAME} quiere entrevistarte`,
    body: `${questions.length} pregunta${questions.length > 1 ? "s" : ""} para ti. Contéstalas desde la app cuando puedas.`,
    url: `/la-voz/entrevista/${data.id}`,
    tag: `entrevista-${data.id}`,
  });
  revalidatePath("/");
  return {};
}

export type InterviewState = { error?: string; ok?: string; status?: "pending" | "answered" } | undefined;

/** El jugador guarda sus respuestas (a medias) o las entrega. Al entregar, avisa a quien se la mandó. */
export async function answerInterview(id: string, answers: string[], submit: boolean): Promise<InterviewState> {
  const s = await getSession();
  const supabase = await createClient();
  const iv = await fetchInterviewById(supabase, id);
  if (!iv || iv.player.user_id !== s.user.id) return { error: "Esta entrevista no es tuya" };
  if (iv.status !== "pending") return { error: "Ya la entregaste. ¡Gracias!" };
  const clean = iv.questions.map((_, i) => String(answers[i] ?? "").trim().slice(0, 2000));
  const { data, error } = await supabase.rpc("answer_news_interview", { p_id: id, p_answers: clean, p_submit: submit });
  if (error) return { error: /al menos/i.test(error.message) ? "Contesta al menos una pregunta antes de entregarla" : "No se pudo guardar. Prueba otra vez." };
  if (submit) {
    const admin = createAdminClient();
    const qas: InterviewQA[] = iv.questions.map((x, i) => ({ q: x.q, a: clean[i] || null }));
    // Si el borrador aún no tiene texto, las respuestas se montan solas como P/R
    const { data: a } = await admin.from("news_articles").select("id, body, created_by").eq("id", iv.article_id).maybeSingle<{ id: string; body: string; created_by: string | null }>();
    const filled = !!a && !a.body.trim();
    if (filled) await admin.from("news_articles").update({ body: interviewToBody(qas) }).eq("id", a.id);
    let to = [iv.sent_by ?? a?.created_by].filter((u): u is string => !!u);
    if (!to.length) {
      const { data: writers } = await admin.rpc("users_with_perm", { p_module: "news", p_action: "update" });
      to = (writers ?? []) as string[];
    }
    await sendPush(to.filter((u) => u !== s.user.id), {
      title: `🎙️ ${shirtName(iv.player)} ha contestado la entrevista`,
      body: `${clean.filter(Boolean).length} de ${clean.length} respuestas. ${filled ? "Ya están en el texto del borrador: repásalas y publícala." : "Las tienes en el borrador: mételas en el texto cuando quieras."}`,
      url: `/la-voz/${iv.article_id}/editar`,
      tag: `entrevista-${id}`,
    });
    revalidatePath(`/la-voz/${iv.article_id}/editar`);
  }
  revalidatePath("/");
  revalidatePath(`/la-voz/entrevista/${id}`);
  return data === "answered" ? { status: "answered", ok: "¡Entregada! Gracias. La redacción ya tiene tus respuestas." } : { status: "pending", ok: "Guardado. Puedes seguir cuando quieras." };
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

/** Reaccionar a una noticia: la misma reacción la quita, otra la cambia. */
export async function reactNews(id: string, emoji: string): Promise<NewsState> {
  try {
    if (!REACTIONS.includes(emoji as Reaction)) throw new Error("Reacción no válida");
    const s = await getSession();
    const supabase = await createClient();
    const { data: mine } = await supabase.from("news_reactions").select("emoji").eq("article_id", id).eq("user_id", s.user.id).maybeSingle();
    const { error } = mine?.emoji === emoji
      ? await supabase.from("news_reactions").delete().eq("article_id", id).eq("user_id", s.user.id)
      : await supabase.from("news_reactions").upsert({ article_id: id, user_id: s.user.id, emoji }, { onConflict: "article_id,user_id" });
    if (error) throw new Error(error.message);
    revalidatePath(`/la-voz/${id}`);
    return { ok: "1" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se ha podido guardar" };
  }
}

// ------------------------------------------------------------------ Don Rayo (4.27.0)
const NO_PRESS = { press_text: null, press_audio_url: null, press_cues: null, press_at: null };
const PRESS_BUCKET = "news-press";

async function dropPressAudio(url: string | null | undefined) {
  const path = url?.split(`/${PRESS_BUCKET}/`)[1]?.split("?")[0];
  if (path) await createAdminClient().storage.from(PRESS_BUCKET).remove([decodeURIComponent(path)]);
}

export type PressState = { error?: string; text?: string; voiced?: boolean };

/** Quién puede tocar la rueda de prensa: quien puede editar esa crónica. */
async function pressArticle(id: string) {
  const s = await getSession();
  const supabase = await createClient();
  const { data: a } = await supabase.from("news_articles").select("id, kind, match_id, created_by, press_text, press_audio_url").eq("id", id)
    .maybeSingle<{ id: string; kind: string; match_id: string | null; created_by: string | null; press_text: string | null; press_audio_url: string | null }>();
  if (!a) return { error: "Esta pieza ya no existe" } as const;
  if (!(s.can("news", "update") || (s.can("news", "create") && a.created_by === s.user.id))) return { error: "No tienes permiso para editar esta crónica" } as const;
  if (a.kind !== "cronica" || !a.match_id) return { error: "Don Rayo solo habla en las crónicas de un partido" } as const;
  return { a, supabase } as const;
}

/** La IA escribe lo que dice Don Rayo con los datos del acta. Borra la voz anterior, que ya no vale. */
export async function writePress(id: string): Promise<PressState> {
  const p = await pressArticle(id);
  if ("error" in p) return { error: p.error };
  const sheet = await fetchMatchSheet(p.supabase, p.a.match_id!);
  if (!sheet?.facts.played) return { error: "El partido aún no tiene resultado" };
  const r = await askGemini(buildPressPrompt(sheet.facts), { maxTokens: 1024 });
  // 4.27.2 · El aviso de «falta la clave» manda a «Copiar instrucciones para la IA», que solo existe en el editor
  if (!r.text) return { error: (r.error ?? "La IA no ha podido escribirlo.").replace(/\s*Mientras, usa «Copiar instrucciones para la IA»\./, " Sin ella Don Rayo no puede hablar.") };
  const text = parsePress(r.text);
  if (!text) return { error: "La IA no ha devuelto nada que Don Rayo pueda decir. Prueba otra vez." };
  const { error } = await p.supabase.from("news_articles").update({ ...NO_PRESS, press_text: text, press_at: new Date().toISOString() }).eq("id", id);
  if (error) return { error: "No se pudo guardar la rueda de prensa" };
  await dropPressAudio(p.a.press_audio_url);
  refresh(id);
  return { text };
}

/** Guarda el texto retocado a mano. La voz anterior ya no coincide: se borra. */
export async function savePressText(id: string, raw: string): Promise<PressState> {
  const p = await pressArticle(id);
  if ("error" in p) return { error: p.error };
  const text = raw.replace(/\s+/g, " ").trim();
  if (text.length < 20) return { error: "Escribe al menos una frase" };
  if (text.length > PRESS_MAX) return { error: `Como mucho ${PRESS_MAX} letras: tiene que caber en unos 30 segundos de voz` };
  if (text === p.a.press_text) return { text };
  const { error } = await p.supabase.from("news_articles").update({ ...NO_PRESS, press_text: text, press_at: new Date().toISOString() }).eq("id", id);
  if (error) return { error: "No se pudo guardar" };
  await dropPressAudio(p.a.press_audio_url);
  refresh(id);
  return { text };
}

/** Crea la voz de Don Rayo con Gemini (gratis, una vez) y la guarda con la boca y los subtítulos. */
export async function voicePress(id: string): Promise<PressState> {
  const p = await pressArticle(id);
  if ("error" in p) return { error: p.error };
  const text = p.a.press_text;
  if (!text) return { error: "Primero hay que escribir lo que dice" };
  const v = await speakWithGemini(speechScript(text));
  if (!v.pcm) return { error: v.error };
  const rate = rateOf(v.mime);
  const samples = new Int16Array(v.pcm.buffer, v.pcm.byteOffset, Math.floor(v.pcm.byteLength / 2));
  const cues = pressCues(samples, rate, text);
  if (cues.duration < 3) return { error: "La voz ha salido vacía. Prueba otra vez." };
  const admin = createAdminClient();
  const path = `${id}/${Date.now()}.wav`;
  const { error: up } = await admin.storage.from(PRESS_BUCKET).upload(path, wavFile(v.pcm, rate), { contentType: "audio/wav", cacheControl: "31536000" });
  if (up) return { error: "No se pudo guardar la voz" };
  const url = admin.storage.from(PRESS_BUCKET).getPublicUrl(path).data.publicUrl;
  // Solo si el texto no ha cambiado mientras tanto
  const { data, error } = await p.supabase.from("news_articles").update({ press_audio_url: url, press_cues: cues }).eq("id", id).eq("press_text", text).select("id");
  if (error || !data?.length) {
    await admin.storage.from(PRESS_BUCKET).remove([path]);
    return { error: "El texto ha cambiado mientras se creaba la voz. Vuelve a crearla." };
  }
  await dropPressAudio(p.a.press_audio_url);
  refresh(id);
  return { text, voiced: true };
}

/** Quita la rueda de prensa de la crónica. */
export async function removePress(id: string): Promise<PressState> {
  const p = await pressArticle(id);
  if ("error" in p) return { error: p.error };
  const { error } = await p.supabase.from("news_articles").update(NO_PRESS).eq("id", id);
  if (error) return { error: "No se pudo quitar" };
  await dropPressAudio(p.a.press_audio_url);
  refresh(id);
  return {};
}
