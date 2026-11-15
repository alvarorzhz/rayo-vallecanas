import Link from "next/link";
import { redirect } from "next/navigation";
import { BellRing, Smartphone, Monitor, Tablet } from "lucide-react";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { madridDay } from "@/lib/dates";
import { fecha, ultimaConexion } from "@/lib/format";
import { AREA_BY_KEY, areaStats, dailyPeople, personStats, type UsageGroup, type UsageRow } from "@/lib/usage";
import { Empty, PageHeader, Stat } from "@/components/ui";

export const metadata = { title: "Uso de la app" };

const PERIODS = [7, 30, 90] as const;
const GROUP_TONE: Record<UsageGroup, string> = {
  Inicio: "bg-rojo", Partidos: "bg-rojo", Plantilla: "bg-dorado", "La Voz": "bg-negro", Sorteos: "bg-dorado", Finanzas: "bg-green-700", Gestión: "bg-negro/60", Otros: "bg-negro/40",
};

type Activity = { user_id: string; last_seen_at: string; device: string | null; installed: boolean | null };

/** PostgREST devuelve como mucho 1000 filas: pide de 1000 en 1000. */
async function all<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<{ data: T[]; error: unknown }> {
  const out: T[] = [];
  for (let from = 0; from < 50_000; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error) return { data: out, error };
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return { data: out, error: null };
}

export default async function UsagePage({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const sp = await searchParams;
  const s = await getSession();
  if (s.profile.role !== "superadmin") redirect("/?error=permiso");
  const days = PERIODS.find((p) => String(p) === sp.d) ?? 30;
  const today = madridDay();
  const fromDay = madridDay(new Date(Date.now() - (days - 1) * 86400_000));
  const fromTs = `${fromDay}T00:00:00+01:00`;

  const supabase = await createClient();
  const admin = createAdminClient();
  const [usage, { data: activity }, { data: people }, { data: subs }, callups, mvp, porra, ratings, polls, reactions, wishes, interviews] = await Promise.all([
    all<UsageRow>((a, b) => supabase.from("usage_daily").select("day, user_id, area, hits").gte("day", fromDay).order("day").range(a, b)),
    supabase.from("user_activity").select("user_id, last_seen_at, device, installed"),
    supabase.from("member_directory").select("id, full_name, active").order("full_name"),
    admin.from("push_subscriptions").select("user_id"),
    all<{ u: string }>((a, b) => admin.from("match_callups").select("u:replied_by").not("replied_by", "is", null).neq("reply", "pending").gte("replied_at", fromTs).range(a, b)),
    all<{ u: string }>((a, b) => admin.from("mvp_votes").select("u:voter_id").gte("voted_at", fromTs).range(a, b)),
    all<{ u: string }>((a, b) => admin.from("match_predictions").select("u:user_id").gte("created_at", fromTs).range(a, b)),
    all<{ u: string; m: string }>((a, b) => admin.from("player_ratings").select("u:voter_id, m:match_id").gte("rated_at", fromTs).range(a, b)),
    all<{ u: string }>((a, b) => admin.from("poll_votes").select("u:user_id").gte("voted_at", fromTs).range(a, b)),
    all<{ u: string }>((a, b) => admin.from("news_reactions").select("u:user_id").gte("created_at", fromTs).range(a, b)),
    all<{ u: string }>((a, b) => admin.from("birthday_wishes").select("u:user_id").gte("created_at", fromTs).range(a, b)),
    admin.from("news_interviews").select("id", { count: "exact", head: true }).eq("status", "answered").gte("answered_at", fromTs),
  ]);

  const ready = !usage.error;
  const rows = usage.data;
  const members = (people ?? []).filter((p) => p.active);
  const names = new Map((people ?? []).map((p) => [p.id, p.full_name]));
  const act = new Map(((activity ?? []) as Activity[]).map((a) => [a.user_id, a]));
  const withPush = new Set((subs ?? []).map((r) => r.user_id));
  const perPerson = personStats(rows);
  const areas = areaStats(rows);
  const used = areas.filter((a) => a.hits > 0);
  const unused = areas.filter((a) => a.hits === 0);
  const maxPeople = Math.max(1, ...used.map((a) => a.people));
  const daily = dailyPeople(rows, today, days);
  const maxDaily = Math.max(1, ...daily.map((d) => d.people));
  const activeIds = new Set(rows.map((r) => r.user_id));
  const avgDaily = daily.reduce((n, d) => n + d.people, 0) / daily.length;
  const installed = members.filter((m) => act.get(m.id)?.installed).length;
  const knownDevice = members.filter((m) => act.get(m.id)?.installed != null).length;

  const count = (r: { data: { u: string }[] }) => ({ n: r.data.length, people: new Set(r.data.map((x) => x.u)).size });
  const ratingSessions = new Set(ratings.data.map((r) => `${r.u}|${r.m}`)).size;
  const actions = [
    { label: "Respuestas a convocatorias", ...count(callups) },
    { label: "Votos al MVP", ...count(mvp) },
    { label: "Notas puestas (por partido)", n: ratingSessions, people: new Set(ratings.data.map((r) => r.u)).size },
    { label: "Apuestas en la porra", ...count(porra) },
    { label: "Votos en votaciones", ...count(polls) },
    { label: "Reacciones en La Voz", ...count(reactions) },
    { label: "Felicitaciones de cumpleaños", ...count(wishes) },
    { label: "Entrevistas contestadas", n: interviews.count ?? 0, people: null as number | null },
  ];

  const ranking = members
    .map((m) => ({ ...m, stat: perPerson.get(m.id), act: act.get(m.id) }))
    .sort((a, b) => (b.stat?.days ?? 0) - (a.stat?.days ?? 0) || (b.stat?.hits ?? 0) - (a.stat?.hits ?? 0) || a.full_name.localeCompare(b.full_name, "es"));

  return (
    <>
      <PageHeader title="Uso de la app" subtitle="Qué pantallas abre el equipo y quién entra. Sirve para saber qué se usa de verdad y qué sobra." />

      <nav aria-label="Periodo" className="mb-4 flex w-full gap-1 rounded-xl bg-black/5 p-1 text-sm font-bold sm:w-max">
        {PERIODS.map((p) => (
          <Link key={p} href={`?d=${p}`} prefetch aria-current={p === days ? "page" : undefined}
            className={`flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-center transition sm:flex-none ${p === days ? "bg-white text-negro shadow" : "text-negro/60 hover:text-rojo"}`}>
            Últimos {p} días
          </Link>
        ))}
      </nav>

      {!ready ? (
        <div className="card text-sm text-negro/70">El registro de uso todavía no está activado en la base de datos. Hay que ejecutar el SQL de la versión 4.16.0.</div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat tone="dark" label="Han entrado" value={activeIds.size} hint={`de ${members.length} con acceso`} />
            <Stat label="Al día, de media" value={avgDaily.toLocaleString("es-ES", { maximumFractionDigits: 1 })} hint="personas distintas" />
            <Stat tone="gold" label="App instalada" value={installed} hint={knownDevice < members.length ? `de ${knownDevice} que ya han entrado` : `de ${members.length}`} />
            <Stat label="Con avisos" value={members.filter((m) => withPush.has(m.id)).length} hint={`de ${members.length}`} />
          </div>

          {rows.length === 0 && (
            <div className="mb-4">
              <Empty>Todavía no hay datos: el uso se empieza a contar desde la versión 4.16.0. Vuelve en unos días.</Empty>
            </div>
          )}

          {rows.length > 0 && (
            <section className="card mb-4">
              <h2 className="h2 mb-3">Personas cada día</h2>
              <div className="flex h-28 items-end gap-[2px]" role="img" aria-label={`Personas que entraron cada día, máximo ${maxDaily}`}>
                {daily.map((d) => (
                  <div key={d.day} title={`${fecha(d.day)}: ${d.people}`} className="flex h-full min-w-0 flex-1 flex-col justify-end">
                    <div className={`rounded-t-sm ${d.people ? "bg-rojo" : "bg-black/10"}`} style={{ height: `${Math.max(3, (d.people / maxDaily) * 100)}%` }} />
                  </div>
                ))}
              </div>
              <div className="mt-1 flex justify-between text-[11px] text-negro/55">
                <span>{fecha(daily[0].day)}</span>
                <span>Máximo: {maxDaily} {maxDaily === 1 ? "persona" : "personas"}</span>
                <span>Hoy</span>
              </div>
            </section>
          )}

          <div className="mb-4 grid gap-4 lg:grid-cols-2">
            <section className="card">
              <h2 className="h2">Pantallas más usadas</h2>
              <p className="mb-3 text-xs text-negro/60">Cuántas personas distintas la han abierto y cuántas veces en total.</p>
              {used.length === 0 ? <p className="text-sm text-negro/60">Aún nada.</p> : (
                <ul className="space-y-2 text-sm">
                  {used.map((a) => (
                    <li key={a.key}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate font-semibold">{a.label} <span className="text-xs font-normal text-negro/50">· {a.group}</span></span>
                        <span className="shrink-0 tabular-nums text-xs text-negro/65"><b className="text-negro">{a.people}</b> {a.people === 1 ? "persona" : "personas"} · {a.hits} {a.hits === 1 ? "vez" : "veces"}</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/5">
                        <div className={`h-full rounded-full ${GROUP_TONE[a.group]}`} style={{ width: `${(a.people / maxPeople) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="space-y-4">
              <section className="card">
                <h2 className="h2">Participación</h2>
                <p className="mb-3 text-xs text-negro/60">Lo que ha hecho el equipo en estos días (sale de los datos que ya guarda la app).</p>
                <ul className="divide-y divide-black/5 text-sm">
                  {actions.map((x) => (
                    <li key={x.label} className="flex items-baseline justify-between gap-3 py-1.5">
                      <span className={x.n ? "font-semibold" : "text-negro/55"}>{x.label}</span>
                      <span className="shrink-0 tabular-nums text-xs text-negro/65">
                        <b className="text-negro">{x.n}</b>{x.people != null && x.n > 0 && ` · ${x.people} ${x.people === 1 ? "persona" : "personas"}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>

              {rows.length > 0 && unused.length > 0 && (
                <section className="card">
                  <h2 className="h2">Nadie la ha abierto</h2>
                  <p className="mb-3 text-xs text-negro/60">En los últimos {days} días. Candidatas a quitar o a esconder (algunas solo las usa la directiva de vez en cuando).</p>
                  <div className="flex flex-wrap gap-1.5">
                    {unused.map((a) => <span key={a.key} className="badge bg-black/5 text-negro/70">{a.label}</span>)}
                  </div>
                </section>
              )}
            </div>
          </div>

          <section className="card ledger">
            <h2 className="h2">Cada persona</h2>
            <p className="mb-3 text-xs text-negro/60">Días que ha entrado, pantallas abiertas y la que más usa (sin contar Inicio).</p>
            <ul className="divide-y divide-black/5 text-sm">
              {ranking.map((p) => {
                const Device = p.act?.device === "ordenador" ? Monitor : p.act?.device === "tablet" ? Tablet : Smartphone;
                return (
                  <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2.5">
                    <div className="min-w-0">
                      <b>{p.full_name}</b>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-negro/60">
                        {p.stat ? (
                          <>
                            <span>{p.stat.days} {p.stat.days === 1 ? "día" : "días"} · {p.stat.hits} {p.stat.hits === 1 ? "pantalla" : "pantallas"}</span>
                            {p.stat.top && <span>Lo que más: {AREA_BY_KEY.get(p.stat.top)?.label ?? p.stat.top}</span>}
                          </>
                        ) : <span>No ha entrado en estos días</span>}
                        {p.act?.device && (
                          <span className="inline-flex items-center gap-1"><Device size={12} /> {p.act.installed ? "App instalada" : "Navegador"}</span>
                        )}
                        {withPush.has(p.id) && <span className="inline-flex items-center gap-1"><BellRing size={12} /> Avisos</span>}
                      </div>
                    </div>
                    <span className="shrink-0 text-xs text-negro/60">{p.act ? ultimaConexion(p.act.last_seen_at) : "Nunca ha entrado"}</span>
                  </li>
                );
              })}
            </ul>
          </section>
          <p className="mt-3 text-center text-xs text-negro/50">Se guarda una cuenta por persona, pantalla y día, durante un año. Solo lo ve el superadministrador.</p>
        </>
      )}
    </>
  );
}
