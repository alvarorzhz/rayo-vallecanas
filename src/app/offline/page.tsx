import Image from "next/image";

export const metadata = { title: "Sin conexión" };

export default function Offline() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-negro p-6 text-center text-white">
      <Image src="/escudo.png" alt="Rayo Vallecañas" width={96} height={114} priority />
      <h1 className="text-2xl font-black">Sin conexión</h1>
      <p className="max-w-sm text-white/70">
        Puedes consultar las pantallas que ya habías abierto. Para registrar ventas o cobros necesitas conexión, así
        evitamos duplicados.
      </p>
    </main>
  );
}
