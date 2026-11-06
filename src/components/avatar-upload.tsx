"use client";
import { useRef, useState, useTransition } from "react";
import { Camera, Trash2 } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { FormMessage } from "@/components/form-message";
import type { AvatarState } from "@/app/(app)/perfil/actions";

/** Recorta la foto en cuadrado y la reduce a 400 px antes de subirla (las del móvil pesan varios MB). */
async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const size = Math.min(400, side);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  canvas.getContext("2d")!.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, size, size);
  return new Promise((ok, ko) => canvas.toBlob((b) => (b ? ok(b) : ko(new Error("No se pudo procesar la foto"))), "image/jpeg", 0.85));
}

export function AvatarUpload({
  name,
  url,
  upload,
  remove,
}: {
  name: string;
  url: string | null;
  upload: (s: AvatarState, f: FormData) => Promise<AvatarState>;
  remove: () => Promise<AvatarState>;
}) {
  const [state, setState] = useState<AvatarState>();
  const [preview, setPreview] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    start(async () => {
      try {
        const blob = await shrink(file);
        setPreview(URL.createObjectURL(blob));
        const fd = new FormData();
        fd.append("avatar", new File([blob], "foto.jpg", { type: "image/jpeg" }));
        const r = await upload(undefined, fd);
        setState(r);
        if (r?.error) setPreview(null);
      } catch {
        setState({ error: "No se pudo leer la foto. Prueba con otra." });
        setPreview(null);
      }
    });
  }

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <button type="button" onClick={() => input.current?.click()} disabled={pending}
        className="group relative rounded-full focus:outline-none focus-visible:ring-4 focus-visible:ring-rojo/40" aria-label="Cambiar foto">
        <Avatar name={name} url={preview ?? url} size={128} className={pending ? "opacity-50" : ""} />
        <span className="absolute bottom-1 right-1 rounded-full bg-negro p-2 text-white shadow-lg transition group-hover:bg-rojo">
          <Camera size={18} />
        </span>
      </button>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={onPick} />
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" className="btn-primary" disabled={pending} onClick={() => input.current?.click()}>
          <Camera size={16} /> {pending ? "Subiendo…" : url || preview ? "Cambiar foto" : "Subir foto"}
        </button>
        {(url || preview) && (
          <button type="button" className="btn-ghost" disabled={pending}
            onClick={() => start(async () => { setState(await remove()); setPreview(null); })}>
            <Trash2 size={16} /> Quitar
          </button>
        )}
      </div>
      <p className="text-xs text-negro/65">Puedes hacer una foto con el móvil o elegir una de la galería. Se recorta en cuadrado.</p>
      <FormMessage state={state} />
    </div>
  );
}
