import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Cierra la sesión (las páginas no pueden borrar cookies) y vuelve al login con el motivo. */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  const error = request.nextUrl.searchParams.get("error");
  const url = new URL("/login", request.url);
  if (error && /^[a-z]+$/.test(error)) url.searchParams.set("error", error);
  return NextResponse.redirect(url);
}
