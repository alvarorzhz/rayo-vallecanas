"use client";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

/** 4.30.4 · Campo de contraseña con el botón del ojo para ver lo que se escribe. */
export function PasswordInput({ id, name, autoComplete, minLength }: { id: string; name: string; autoComplete: string; minLength?: number }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input id={id} name={name} type={show ? "text" : "password"} autoComplete={autoComplete} minLength={minLength} required
        autoCapitalize="none" autoCorrect="off" spellCheck={false} className="input pr-12" />
      <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Ocultar la contraseña" : "Ver la contraseña"} aria-pressed={show}
        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-negro/45 hover:text-rojo">
        {show ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
      </button>
    </div>
  );
}
