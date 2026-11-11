"use client";
import { useState, useTransition } from "react";
import { Mic, Save, Send } from "lucide-react";
import { FormMessage } from "@/components/form-message";
import { MAX_ANSWER, NEWS_NAME, type InterviewQA, type InterviewStatus } from "@/lib/news";
import type { InterviewState } from "@/app/(app)/la-voz/actions";

type Props = {
  action: (answers: string[], submit: boolean) => Promise<InterviewState>;
  name: string;
  photo: string | null;
  questions: InterviewQA[];
  status: InterviewStatus;
  /** false: la ve alguien de la redacción, que no puede contestar por él. */
  mine: boolean;
};

export function InterviewAnswers({ action, name, photo, questions, status: initial, mine }: Props) {
  const [answers, setAnswers] = useState(questions.map((x) => x.a ?? ""));
  const [status, setStatus] = useState(initial);
  const [msg, setMsg] = useState<InterviewState>();
  const [pending, start] = useTransition();
  const locked = status === "answered" || !mine;
  const done = answers.filter((x) => x.trim()).length;

  const save = (submit: boolean) => {
    if (submit && done < questions.length && !confirm(`Te quedan ${questions.length - done} sin contestar. ¿La entregas así? Después ya no podrás cambiarla.`)) return;
    if (submit && done === questions.length && !confirm("¿Entregar la entrevista? Después ya no podrás cambiar las respuestas.")) return;
    start(async () => {
      const r = await action(answers, submit);
      setMsg(r);
      if (r?.status) setStatus(r.status);
    });
  };

  return (
    <div className="space-y-4">
      <section className="paper relative overflow-hidden rounded-2xl p-5 shadow-sm ring-1 ring-black/10">
        <div className="flex items-center gap-4">
          {photo
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={photo} alt="" className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-dorado" />
            : <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-negro text-dorado ring-2 ring-dorado"><Mic size={26} /></span>}
          <div className="min-w-0">
            <p className="news-head text-xs font-bold uppercase tracking-[0.2em] text-rojo">{NEWS_NAME} · Entrevista</p>
            <h2 className="news-head text-2xl font-black leading-tight">{mine ? `Hola, ${name}` : `Entrevista a ${name}`}</h2>
          </div>
        </div>
        <p className="news-body mt-3 text-[#141210]/80">
          {!mine
            ? "Así la ve el jugador. Solo él puede contestarla."
            : status === "answered"
              ? "Ya la entregaste. La redacción la está preparando y te llegará un aviso cuando salga publicada. ¡Gracias!"
              : "Contesta como si hablaras en el vestuario: con tus palabras, sin prisa. Puedes guardar y seguir otro día. Las respuestas solo salen en el periódico cuando la redacción la publique."}
        </p>
      </section>

      <ol className="space-y-3">
        {questions.map((x, i) => (
          <li key={i} className="card rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <label htmlFor={`a-${i}`} className="news-head flex gap-2 text-lg font-bold leading-snug">
              <span className="sport shrink-0 text-rojo">{i + 1}.</span> <span>{x.q}</span>
            </label>
            {locked ? (
              <p className={`news-body mt-2 whitespace-pre-line ${answers[i]?.trim() ? "text-negro/80" : "italic text-negro/45"}`}>{answers[i]?.trim() || "Sin contestar"}</p>
            ) : (
              <textarea id={`a-${i}`} rows={3} maxLength={MAX_ANSWER} value={answers[i]} onChange={(e) => setAnswers(answers.map((v, j) => (j === i ? e.target.value : v)))}
                className="input news-body mt-2 !text-base" placeholder="Tu respuesta…" />
            )}
          </li>
        ))}
      </ol>

      <FormMessage state={msg} />
      {!locked && (
        <div className="sticky bottom-20 z-10 flex flex-col-reverse gap-2 rounded-2xl bg-white/95 p-3 shadow-lg ring-1 ring-black/10 backdrop-blur sm:bottom-4 sm:flex-row sm:items-center sm:justify-end">
          <span className="text-sm text-negro/60 sm:mr-auto">{done} de {questions.length} contestadas</span>
          <button type="button" onClick={() => save(false)} disabled={pending} className="btn-ghost"><Save size={16} /> Guardar y seguir luego</button>
          <button type="button" onClick={() => save(true)} disabled={pending || done === 0} className="btn-primary"><Send size={16} /> {pending ? "Enviando…" : "Entregar"}</button>
        </div>
      )}
    </div>
  );
}
