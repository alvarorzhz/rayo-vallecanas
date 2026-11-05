"use client";
import { useActionState } from "react";
import { AuthShell } from "@/components/auth-shell";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { setPassword } from "@/app/login/actions";

export default function NewPasswordPage() {
  const [state, action] = useActionState(setPassword, undefined);
  return (
    <AuthShell title="Crea tu contraseña" subtitle="Mínimo 10 caracteres, con letras y números">
      <form action={action} className="space-y-4">
        <div>
          <label className="label" htmlFor="password">Nueva contraseña</label>
          <input id="password" name="password" type="password" minLength={10} required className="input" autoComplete="new-password" />
        </div>
        <div>
          <label className="label" htmlFor="confirm">Repítela</label>
          <input id="confirm" name="confirm" type="password" minLength={10} required className="input" autoComplete="new-password" />
        </div>
        <FormMessage state={state} />
        <SubmitButton>Guardar y entrar</SubmitButton>
      </form>
    </AuthShell>
  );
}
