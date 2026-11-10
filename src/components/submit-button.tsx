"use client";
import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pendingText = "Guardando…",
  className = "btn-primary w-full",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || rest.disabled} className={className} {...rest}>
      {pending ? (
        <>
          <span aria-hidden className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent" />
          {pendingText}
        </>
      ) : children}
    </button>
  );
}
