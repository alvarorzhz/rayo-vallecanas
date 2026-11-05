"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/session";

export type AvatarState = { error?: string; ok?: string } | undefined;

const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export async function uploadAvatar(_: AvatarState, form: FormData): Promise<AvatarState> {
  const s = await getSession();
  const file = form.get("avatar");
  if (!(file instanceof File) || file.size === 0) return { error: "Elige una foto" };
  const ext = TYPES[file.type];
  if (!ext) return { error: "La foto debe ser JPG, PNG o WEBP" };
  if (file.size > 1024 * 1024) return { error: "La foto es demasiado grande (máximo 1 MB)" };

  const supabase = await createClient();
  const path = `${s.user.id}/foto-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("avatars").upload(path, file, { contentType: file.type, upsert: true });
  if (error) return { error: "No se pudo subir la foto: " + error.message };
  const url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;

  const { error: e2 } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", s.user.id);
  if (e2) return { error: "No se pudo guardar la foto: " + e2.message };
  await removeOld(supabase, s.user.id, path);
  revalidatePath("/", "layout");
  return { ok: "¡Foto actualizada!" };
}

export async function removeAvatar(): Promise<AvatarState> {
  const s = await getSession();
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", s.user.id);
  if (error) return { error: error.message };
  await removeOld(supabase, s.user.id);
  revalidatePath("/", "layout");
  return { ok: "Foto quitada" };
}

async function removeOld(supabase: Awaited<ReturnType<typeof createClient>>, uid: string, keep?: string) {
  const { data } = await supabase.storage.from("avatars").list(uid);
  const old = (data ?? []).map((f) => `${uid}/${f.name}`).filter((p) => p !== keep);
  if (old.length) await supabase.storage.from("avatars").remove(old);
}
