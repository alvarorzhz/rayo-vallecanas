"use client";
import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pendingText = "Guardando…",
  className = "btn-primary w-full",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  // El «disabled» va después de {...rest}: si no, el de fuera pisaba al de «enviando» y se podía pulsar dos veces
  return (
    <button type="submit" className={className} {...rest} disabled={pending || rest.disabled}>
      {pending ? (
        <>
          <span aria-hidden className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent" />
          {pendingText}
        </>
      ) : children}
    </button>
  );
}
