"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { LifeBuoy } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { requestHelp, requestReset } from "@/app/login/actions";

export default function RecoverPage() {
  const [email, setEmail] = useState("");
  const [state, action] = useActionState(requestReset, undefined);
  const [help, helpAction] = useActionState(requestHelp, undefined);
  return (
    <AuthShell title="Recuperar acceso" subtitle="Te mandamos un enlace por email">
      <form action={action} className="space-y-4">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" inputMode="email" required className="input" autoComplete="email"
            autoCapitalize="none" autoCorrect="off" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <FormMessage state={state} />
        <SubmitButton pendingText="Enviando…">Enviar enlace</SubmitButton>
      </form>
      {/* 4.30.4 · Si el correo no llega, un gestor le da una contraseña provisional por WhatsApp */}
      <form action={helpAction} className="mt-5 space-y-3 border-t border-negro/10 pt-4">
        <input type="hidden" name="email" value={email} />
        <p className="text-sm text-negro/65">¿No te llega el correo o no te acuerdas de tu email? Avisamos a los gestores y te mandan una contraseña provisional.</p>
        <FormMessage state={help} />
        <SubmitButton className="btn-ghost w-full" pendingText="Avisando…" disabled={!email.includes("@")}>
          <LifeBuoy size={16} className="text-rojo" aria-hidden /> Avisar a un gestor
        </SubmitButton>
        {!email.includes("@") && <p className="text-center text-xs text-negro/50">Escribe arriba tu email para poder avisar.</p>}
      </form>
      <Link href="/login" className="mt-4 block text-center text-sm text-negro/60 hover:text-rojo">Volver</Link>
    </AuthShell>
  );
}
