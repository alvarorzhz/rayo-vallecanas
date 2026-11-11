"use client";
import { useActionState, useRef, useState, useTransition } from "react";
import { Bold, Check, ClipboardCopy, Heading2, ImagePlus, MessageCircleQuestion, Plus, Quote, Send, Sparkles, Trash2, Undo2, Wand2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { shrinkImage } from "@/lib/shrink-image";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { ArticleBody } from "@/components/news/article-body";
import { DEFAULT_BYLINE, FEATURED_HOURS, KINDS, MAX_QUESTION, MAX_QUESTIONS, imageLine, interviewToBody, parseAiReply, type Article, type NewsKind } from "@/lib/news";
import type { Interview, MatchOption, PlayerOption } from "@/lib/news-queries";
import type { AiDraft, NewsState } from "@/app/(app)/la-voz/actions";

type AiInput = { kind: string; matchId?: string | null; playerId?: string | null; notes?: string | null; articleId?: string | null };

type Props = {
  action: (s: NewsState, f: FormData) => Promise<NewsState>;
  promptFor: (i: AiInput) => Promise<{ prompt?: string; error?: string }>;
  /** «Redactar borrador» con la IA gratuita (solo si hay clave de Gemini en Vercel). */
  draftWithAi: (i: AiInput) => Promise<AiDraft>;
  suggestQuestions: (i: { playerId?: string | null; notes?: string | null }) => Promise<{ questions?: string[]; error?: string }>;
  aiReady: boolean;
  interview?: Interview | null;
  /** Aviso tras mandar la entrevista (o por qué no se pudo). */
  interviewFlash?: { error?: string; ok?: string };
  unpublish?: () => Promise<NewsState>;
  remove?: () => Promise<NewsState>;
  article: Article | null;
  init?: { kind?: NewsKind | null; matchId?: string | null; playerId?: string | null };
  matches: MatchOption[];
  players: PlayerOption[];
  canPublish: boolean;
};

async function upload(file: File): Promise<string> {
  const f = await shrinkImage(file);
  if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) throw new Error("La foto tiene que ser JPG, PNG o WebP");
  if (f.size > 3 * 1024 * 1024) throw new Error("La foto pesa más de 3 MB");
  const ext = f.type === "image/png" ? "png" : f.type === "image/webp" ? "webp" : "jpg";
  const path = `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${ext}`;
  const sb = createClient();
  const { error } = await sb.storage.from("news-photos").upload(path, f, { contentType: f.type });
  if (error) throw new Error("No se pudo subir la foto");
  return sb.storage.from("news-photos").getPublicUrl(path).data.publicUrl;
}

export function NewsEditor({ action, promptFor, draftWithAi, suggestQuestions, aiReady, interview, interviewFlash, unpublish, remove, article: a, init, matches, players, canPublish }: Props) {
  const [state, formAction] = useActionState(action, undefined);
  const [kind, setKind] = useState<NewsKind>(a?.kind ?? init?.kind ?? "cronica");
  const [matchId, setMatchId] = useState(a?.match_id ?? init?.matchId ?? "");
  const [playerId, setPlayerId] = useState(a?.player_id ?? init?.playerId ?? "");
  const [kicker, setKicker] = useState(a?.kicker ?? "");
  const [title, setTitle] = useState(a?.title ?? "");
  const [summary, setSummary] = useState(a?.summary ?? "");
  const [body, setBody] = useState(a?.body ?? "");
  const [byline, setByline] = useState(a?.byline ?? DEFAULT_BYLINE[a?.kind ?? init?.kind ?? "cronica"]);
  const [notes, setNotes] = useState(a?.ai_notes ?? "");
  const [cover, setCover] = useState(a?.cover_url ?? "");
  const [caption, setCaption] = useState(a?.cover_caption ?? "");
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [prompt, setPrompt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [aiText, setAiText] = useState("");
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>();
  const [busy, setBusy] = useState<string | null>(null);
  const [questions, setQuestions] = useState<string[]>(interview?.questions.map((x) => x.q) ?? []);
  const [aiMsg, setAiMsg] = useState<{ error?: string; ok?: string }>();
  const [ivMsg, setIvMsg] = useState<{ error?: string; ok?: string } | undefined>(interviewFlash);
  const [pending, start] = useTransition();
  const area = useRef<HTMLTextAreaElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const bodyInput = useRef<HTMLInputElement>(null);

  const meta = KINDS.find((k) => k.key === kind)!;
  const published = a?.status === "published";
  const pickKind = (k: NewsKind) => {
    if (byline === DEFAULT_BYLINE[kind]) setByline(DEFAULT_BYLINE[k]);
    setKind(k);
    setPrompt(null);
  };
  const matchList = kind === "cronica" ? matches.filter((m) => m.played) : kind === "previa" ? [...matches].filter((m) => !m.played).reverse() : [];

  // Inserta texto donde está el cursor del cuerpo (o al final)
  const insert = (before: string, after = "", placeholder = "") => {
    const el = area.current;
    const s0 = el?.selectionStart ?? body.length;
    const s1 = el?.selectionEnd ?? body.length;
    const sel = body.slice(s0, s1) || placeholder;
    const next = body.slice(0, s0) + before + sel + after + body.slice(s1);
    setBody(next);
    requestAnimationFrame(() => {
      el?.focus();
      const pos = s0 + before.length;
      el?.setSelectionRange(pos, pos + sel.length);
    });
  };
  const block = (prefix: string, placeholder: string) => {
    const el = area.current;
    const at = el?.selectionStart ?? body.length;
    const before = body.slice(0, at);
    const lead = !before.trim() || before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
    insert(`${lead}${prefix}`, "\n\n", placeholder);
  };

  const pickPhoto = async (e: React.ChangeEvent<HTMLInputElement>, where: "cover" | "body") => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(where);
    setMsg(undefined);
    try {
      const url = await upload(file);
      if (where === "cover") setCover(url);
      else {
        const [open, close] = imageLine(url, "\u0000").split("\u0000");
        insert(`\n\n${open}`, `${close}\n\n`, "Pie de foto");
      }
    } catch (err) {
      setMsg({ error: err instanceof Error ? err.message : "No se pudo subir la foto" });
    } finally {
      setBusy(null);
    }
  };

  const makePrompt = () =>
    start(async () => {
      setMsg(undefined);
      const r = await promptFor({ kind, matchId: matchId || null, playerId: playerId || null, notes });
      if (r.error || !r.prompt) return setMsg({ error: r.error ?? "No se pudo preparar" });
      setPrompt(r.prompt);
      try {
        await navigator.clipboard.writeText(r.prompt);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch {
        setCopied(false);
      }
    });

  const fill = (r: { kicker?: string; title?: string; summary?: string; body?: string }) => {
    if (r.kicker) setKicker(r.kicker.slice(0, 60));
    if (r.title) setTitle(r.title.slice(0, 140));
    if (r.summary) setSummary(r.summary.slice(0, 500));
    if (r.body) setBody(r.body);
  };

  const writeWithAi = () => {
    if ((title.trim() || body.trim()) && !confirm("La IA va a sustituir el antetítulo, el titular, la entradilla y el texto que hay ahora. ¿Seguimos?")) return;
    setBusy("ai");
    setAiMsg(undefined);
    start(async () => {
      try {
        const r = await draftWithAi({ kind, matchId: matchId || null, playerId: playerId || null, notes, articleId: a?.id ?? null });
        if (r.error || !r.body) return setAiMsg({ error: r.error ?? "La IA no ha podido redactarlo" });
        fill(r);
        setTab("write");
        setAiMsg({ ok: "Borrador listo. Repásalo y cámbialo a tu gusto: no se guarda ni se publica hasta que tú lo digas." });
      } finally {
        setBusy(null);
      }
    });
  };

  const proposeQuestions = () => {
    if (questions.some((q) => q.trim()) && !confirm("La IA va a sustituir las preguntas que hay ahora. ¿Seguimos?")) return;
    setBusy("questions");
    setIvMsg(undefined);
    start(async () => {
      try {
        const r = await suggestQuestions({ playerId: playerId || null, notes });
        if (r.error || !r.questions) return setIvMsg({ error: r.error ?? "La IA no ha propuesto preguntas" });
        setQuestions(r.questions);
        setIvMsg({ ok: "Preguntas propuestas. Quita, cambia o añade las que quieras antes de mandarlas." });
      } finally {
        setBusy(null);
      }
    });
  };

  const answersToBody = () => {
    if (!interview) return;
    if (body.trim() && !confirm("Se va a sustituir el texto por las preguntas y respuestas del jugador. ¿Seguimos?")) return;
    setBody(interviewToBody(interview.questions));
    setTab("write");
    setIvMsg({ ok: "Respuestas metidas en el texto. Añade una introducción y repásalas." });
  };

  const applyAi = () => {
    const r = parseAiReply(aiText);
    if (!r) return setMsg({ error: "Pega primero lo que te ha devuelto la IA" });
    fill(r);
    setAiText("");
    setMsg({ ok: r.title ? "Listo: titular, entradilla y texto repartidos. Repásalos antes de publicar." : "No venía en el formato pedido: lo he puesto todo en el texto." });
  };

  const runOther = (fn?: () => Promise<NewsState>, confirmText?: string) => {
    if (!fn || (confirmText && !confirm(confirmText))) return;
    start(async () => {
      const r = await fn();
      if (r?.error) setMsg(r);
    });
  };

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="cover_url" value={cover} />

      {/* 1 · Tipo de pieza */}
      <fieldset className="card rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <legend className="sr-only">Tipo de pieza</legend>
        <h2 className="mb-3">1 · ¿Qué vas a escribir?</h2>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {KINDS.map((k) => (
            <button key={k.key} type="button" onClick={() => pickKind(k.key)} aria-pressed={kind === k.key}
              className={`rounded-xl p-3 text-left ring-1 transition ${kind === k.key ? "bg-negro text-white ring-negro" : "bg-[#f7f7f4] ring-black/10 hover:ring-black/30"}`}>
              <span className="news-head block text-lg font-black leading-tight">{k.label}</span>
              <span className={`mt-0.5 block text-xs leading-snug ${kind === k.key ? "text-white/70" : "text-negro/60"}`}>{k.hint}</span>
            </button>
          ))}
        </div>
        {meta.needs === "match" && (
          <div className="mt-4">
            <label className="label" htmlFor="match_id">Partido</label>
            <select id="match_id" name="match_id" className="input" value={matchId} onChange={(e) => { setMatchId(e.target.value); setPrompt(null); }}>
              <option value="">Elige el partido…</option>
              {matchList.map((m) => <option key={m.id} value={m.id}>{m.label}{kind === "cronica" && !m.hasReport ? " (sin acta)" : ""}</option>)}
              {matchId && !matchList.some((m) => m.id === matchId) && <option value={matchId}>El partido de esta pieza</option>}
            </select>
            {kind === "cronica" && <p className="mt-1 text-xs text-negro/60">La ficha técnica (resultado, alineación, goles y MVP) sale sola del acta.</p>}
          </div>
        )}
        {meta.needs === "player" && (
          <div className="mt-4">
            <label className="label" htmlFor="player_id">Jugador entrevistado</label>
            <select id="player_id" name="player_id" className="input" value={playerId} onChange={(e) => { setPlayerId(e.target.value); setPrompt(null); }}>
              <option value="">Elige al jugador…</option>
              {players.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              {playerId && !players.some((p) => p.id === playerId) && <option value={playerId}>El jugador de esta pieza</option>}
            </select>
          </div>
        )}
      </fieldset>

      {/* Entrevista que contesta el propio jugador desde la app */}
      {kind === "entrevista" && playerId && (
        <InterviewBox
          player={players.find((p) => p.id === playerId) ?? null}
          interview={interview && interview.player_id === playerId ? interview : null}
          questions={questions} setQuestions={setQuestions}
          aiReady={aiReady} busy={busy} pending={pending} msg={ivMsg}
          onPropose={proposeQuestions} onUseAnswers={answersToBody} />
      )}

      {/* 2 · Ayuda de la IA */}
      <section className="card relative overflow-hidden rounded-2xl bg-negro p-4 text-white shadow-sm">
        <div aria-hidden className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-dorado/20 blur-2xl" />
        <h2 className="relative flex items-center gap-2"><Sparkles size={18} className="text-dorado" /> 2 · Que te ayude una IA (opcional)</h2>
        <p className="relative mt-1 text-sm text-white/70">
          {aiReady
            ? <>Escribe lo que viste o lo que quieres contar. La app añade los datos del {meta.needs === "player" ? "jugador" : meta.needs === "match" ? "partido" : "club"} (solo apodos) y la IA te redacta un borrador que luego cambias a tu gusto. Nunca publica sola.</>
            : <>Escribe lo que viste o lo que quieres contar. La app añade los datos del {meta.needs === "player" ? "jugador" : meta.needs === "match" ? "partido" : "club"} (solo apodos) y te prepara las instrucciones para pegarlas en ChatGPT, Gemini o Claude.</>}
        </p>
        <label className="label relative mt-3 !text-white/80" htmlFor="ai_notes">Tus notas</label>
        <textarea id="ai_notes" name="ai_notes" rows={4} maxLength={3000} value={notes} onChange={(e) => setNotes(e.target.value)} className="input relative !bg-white/95 !text-negro"
          placeholder={kind === "entrevista" ? "Preguntas que quieres hacerle o sus respuestas, si ya las tienes…" : kind === "comunicado" ? "Qué quiere comunicar el club…" : "Ej.: Llovía muchísimo. Empezamos perdiendo y Chino lo remontó con dos golazos. Gran partido de Gato bajo palos…"} />
        <p className="relative mt-1 text-xs text-white/50">Solo las ve la redacción: nunca salen en la noticia.</p>
        <div className="relative mt-3 flex flex-wrap gap-2">
          {aiReady && (
            <button type="button" onClick={writeWithAi} disabled={pending || !!busy} className="btn bg-dorado text-negro hover:brightness-105">
              {busy === "ai" ? <span aria-hidden className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent" /> : <Wand2 size={18} />}
              {busy === "ai" ? "Redactando… (unos segundos)" : "Redactar borrador"}
            </button>
          )}
          <button type="button" onClick={makePrompt} disabled={pending || !!busy} className={aiReady ? "btn bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/15" : "btn bg-dorado text-negro hover:brightness-105"}>
            {copied ? <Check size={18} /> : <ClipboardCopy size={18} />} {copied ? "Copiado: pégalo en la IA" : aiReady ? "O copiar instrucciones" : "Copiar instrucciones para la IA"}
          </button>
        </div>
        {aiReady && kind === "entrevista" && interview?.status === "answered" && (
          <p className="relative mt-2 text-xs text-white/60">La IA usará las respuestas que ha entregado el jugador, sin cambiar lo que dice.</p>
        )}
        {aiMsg && <div className="relative mt-3"><FormMessage state={aiMsg} /></div>}
        {prompt && (
          <details className="relative mt-3 rounded-xl bg-white/10 p-3 text-sm" open={!copied}>
            <summary className="cursor-pointer font-bold">Ver las instrucciones</summary>
            <textarea readOnly value={prompt} rows={8} className="mt-2 w-full rounded-lg bg-white/90 p-2 font-mono text-xs text-negro" onFocus={(e) => e.currentTarget.select()} />
          </details>
        )}
        {prompt && (
          <div className="relative mt-3">
            <label className="label !text-white/80" htmlFor="ai_reply">Pega aquí lo que te devuelva la IA</label>
            <textarea id="ai_reply" rows={4} value={aiText} onChange={(e) => setAiText(e.target.value)} className="input !bg-white/95 !text-negro" placeholder="ANTETÍTULO: …  TITULAR: …  ENTRADILLA: …  CUERPO: …" />
            <button type="button" onClick={applyAi} className="btn-primary mt-2"><Wand2 size={18} /> Repartir en los campos</button>
          </div>
        )}
      </section>

      {/* 3 · La pieza */}
      <section className="card space-y-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <h2>3 · La pieza</h2>
        <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
          <div>
            <label className="label" htmlFor="kicker">Antetítulo</label>
            <input id="kicker" name="kicker" maxLength={60} value={kicker} onChange={(e) => setKicker(e.target.value)} className="input" placeholder={kind === "cronica" ? "Jornada 6" : meta.label} />
          </div>
          <div>
            <label className="label" htmlFor="title">Titular</label>
            <input id="title" name="title" required maxLength={140} value={title} onChange={(e) => setTitle(e.target.value)} className="input news-head !text-lg font-bold" placeholder="El Rayo asalta Tejares bajo la lluvia" />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="summary">Entradilla</label>
          <textarea id="summary" name="summary" rows={2} maxLength={500} value={summary} onChange={(e) => setSummary(e.target.value)} className="input news-body" placeholder="Una o dos frases que resuman la noticia." />
        </div>

        <div>
          <div className="mb-1.5 flex flex-wrap items-end justify-between gap-2">
            <label className="label !mb-0" htmlFor="body">Texto</label>
            <div role="tablist" className="flex rounded-lg bg-gris p-0.5 text-xs font-bold">
              <button type="button" role="tab" aria-selected={tab === "write"} onClick={() => setTab("write")} className={`rounded-md px-3 py-1 ${tab === "write" ? "bg-white shadow-sm" : "text-negro/60"}`}>Escribir</button>
              <button type="button" role="tab" aria-selected={tab === "preview"} onClick={() => setTab("preview")} className={`rounded-md px-3 py-1 ${tab === "preview" ? "bg-white shadow-sm" : "text-negro/60"}`}>Vista previa</button>
            </div>
          </div>
          <div className={tab === "write" ? "" : "hidden"}>
            <div className="mb-1.5 flex flex-wrap gap-1">
              <Tool onClick={() => block("## ", "Ladillo")} icon={<Heading2 size={15} />} label="Ladillo" />
              <Tool onClick={() => block("> ", "Una frase para destacar")} icon={<Quote size={15} />} label="Cita" />
              <Tool onClick={() => insert("**", "**", "negrita")} icon={<Bold size={15} />} label="Negrita" />
              {kind === "entrevista" && <Tool onClick={() => block("P: ", "Pregunta")} icon={<MessageCircleQuestion size={15} />} label="Pregunta" />}
              {kind === "entrevista" && <Tool onClick={() => block("R: ", "Respuesta")} icon={<MessageCircleQuestion size={15} />} label="Respuesta" />}
              <Tool onClick={() => bodyInput.current?.click()} icon={<ImagePlus size={15} />} label={busy === "body" ? "Subiendo…" : "Insertar imagen"} disabled={busy === "body"} />
              <input ref={bodyInput} type="file" accept="image/*" className="hidden" onChange={(e) => pickPhoto(e, "body")} />
            </div>
            <textarea ref={area} id="body" name="body" rows={16} maxLength={30000} value={body} onChange={(e) => setBody(e.target.value)} className="input news-body !text-base leading-relaxed" placeholder="Escribe aquí el texto. Deja una línea en blanco entre párrafos." />
            <p className="mt-1 text-xs text-negro/60">Las fotos salen donde pongas su línea «![pie de foto](…)»: escribe el pie entre los corchetes.</p>
          </div>
          {tab === "preview" && (
            <div className="paper min-h-40 rounded-xl p-4 ring-1 ring-black/10">
              {title && <p className="news-head text-2xl font-black leading-tight">{title}</p>}
              {summary && <p className="news-body mt-2 text-lg text-[#141210]/80">{summary}</p>}
              {body ? <ArticleBody body={body} drop={kind !== "comunicado"} /> : <p className="text-sm text-negro/50">Aún no hay texto.</p>}
            </div>
          )}
        </div>

        <div>
          <span className="label">Foto de portada</span>
          {cover ? (
            <div className="grid gap-3 sm:grid-cols-[14rem_1fr]">
              <div className="news-photo relative aspect-[16/10] rounded-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={cover} alt="Foto de portada" className="h-full w-full object-cover" />
                <button type="button" onClick={() => setCover("")} aria-label="Quitar la foto" className="absolute right-1.5 top-1.5 rounded-full bg-negro/70 p-1 text-white hover:bg-negro"><X size={14} /></button>
              </div>
              <div>
                <label className="label" htmlFor="cover_caption">Pie de foto</label>
                <input id="cover_caption" name="cover_caption" maxLength={140} value={caption} onChange={(e) => setCaption(e.target.value)} className="input" placeholder="El once inicial, antes del partido." />
              </div>
            </div>
          ) : (
            <>
              <button type="button" onClick={() => coverInput.current?.click()} disabled={busy === "cover"} className="btn-ghost w-full sm:w-auto">
                <ImagePlus size={18} /> {busy === "cover" ? "Subiendo…" : "Subir foto"}
              </button>
              <p className="mt-1 text-xs text-negro/60">Si no subes ninguna, la portada se hace sola: el marcador con los escudos, la foto del jugador o el escudo del club.</p>
            </>
          )}
          <input ref={coverInput} type="file" accept="image/*" className="hidden" onChange={(e) => pickPhoto(e, "cover")} />
        </div>

        <div className="sm:max-w-xs">
          <label className="label" htmlFor="byline">Firma</label>
          <input id="byline" name="byline" maxLength={60} value={byline} onChange={(e) => setByline(e.target.value)} className="input" />
        </div>
      </section>

      {/* 4 · Publicar */}
      <section className="card space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <h2>4 · Publicar</h2>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="featured" defaultChecked={a?.featured ?? false} className="mt-0.5 h-5 w-5 accent-rojo" />
          <span><b>Portada de Inicio.</b> Durante {FEATURED_HOURS / 24} días desde que se publica, Inicio se abre como la primera página de La Voz del Rayo con esta noticia.</span>
        </label>
        {canPublish && !a?.notified_at && (
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="notify" defaultChecked className="mt-0.5 h-5 w-5 accent-rojo" />
            <span><b>Avisar al equipo</b> al publicar, con un aviso en el móvil (solo la primera vez).</span>
          </label>
        )}
        <FormMessage state={msg ?? state} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          {remove && (
            <button type="button" onClick={() => runOther(remove, "¿Eliminar esta pieza? No se puede deshacer.")} disabled={pending} className="btn-ghost text-rojo sm:mr-auto">
              <Trash2 size={16} /> Eliminar
            </button>
          )}
          {published && unpublish && (
            <button type="button" onClick={() => runOther(unpublish, "¿Retirar la pieza de la portada? Vuelve a borrador.")} disabled={pending} className="btn-ghost">
              <Undo2 size={16} /> Retirar
            </button>
          )}
          {!published && <SubmitButton name="intent" value="draft" className="btn-ghost" disabled={!!busy}>Guardar borrador</SubmitButton>}
          {canPublish && (
            <SubmitButton name="intent" value="publish" className="btn-primary" pendingText="Publicando…" disabled={!!busy}>
              {published ? "Guardar cambios" : "Publicar"}
            </SubmitButton>
          )}
        </div>
      </section>
    </form>
  );
}

function Tool({ onClick, icon, label, disabled }: { onClick: () => void; icon: React.ReactNode; label: string; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="inline-flex items-center gap-1 rounded-lg bg-gris px-2.5 py-1.5 text-xs font-bold text-negro/75 ring-1 ring-black/5 hover:bg-white hover:ring-black/20 disabled:opacity-50">
      {icon} {label}
    </button>
  );
}

function fmtDay(iso: string) {
  return new Date(iso).toLocaleString("es-ES", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });
}

/** Las preguntas para el jugador: se escriben (o las propone la IA), se le mandan y aquí se ven sus respuestas. */
function InterviewBox({ player, interview: iv, questions, setQuestions, aiReady, busy, pending, msg, onPropose, onUseAnswers }: {
  player: PlayerOption | null;
  interview: Interview | null;
  questions: string[];
  setQuestions: (q: string[]) => void;
  aiReady: boolean;
  busy: string | null;
  pending: boolean;
  msg?: { error?: string; ok?: string };
  onPropose: () => void;
  onUseAnswers: () => void;
}) {
  const name = player?.name ?? "el jugador";
  const answered = iv?.questions.filter((x) => x.a?.trim()).length ?? 0;
  const sentSame = !!iv && iv.questions.length === questions.length && iv.questions.every((x, i) => x.q === questions[i]?.trim());
  const set = (i: number, v: string) => setQuestions(questions.map((q, j) => (j === i ? v : q)));
  const clean = questions.map((q) => q.trim()).filter((q) => q.length >= 3);

  if (player && !player.hasUser) {
    return (
      <section className="card rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <h2 className="flex items-center gap-2"><MessageCircleQuestion size={18} className="text-rojo" /> Que conteste {name} desde la app</h2>
        <p className="mt-1 text-sm text-negro/70">{name} aún no tiene usuario en la app, así que no se le pueden mandar las preguntas. Hazle la entrevista a mano y escribe sus respuestas en el texto (o en tus notas para que la IA las ordene).</p>
      </section>
    );
  }

  return (
    <section className="card space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <input type="hidden" name="questions" value={JSON.stringify(clean)} />
      <input type="hidden" name="fallback_title" value={`Entrevista a ${name}`} />
      <div>
        <h2 className="flex items-center gap-2"><MessageCircleQuestion size={18} className="text-rojo" /> Que conteste {name} desde la app</h2>
        <p className="mt-1 text-sm text-negro/70">Escribe las preguntas y mándaselas: le llega un aviso al móvil y las contesta él mismo. Sus respuestas vuelven aquí.</p>
      </div>

      {iv && (
        <div className={`rounded-xl px-3 py-2 text-sm ring-1 ${iv.status === "answered" ? "bg-green-50 text-green-900 ring-green-600/15" : "bg-amber-50 text-amber-900 ring-amber-600/20"}`}>
          {iv.status === "answered"
            ? <><b>Contestada</b> el {fmtDay(iv.answered_at ?? iv.sent_at)}: {answered} de {iv.questions.length} respuestas.</>
            : <><b>Mandada</b> el {fmtDay(iv.sent_at)}. Esperando a {name}{answered ? ` (lleva ${answered} de ${iv.questions.length} guardadas)` : ""}.</>}
        </div>
      )}

      {iv?.status === "answered" && (
        <div className="space-y-2 rounded-xl bg-[#f7f7f4] p-3 ring-1 ring-black/5">
          {iv.questions.map((x, i) => (
            <div key={i} className="text-sm">
              <p className="font-bold">{x.q}</p>
              <p className={x.a ? "news-body whitespace-pre-line text-negro/80" : "italic text-negro/45"}>{x.a || "Sin contestar"}</p>
            </div>
          ))}
          <button type="button" onClick={onUseAnswers} className="btn-primary mt-1"><Wand2 size={18} /> Meter las respuestas en el texto</button>
        </div>
      )}

      {(() => {
        const editor = (
          <>
      <ol className="space-y-2">
        {questions.map((q, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="sport mt-2 w-5 shrink-0 text-right text-sm font-black text-rojo">{i + 1}</span>
            <textarea rows={2} maxLength={MAX_QUESTION} value={q} onChange={(e) => set(i, e.target.value)} aria-label={`Pregunta ${i + 1}`} className="input min-h-0 flex-1 !py-2 text-sm" placeholder="¿Cómo llegaste al Rayo?" />
            <button type="button" onClick={() => setQuestions(questions.filter((_, j) => j !== i))} aria-label={`Quitar la pregunta ${i + 1}`} className="mt-1.5 rounded-full p-1.5 text-negro/50 hover:bg-gris hover:text-rojo"><X size={16} /></button>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        {questions.length < MAX_QUESTIONS && (
          <button type="button" onClick={() => setQuestions([...questions, ""])} className="btn-ghost"><Plus size={16} /> {questions.length ? "Otra pregunta" : "Escribir una pregunta"}</button>
        )}
        {aiReady && (
          <button type="button" onClick={onPropose} disabled={pending || !!busy} className="btn-ghost">
            {busy === "questions" ? <span aria-hidden className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent" /> : <Sparkles size={16} className="text-dorado" />}
            {busy === "questions" ? "Pensando preguntas…" : "Que la IA proponga preguntas"}
          </button>
        )}
      </div>
          </>
        );
        return iv?.status === "answered" ? (
          <details className="space-y-3">
            <summary className="cursor-pointer text-sm font-bold text-negro/70">Cambiar las preguntas y volver a mandársela</summary>
            <div className="mt-3 space-y-3">{editor}</div>
          </details>
        ) : editor;
      })()}
      {aiReady && <p className="text-xs text-negro/60">La IA solo recibe su apodo, su posición y sus números de la temporada, más tus notas de abajo si las hay.</p>}
      <FormMessage state={msg} />
      {clean.length > 0 && !(iv && sentSame) && (
        <SubmitButton name="intent" value="interview" formNoValidate className="btn-primary w-full sm:w-auto" pendingText="Mandando…" disabled={!!busy}>
          <Send size={18} /> {iv ? `Volver a mandársela a ${name}` : `Mandar las preguntas a ${name}`}
        </SubmitButton>
      )}
      {iv && !sentSame && <p className="text-xs text-negro/60">Si se la vuelves a mandar, se conserva lo que ya haya contestado en las preguntas que no cambies.</p>}
    </section>
  );
}
