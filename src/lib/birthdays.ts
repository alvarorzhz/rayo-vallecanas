/**
 * Cumpleaños (v4.12.0): quién cumple hoy y quién cumple en los próximos días.
 * Solo se manejan día y mes (nunca el año). Cálculo puro, para poder probarlo.
 */

export type BirthdayRow = { player_id: string; month: number; day: number };

const leap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** Fecha del cumpleaños en ese año ("2026-03-07"). El 29 de febrero se celebra el 28 los años no bisiestos. */
export function birthdayIn(year: number, r: Pick<BirthdayRow, "month" | "day">) {
  const day = r.month === 2 && r.day === 29 && !leap(year) ? 28 : r.day;
  return `${year}-${String(r.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);

/**
 * @param today fecha de hoy en Madrid ("2026-11-14").
 * @param days cuántos días hacia delante se miran para «próximos».
 */
export function birthdays(rows: BirthdayRow[], today: string, days = 7) {
  const year = Number(today.slice(0, 4));
  const withNext = rows.map((r) => {
    let date = birthdayIn(year, r);
    if (date < today) date = birthdayIn(year + 1, r);
    return { ...r, date, inDays: dayDiff(today, date) };
  });
  return {
    today: withNext.filter((r) => r.inDays === 0),
    upcoming: withNext.filter((r) => r.inDays > 0 && r.inDays <= days).sort((a, b) => a.inDays - b.inDays),
  };
}

/** «mañana», «el sábado», «el sábado 21» (si cae a más de 6 días). */
export function whenLabel(date: string, inDays: number) {
  if (inDays === 1) return "mañana";
  const d = new Date(`${date}T12:00:00Z`);
  const wd = new Intl.DateTimeFormat("es-ES", { weekday: "long", timeZone: "UTC" }).format(d);
  return inDays <= 6 ? `el ${wd}` : `el ${wd} ${d.getUTCDate()}`;
}
