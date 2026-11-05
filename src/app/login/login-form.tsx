"use client";
import Link from "next/link";
import { useActionState } from "react";
import { signIn } from "./actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";

export function LoginForm({ next, error }: { next?: string; error?: string }) {
  const [state, action] = useActionState(signIn, error ? { error } : undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? "/"} />
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="input" />
      </div>
      <div>
        <label className="label" htmlFor="password">Contraseña</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText="Entrando…">Entrar</SubmitButton>
      <Link href="/auth/recuperar" className="block text-center text-sm text-negro/60 hover:text-rojo">
        ¿Has olvidado la contraseña?
      </Link>
    </form>
  );
}
