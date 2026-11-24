"use client";
import Link from "next/link";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth-shell";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { PasswordInput } from "@/components/password-input";
import { setPassword } from "@/app/login/actions";

function NewPasswordForm() {
  const provisional = useSearchParams().get("provisional") === "1";
  const [state, action] = useActionState(setPassword, undefined);
  return (
    <AuthShell title="Crea tu contraseña" subtitle="Mínimo 10 caracteres, con letras y números">
      {provisional && (
        <p className="mb-4 rounded-xl bg-dorado/15 px-3 py-2 text-sm text-negro/80">
          Has entrado con una contraseña provisional. Elige ahora la tuya para seguir.
        </p>
      )}
      <form action={action} className="space-y-4">
        <div>
          <label className="label" htmlFor="password">Nueva contraseña</label>
          <PasswordInput id="password" name="password" minLength={10} autoComplete="new-password" />
        </div>
        <div>
          <label className="label" htmlFor="confirm">Repítela</label>
          <PasswordInput id="confirm" name="confirm" minLength={10} autoComplete="new-password" />
        </div>
        <FormMessage state={state} />
        <SubmitButton>Guardar y entrar</SubmitButton>
        {state?.error?.includes("enlace") && (
          <Link href="/auth/recuperar" className="block text-center text-sm font-bold text-rojo">Pedir otro enlace</Link>
        )}
      </form>
    </AuthShell>
  );
}

export default function NewPasswordPage() {
  return (
    <Suspense>
      <NewPasswordForm />
    </Suspense>
  );
}
