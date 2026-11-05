import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "./login-form";

export const metadata = { title: "Iniciar sesión" };

const ERRORS: Record<string, string> = {
  inactivo: "Tu acceso a la app está deshabilitado. Habla con la directiva.",
  enlace: "El enlace no es válido o ha caducado. Solicita uno nuevo.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <AuthShell title="RAYO VALLECAÑAS" subtitle="Plataforma de gestión del equipo">
      <LoginForm next={next} error={error ? ERRORS[error] : undefined} />
    </AuthShell>
  );
}
