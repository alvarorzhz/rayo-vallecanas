import { Clock, EyeOff, Lock, Users, Vote } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { PollAdminActions, VoteButtons } from "@/components/polls/poll-forms";
import { LiveRefresh } from "@/components/polls/live-refresh";
import { closePoll, deletePoll, remindPoll, setPollLive, votePoll } from "@/app/(app)/votaciones/actions";
import { AUDIENCE_LABEL, OUTCOME_LABEL, ago, results, timeLeft, type Poll } from "@/lib/polls";
import { fecha } from "@/lib/format";

/** Barra de resultados: verde el sí, rojo el no. */
function ResultBar({ p, dark = false }: { p: Poll; dark?: boolean }) {
  const r = results(p);
  return (
    <div className="space-y-1.5">
      <div className={`flex h-3 overflow-hidden rounded-full ${dark ? "bg-white/15" : "bg-gris"}`} role="img" aria-label={`Sí ${r.yesPct} %, no ${r.noPct} %`}>
        {r.votes > 0 && <span className="bg-emerald-500 transition-all" style={{ width: `${r.yesPct}%` }} />}
        {r.votes > 0 && <span className="bg-rojo transition-all" style={{ width: `${r.noPct}%` }} />}
      </div>
      <div className={`flex justify-between text-sm font-bold ${dark ? "text-white" : ""}`}>
        <span>✅ Sí · {p.yes} <span className="font-normal opacity-70">({r.yesPct} %)</span></span>
        <span>❌ No · {p.no} <span className="font-normal opacity-70">({r.noPct} %)</span></span>
      </div>
    </div>
  );
}

/** Punto rojo que late + «En directo». */
function LiveBadge() {
  return (
    <span className="badge gap-1.5 bg-rojo text-white">
      <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-75" /><span className="relative inline-flex size-2 rounded-full bg-white" /></span>
      En directo
    </span>
  );
}

/** «Último voto: Javi, SÍ · hace 3 min» (votaciones en directo). */
function LastVote({ p }: { p: Poll }) {
  const v = p.voters?.[0];
  if (!v?.voted_at) return null;
  return (
    <p className="text-xs text-white/80">
      Último voto: <b className="text-white">{v.name}</b>, {v.vote ? "✅ SÍ" : "❌ NO"} · {ago(v.voted_at)}
    </p>
  );
}

function Voters({ p, dark = false }: { p: Poll; dark?: boolean }) {
  if (!p.voters?.length && !p.missing?.length) return null;
  const chip = dark ? "bg-white/10 text-white" : "bg-gris";
  const group = (title: string, names: { name: string; avatar_url: string | null; voted_at?: string }[]) =>
    names.length ? (
      <div>
        <h4 className={`mb-1.5 text-xs font-bold uppercase tracking-wider ${dark ? "text-white/70" : "text-negro/65"}`}>{title} · {names.length}</h4>
        <ul className="flex flex-wrap gap-1.5">
          {names.map((v) => (
            <li key={v.name} title={"voted_at" in v && v.voted_at ? `Votó ${ago(v.voted_at)}` : undefined}
              className={`flex items-center gap-1.5 rounded-full py-0.5 pr-2.5 pl-0.5 text-xs font-semibold ${chip}`}>
              <Avatar name={v.name} url={v.avatar_url} size={20} /> {v.name}
            </li>
          ))}
        </ul>
      </div>
    ) : null;
  return (
    <details className="group" open={p.open && p.live}>
      <summary className={`cursor-pointer text-sm font-bold ${dark ? "text-dorado" : "text-rojo"}`}>Ver quién ha votado</summary>
      <div className="mt-3 space-y-3">
        {group("✅ Sí", (p.voters ?? []).filter((v) => v.vote))}
        {group("❌ No", (p.voters ?? []).filter((v) => !v.vote))}
        {group("Sin votar", (p.missing ?? []).map((name) => ({ name, avatar_url: null })))}
      </div>
    </details>
  );
}

/**
 * Tarjeta de una votación. Abierta: en negro con los botones para votar. El recuento y los votos
 * se ven si es «en directo» (4.29.1); si no, salen al cerrar (quien gestiona ve el recuento).
 * Lo que se puede ver lo decide poll_board() en la base de datos. Cerrada: el resultado.
 */
export function PollCard({ p, canManage, compact = false }: { p: Poll; canManage: boolean; compact?: boolean }) {
  const r = results(p);
  const showTally = r.tally;
  const meta = (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="flex items-center gap-1"><Users size={13} /> {AUDIENCE_LABEL[p.audience]}</span>
      {p.anonymous && <span className="flex items-center gap-1"><Lock size={13} /> Voto secreto</span>}
      <span>Han votado {r.votes} de {p.eligible}</span>
    </span>
  );

  if (p.open) {
    return (
      <article id={p.id} className="franja relative scroll-mt-24 overflow-hidden rounded-2xl bg-negro p-4 text-white shadow-lg sm:p-5">
        <div className="relative space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.15em] text-dorado"><Vote size={15} /> Votación</span>
            <span className="flex flex-wrap items-center justify-end gap-1.5">
              {p.live && <LiveBadge />}
              <span className="badge bg-dorado text-negro"><Clock size={12} /> {timeLeft(p.closes_at)}</span>
            </span>
          </div>
          <h3 className="sport text-2xl leading-tight font-black">{p.question}</h3>
          {p.details && !compact && <p className="whitespace-pre-line text-sm text-white/80">{p.details}</p>}
          {p.can_vote && <VoteButtons action={votePoll.bind(null, p.id)} mine={p.my_vote} dark />}
          {showTally && <ResultBar p={p} dark />}
          {p.live && !p.anonymous && <LastVote p={p} />}
          {!p.live && (
            <p className="flex items-center gap-1.5 text-xs text-white/70">
              <EyeOff size={13} /> {canManage ? "El resultado y quién ha votado qué se ven al cerrar. El recuento solo lo ves tú, como gestor." : "El resultado se verá al cerrar la votación."}
            </p>
          )}
          <div className="text-xs text-white/70">{meta}</div>
          {p.live && <LiveRefresh />}
          {!compact && <Voters p={p} dark />}
          {!compact && canManage && (
            <div className="rounded-xl bg-white p-2 text-negro">
              <PollAdminActions open live={p.live} toggleLive={setPollLive.bind(null, p.id)}
                remind={remindPoll.bind(null, p.id)} close={closePoll.bind(null, p.id)} remove={deletePoll.bind(null, p.id)}
                missing={p.missing ? p.missing.length : Math.max(0, p.eligible - r.votes)} />
            </div>
          )}
          {!compact && <p className="text-xs text-white/60">Se cierra el {fecha(p.closes_at, true)}{p.created_by_name ? ` · La lanzó ${p.created_by_name}` : ""}</p>}
        </div>
      </article>
    );
  }

  const tone = r.outcome === "yes" ? "bg-emerald-100 text-emerald-800" : r.outcome === "no" ? "bg-rojo/10 text-rojo" : "bg-gris text-negro/70";
  return (
    <article id={p.id} className="card scroll-mt-24 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-negro/60"><Vote size={14} /> Votación cerrada · {fecha(p.closes_at)}</span>
        <span className={`badge ${tone}`}>{OUTCOME_LABEL[r.outcome]}</span>
      </div>
      <h3 className="text-lg leading-snug font-black">{p.question}</h3>
      {p.details && !compact && <p className="whitespace-pre-line text-sm text-negro/70">{p.details}</p>}
      <ResultBar p={p} />
      <div className="text-xs text-negro/65">{meta}{p.my_vote !== null && <span className="mt-1 block">Tu voto: <b>{p.my_vote ? "Sí" : "No"}</b></span>}</div>
      {!compact && <Voters p={p} />}
      {!compact && (
        <div className="flex flex-wrap items-start gap-2">
          {canManage && <PollAdminActions open={false} remind={remindPoll.bind(null, p.id)} close={closePoll.bind(null, p.id)} remove={deletePoll.bind(null, p.id)} missing={0} />}
        </div>
      )}
    </article>
  );
}
