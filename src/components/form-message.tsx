export function FormMessage({ state }: { state?: { error?: string; ok?: string } }) {
  if (state?.error)
    return <p role="alert" className="rounded-lg bg-rojo/10 px-3 py-2 text-sm font-medium text-rojo">{state.error}</p>;
  if (state?.ok) return <p className="rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-800">{state.ok}</p>;
  return null;
}
