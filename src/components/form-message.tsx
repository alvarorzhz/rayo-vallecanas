import { CircleAlert, CircleCheck } from "lucide-react";

export function FormMessage({ state }: { state?: { error?: string; ok?: string } }) {
  if (state?.error)
    return (
      <p role="alert" className="flash flex items-start gap-2 rounded-xl bg-rojo/10 px-3 py-2 text-sm font-medium text-rojo ring-1 ring-rojo/15">
        <CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden /> <span>{state.error}</span>
      </p>
    );
  if (state?.ok)
    return (
      <p className="flash flex items-start gap-2 rounded-xl bg-green-50 px-3 py-2 text-sm font-medium text-green-800 ring-1 ring-green-600/15">
        <CircleCheck size={16} className="mt-0.5 shrink-0" aria-hidden /> <span>{state.ok}</span>
      </p>
    );
  return null;
}
