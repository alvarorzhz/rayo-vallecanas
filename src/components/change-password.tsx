"use client";
import { useActionState, useEffect, useRef } from "react";
import { KeyRound } from "lucide-react";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { PasswordInput } from "@/components/password-input";
import { changePassword } from "@/app/login/actions";

/** 4.30.4 · Cambiar la contraseña desde Mi perfil (plegado hasta que se abre). */
export function ChangePassword({ email }: { email: string | null }) {
  const [state, action] = useActionState(changePassword, undefined);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) form.current?.reset();
  }, [state]);
  return (
    <details className="card group" open={Boolean(state)}>
      <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
        <KeyRound size={22} className="text-rojo" aria-hidden />
        <span className="flex-1">
          <span className="block font-bold">Cambiar mi contraseña</span>
          <span className="block text-xs text-negro/65">Mínimo 10 caracteres, con letras y números</span>
        </span>
        <span className="text-rojo transition-transform duration-200 group-open:rotate-90">→</span>
      </summary>
      <form ref={form} action={action} className="mt-4 space-y-3">
        {/* Para que el gestor de contraseñas del móvil sepa de qué cuenta es */}
        <input type="text" name="username" autoComplete="username" value={email ?? ""} hidden readOnly />
        <div>
          <label className="label" htmlFor="current">Contraseña actual</label>
          <PasswordInput id="current" name="current" autoComplete="current-password" />
        </div>
        <div>
          <label className="label" htmlFor="new-password">Nueva contraseña</label>
          <PasswordInput id="new-password" name="password" minLength={10} autoComplete="new-password" />
        </div>
        <div>
          <label className="label" htmlFor="confirm-password">Repite la nueva</label>
          <PasswordInput id="confirm-password" name="confirm" minLength={10} autoComplete="new-password" />
        </div>
        <FormMessage state={state} />
        <SubmitButton pendingText="Cambiando…">Cambiar contraseña</SubmitButton>
        <p className="text-xs text-negro/55">¿No te acuerdas de la actual? Sal de la app y pulsa «¿Has olvidado la contraseña?».</p>
      </form>
    </details>
  );
}
