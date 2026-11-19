"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Confetti } from "@/components/matches/matchday-fx";
import { CapsuleVault } from "@/components/capsule/capsule-vault";
import type { Gala, GalaMessage, GalaQuestion } from "@/lib/capsule-server";

const MEDAL = ["🥇", "🥈", "🥉"];

function Avatar({ src, name, size = 36 }: { src: string | null; name: string; size?: number }) {
  return src
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={src} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover ring-2 ring-dorado/60" style={{ width: size, height: size }} />
    : <span className="grid shrink-0 place-items-center rounded-full bg-white/10 font-black text-dorado ring-2 ring-dorado/40" style={{ width: size, height: size }}>{name.slice(0, 1)}</span>;
}

/** Pantalla 1: el cofre se abre. */
function Intro({ g, active }: { g: Gala; active: boolean }) {
  const [state, setState] = useState<"sealed" | "unlock" | "open">("sealed");
  useEffect(() => {
    if (!active) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setState("open"); return; }
    const a = setTimeout(() => setState("unlock"), 700);
    const b = setTimeout(() => setState("open"), 2000);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [active]);
  const msgs = g.messages.length;
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
      <p className="sport text-sm font-black tracking-[0.3em] text-dorado">CÁPSULA DEL TIEMPO · {g.season}</p>
      <CapsuleVault state={state} size={180} />
      <div className={`transition duration-700 ${state === "open" ? "opacity-100" : "translate-y-3 opacity-0"}`}>
        <h2 id="cap-gala-title" className="sport text-5xl font-black uppercase italic leading-[0.9]">¡Se abre<br />la cápsula!</h2>
        <p className="mt-3 text-white/75">
          {g.writers} {g.writers === 1 ? "persona escribió" : "personas escribieron"} al empezar la temporada.
          <br />{msgs} {msgs === 1 ? "mensaje" : "mensajes"} y {g.questions.length} {g.questions.length === 1 ? "pregunta" : "preguntas"} bajo llave hasta hoy.
        </p>
      </div>
      {state === "open" && <Confetti pieces={48} />}
    </div>
  );
}

/** Una pregunta: qué pasó de verdad y quién lo vio venir. */
function QuestionSlide({ q, n, total }: { q: GalaQuestion; n: number; total: number }) {
  const hits = q.picks.filter((p) => p.verdict?.hit === "exact").length;
  return (
    <div className="cap-slide flex h-full flex-col justify-center gap-5">
      <p className="sport text-xs font-black tracking-[0.25em] text-dorado">PREDICCIÓN {n} DE {total}</p>
      <h2 className="sport text-4xl font-black uppercase italic leading-none"><span aria-hidden>{q.emoji}</span> {q.label}</h2>
      <div className="cap-truth flex items-center gap-3 rounded-2xl bg-white/[0.07] p-4 ring-1 ring-dorado/50" style={{ animationDelay: "0.5s" }}>
        {q.truthPhoto && <Avatar src={q.truthPhoto} name={q.truth ?? "?"} size={52} />}
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-wider text-white/60">Lo que pasó de verdad</p>
          <p className="sport text-3xl font-black leading-tight text-dorado">{q.truth ?? "Sin datos"}</p>
        </div>
      </div>
      <ul className="max-h-[42vh] space-y-1.5 overflow-y-auto pr-1">
        {q.picks.map((p, i) => (
          <li key={p.user} className={`cap-pick flex items-center gap-2.5 rounded-xl px-3 py-2 ${p.me ? "bg-dorado/20 ring-1 ring-dorado/60" : "bg-white/5"}`} style={{ animationDelay: `${0.9 + i * 0.12}s` }}>
            <Avatar src={p.avatar} name={p.name} size={30} />
            <span className="min-w-0 flex-1 truncate text-sm"><b>{p.name}</b> <span className="text-white/60">dijo</span> <b>{p.answer}</b></span>
            <span className="cap-verdict shrink-0 text-lg" style={{ animationDelay: `${1.3 + i * 0.12}s` }}
              aria-label={p.verdict?.hit === "exact" ? "Acertó" : p.verdict?.hit === "close" ? "Se quedó cerca" : p.verdict ? "Falló" : "Sin resultado"}>
              {p.verdict?.hit === "exact" ? "✅" : p.verdict?.hit === "close" ? "🤏" : p.verdict ? "❌" : "·"}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-sm text-white/70">{!q.truth ? "Esta no se puede comprobar." : hits ? `${hits} ${hits === 1 ? "lo clavó" : "lo clavaron"}.` : "Nadie lo vio venir."}
        {q.picks.some((p) => p.closest && p.verdict?.hit !== "exact") && ` El que más se acercó: ${q.picks.filter((p) => p.closest).map((p) => p.name).join(", ")}.`}</p>
    </div>
  );
}

/** El pitoniso de la temporada. */
function SeersSlide({ g }: { g: Gala }) {
  const top = g.seers.filter((r) => r.points > 0);
  return (
    <div className="cap-slide flex h-full flex-col justify-center gap-5">
      <p className="sport text-xs font-black tracking-[0.25em] text-dorado">Y EL PREMIO ES PARA…</p>
      <h2 className="sport text-5xl font-black uppercase italic leading-[0.9]">El pitoniso<br />de la temporada</h2>
      {top.length ? (
        <ol className="space-y-2">
          {g.seers.slice(0, 8).map((r, i) => (
            <li key={r.user_id} className={`cap-pick flex items-center gap-3 rounded-2xl px-3 py-2.5 ${r.pos === 1 ? "bg-gradient-to-r from-dorado/40 to-dorado/10 ring-1 ring-dorado" : r.me ? "bg-white/10" : "bg-white/5"}`} style={{ animationDelay: `${0.3 + i * 0.15}s` }}>
              <span className="w-7 text-center text-xl">{MEDAL[r.pos - 1] ?? `${r.pos}º`}</span>
              <Avatar src={r.avatar} name={r.name} size={r.pos === 1 ? 44 : 32} />
              <span className="min-w-0 flex-1"><b className={`block truncate ${r.pos === 1 ? "sport text-2xl" : ""}`}>{r.name}{r.me ? " (tú)" : ""}</b>
                <span className="text-xs text-white/65">{r.hits} {r.hits === 1 ? "acierto" : "aciertos"}{r.closes ? ` · ${r.closes} cerca` : ""}</span></span>
              <span className="sport text-2xl font-black tabular-nums text-dorado">{r.points}<span className="text-xs text-white/60"> pts</span></span>
            </li>
          ))}
        </ol>
      ) : <p className="text-lg text-white/75">Nadie acertó nada. Ni una. Menos mal que esto no es la quiniela. 😅</p>}
    </div>
  );
}

/** Un mensaje, como una carta que sale del cofre. */
function MessageSlide({ m, n, total }: { m: GalaMessage; n: number; total: number }) {
  return (
    <div className="flex h-full flex-col justify-center gap-4">
      <p className="sport text-xs font-black tracking-[0.25em] text-dorado">MENSAJE {n} DE {total}{m.toMe ? " · 📬 PARA TI" : ""}</p>
      <article className="cap-letter capsule-note rounded-2xl p-5 text-negro shadow-2xl ring-1 ring-black/10">
        <p className="text-[11px] font-black uppercase tracking-wider text-rojo">
          {m.self ? `${m.from}, para sí mismo` : `Para ${m.to ?? "todo el equipo"}`}
        </p>
        <p className="mt-2 max-h-[46vh] overflow-y-auto whitespace-pre-wrap font-serif text-xl leading-relaxed">{m.body}</p>
        <p className="mt-4 flex items-center justify-end gap-2 text-sm font-bold">— {m.from}{m.mine ? " (tú)" : ""} <Avatar src={m.fromAvatar} name={m.from} size={28} /></p>
      </article>
    </div>
  );
}

function Outro({ g, onClose }: { g: Gala; onClose: () => void }) {
  return (
    <div className="cap-slide flex h-full flex-col items-center justify-center gap-5 text-center">
      <CapsuleVault state="open" size={120} />
      <h2 className="sport text-4xl font-black uppercase italic leading-none">Hasta la próxima<br />cápsula</h2>
      <p className="text-white/75">Todo lo de la cápsula {g.season} se queda guardado para volver a leerlo cuando queráis.</p>
      <button type="button" onClick={(e) => { e.stopPropagation(); onClose(); }} className="btn-primary">Ver todo</button>
    </div>
  );
}

/**
 * La gala de apertura de la cápsula: el cofre se abre, las predicciones contra la realidad,
 * el pitoniso de la temporada y los mensajes uno a uno. Se pasa tocando a la derecha (o con las flechas).
 */
export function CapsuleGala({ g, closeHref }: { g: Gala; closeHref: string }) {
  const router = useRouter();
  const slides = useMemo(() => {
    const out: { key: string; kind: "intro" | "q" | "seers" | "msg" | "outro"; i: number }[] = [{ key: "intro", kind: "intro", i: 0 }];
    g.questions.forEach((q, i) => out.push({ key: `q-${q.key}`, kind: "q", i }));
    if (g.questions.length) out.push({ key: "seers", kind: "seers", i: 0 });
    // Los mensajes para mí, al final (el mejor momento)
    const order = [...g.messages.keys()].sort((a, b) => Number(g.messages[a].toMe) - Number(g.messages[b].toMe));
    order.forEach((i) => out.push({ key: `m-${g.messages[i].id}`, kind: "msg", i }));
    out.push({ key: "outro", kind: "outro", i: 0 });
    return out;
  }, [g]);
  const [idx, setIdx] = useState(0);
  const stage = useRef<HTMLDivElement>(null);
  const close = useCallback(() => router.push(closeHref), [router, closeHref]);
  const go = useCallback((d: number) => setIdx((i) => Math.max(0, Math.min(slides.length - 1, i + d))), [slides.length]);

  useEffect(() => { stage.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); go(1); }
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close, go]);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const s = slides[idx];
  const msgN = slides.slice(0, idx + 1).filter((x) => x.kind === "msg").length;
  return (
    <div ref={stage} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="cap-gala-title" id="rv-capsule-gala"
      className="fc-stage fixed inset-0 z-[70] flex select-none flex-col overflow-hidden text-white outline-none"
      onClick={(e) => { const x = e.clientX / window.innerWidth; go(x < 0.3 ? -1 : 1); }}>
      <div aria-hidden className="fc-bg absolute inset-0" />
      <span aria-hidden className="md-light md-light-l" />
      <span aria-hidden className="md-light md-light-r" />

      <div className="relative z-20 flex gap-1 px-3 pt-[calc(env(safe-area-inset-top)+0.6rem)]">
        {slides.map((x, i) => <span key={x.key} className="cap-bar"><i style={{ width: i <= idx ? "100%" : "0%" }} /></span>)}
      </div>
      <button type="button" onClick={(e) => { e.stopPropagation(); close(); }} aria-label="Cerrar la gala"
        className="absolute right-3 top-[calc(env(safe-area-inset-top)+1.3rem)] z-30 rounded-full bg-black/40 p-2 text-white/75 ring-1 ring-white/15 hover:text-white">
        <X size={20} />
      </button>

      <div key={s.key} className="relative z-10 mx-auto w-full max-w-lg flex-1 overflow-hidden px-5 pb-[calc(env(safe-area-inset-bottom)+4.5rem)] pt-10">
        {s.kind === "intro" && <Intro g={g} active />}
        {s.kind === "q" && <QuestionSlide q={g.questions[s.i]} n={s.i + 1} total={g.questions.length} />}
        {s.kind === "seers" && <SeersSlide g={g} />}
        {s.kind === "msg" && <MessageSlide m={g.messages[s.i]} n={msgN} total={g.messages.length} />}
        {s.kind === "outro" && <Outro g={g} onClose={close} />}
      </div>

      <div className="absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-20 flex items-center justify-between px-4">
        <button type="button" onClick={(e) => { e.stopPropagation(); go(-1); }} disabled={idx === 0} aria-label="Anterior"
          className="rounded-full bg-white/10 p-3 ring-1 ring-white/15 disabled:opacity-30"><ChevronLeft size={22} /></button>
        <span className="text-xs font-bold text-white/55">{idx === 0 ? "Toca para seguir" : `${idx + 1} / ${slides.length}`}</span>
        <button type="button" onClick={(e) => { e.stopPropagation(); go(1); }} disabled={idx === slides.length - 1} aria-label="Siguiente"
          className="rounded-full bg-dorado p-3 text-negro disabled:opacity-30"><ChevronRight size={22} /></button>
      </div>
    </div>
  );
}
