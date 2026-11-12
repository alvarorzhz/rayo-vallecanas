"use server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { runBackup } from "@/lib/backup";

export type BackupNowState = { ok?: string; error?: string } | undefined;

/** «Hacer copia ahora»: la misma copia que la automática de los lunes. */
export async function backupNow(): Promise<BackupNowState> {
  const s = await getSession();
  if (s.profile.role !== "superadmin") return { error: "Solo un superadministrador puede hacer copias" };
  const supabase = await createClient();
  await supabase.rpc("log_backup", { p_format: "copia guardada" });
  try {
    const r = await runBackup();
    revalidatePath("/admin/copia");
    return { ok: `Copia guardada en ${r.where === "blob" ? "Vercel Blob" : "Supabase"}: ${r.rows} registros de ${r.tables} tablas y ${r.files} ${r.files === 1 ? "archivo" : "archivos"}.` };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
