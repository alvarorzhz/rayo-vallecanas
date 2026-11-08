import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { RafflePublic } from "@/lib/lottery/public";

export const loadPublicRaffle = cache(async (slug: string) => {
  if (!/^[a-z0-9-]{4,60}$/.test(slug)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("raffle_public", { p_slug: slug });
  if (error || !data) return null;
  return data as RafflePublic;
});
