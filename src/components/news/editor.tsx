"use client";
import { useActionState, useRef, useState, useTransition } from "react";
import { Bold, Check, ClipboardCopy, Heading2, ImagePlus, MessageCircleQuestion, Quote, Sparkles, Trash2, Undo2, Wand2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { shrinkImage } from "@/lib/shrink-image";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { ArticleBody } from "@/components/news/article-body";
import { DEFAULT_BYLINE, FEATURED_HOURS, KINDS, imageLine, parseAiReply, type Article, type NewsKind } from "@/lib/news";
import type { MatchOption, PlayerOption } from "@/lib/news-queries";
import type { NewsState } from "@/app/(app)/la-voz/actions";

type Props = {
  action: (s: NewsState, f: FormData) => Promise<NewsState>;
  promptFor: (i: { kind: string; matchId?: string | null; playerId?: string | null; notes?: string | null }) => Promise<{ prompt?: string; error?: string }>;
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

export function NewsEditor({ action, promptFor, unpublish, remove, article: a, init, matches, players, canPublish }: Props) {
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

  const applyAi = () => {
    const r = parseAiReply(aiText);
    if (!r) return setMsg({ error: "Pega primero lo que te ha devuelto la IA" });
    if (r.kicker) setKicker(r.kicker.slice(0, 60));
    if (r.title) setTitle(r.title.slice(0, 140));
    if (r.summary) setSummary(r.summary.slice(0, 500));
    if (r.body) setBody(r.body);
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

      {/* 2 · Ayuda de la IA */}
      <section className="card relative overflow-hidden rounded-2xl bg-negro p-4 text-white shadow-sm">
        <div aria-hidden className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-dorado/20 blur-2xl" />
        <h2 className="relative flex items-center gap-2"><Sparkles size={18} className="text-dorado" /> 2 · Que te ayude una IA (opcional)</h2>
        <p className="relative mt-1 text-sm text-white/70">
          Escribe lo que viste o lo que quieres contar. La app añade los datos del {meta.needs === "player" ? "jugador" : meta.needs === "match" ? "partido" : "club"} (solo apodos) y te prepara las instrucciones para pegarlas en ChatGPT, Gemini o Claude.
        </p>
        <label className="label relative mt-3 !text-white/80" htmlFor="ai_notes">Tus notas</label>
        <textarea id="ai_notes" name="ai_notes" rows={4} maxLength={3000} value={notes} onChange={(e) => setNotes(e.target.value)} className="input relative !bg-white/95 !text-negro"
          placeholder={kind === "entrevista" ? "Preguntas que quieres hacerle o sus respuestas, si ya las tienes…" : kind === "comunicado" ? "Qué quiere comunicar el club…" : "Ej.: Llovía muchísimo. Empezamos perdiendo y Chino lo remontó con dos golazos. Gran partido de Gato bajo palos…"} />
        <p className="relative mt-1 text-xs text-white/50">Solo las ve la redacción: nunca salen en la noticia.</p>
        <div className="relative mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={makePrompt} disabled={pending} className="btn bg-dorado text-negro hover:brightness-105">
            {copied ? <Check size={18} /> : <ClipboardCopy size={18} />} {copied ? "Copiado: pégalo en la IA" : "Copiar instrucciones para la IA"}
          </button>
        </div>
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
