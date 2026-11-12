import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import satori from "satori";
import { ImageResponse } from "next/og";
import type { Outcome } from "@/lib/matches";

/**
 * Imagen del resultado para compartir (v3.22.0): póster de partido con la franja del Rayo,
 * marcador grande, goleadores, cromo del MVP y el contexto (racha, clasificación y próximo
 * partido). Dos formatos: publicación (1080 × 1350) e historia (1080 × 1920).
 *
 * Rendimiento: nada de boxShadow/textShadow, filtros ni <pattern> girados (cada uno cuesta segundos
 * en el dibujo, ver v3.20.1), y nada de overflow: hidden en la raíz (satori mete una máscara por
 * elemento). Satori lo pasa a SVG y sharp lo dibuja en JPEG: ~0,8 s y ~250 KB, frente a ~4 s y
 * ~1,5 MB del PNG de next/og. Las fotos y escudos se reducen antes con sharp.
 */

export type Format = "post" | "story";
export const SIZES: Record<Format, { w: number; h: number }> = { post: { w: 1080, h: 1350 }, story: { w: 1080, h: 1920 } };

export const ROJO = "#D20D17";
export const ORO = "#D5AF32";
export const ORO_CLARO = "#F3D774";
export const NEGRO = "#080808";

export type Pic = { src: string; ratio: number };
export type Side = { name: string; short: string; color: string; crest: Pic | string | null; goals: number; isUs: boolean };
export type PosterData = {
  outcome: Outcome;
  competition: string;           // «LIGA · JORNADA 7»
  day: string;                   // «Sábado, 7 de noviembre»
  venue: string | null;
  home: Side;
  away: Side;
  crest: Pic;                    // escudo del Rayo
  scorers: { name: string; goals: number; assists: string[] }[];
  moreScorers: number;
  cleanSheet: string | null;     // portero si dejamos la portería a cero
  cards: { name: string; yellows: number; red: boolean }[];
  played: string[];              // quiénes jugaron (según el acta)
  mvp: { name: string; number: number | null; position: string; goalkeeper: boolean; goals: number; assists: number; photo: Pic | null } | null;
  mvpPending: boolean;           // votación del MVP abierta
  form: Outcome[];               // últimos resultados hasta este partido (el más reciente al final)
  table: { pos: number; points: number } | null;
  next: { name: string; short: string; color: string; crest: Pic | string | null; when: string; home: boolean } | null;
  sponsor: Pic | null;
};

// ---------------------------------------------------------------- Imágenes (sharp)

type Sharp = (typeof import("sharp"))["default"];
let sharpP: Promise<Sharp | null> | null = null;
const sharpLib = () => (sharpP ??= import("sharp").then((m) => (m.default ?? m) as Sharp).catch(() => null));

/** Proporción ancho/alto de un PNG o JPEG (para cuando sharp no está). */
function ratioOf(buf: Buffer): number | null {
  if (buf.subarray(1, 4).toString("ascii") === "PNG") return buf.readUInt32BE(16) / Math.max(1, buf.readUInt32BE(20));
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length - 9) {
      if (buf[i] !== 0xff) return null;
      const marker = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return buf.readUInt16BE(i + 7) / Math.max(1, buf.readUInt16BE(i + 5));
      i += 2 + len;
    }
  }
  return null;
}

/**
 * Prepara una imagen para dibujarla: la reduce (y la convierte a PNG, así también valen las WebP).
 * Con `photo` la recorta al hueco del cromo y la funde hacia abajo.
 */
export async function prepareImage(buf: Buffer, opts: { max: number; photo?: { w: number; h: number } }): Promise<Pic | null> {
  const sharp = await sharpLib();
  if (sharp) {
    try {
      if (opts.photo) {
        const { w, h } = opts.photo;
        const mask = Buffer.from(
          `<svg width="${w}" height="${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0.62" stop-color="#fff" stop-opacity="1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/></svg>`,
        );
        const out = await sharp(buf).rotate().resize(w, h, { fit: "cover", position: "top" }).ensureAlpha()
          .composite([{ input: mask, blend: "dest-in" }]).png({ compressionLevel: 6 }).toBuffer();
        return { src: `data:image/png;base64,${out.toString("base64")}`, ratio: w / h };
      }
      const img = sharp(buf).rotate().resize(opts.max, opts.max, { fit: "inside", withoutEnlargement: true });
      const { data, info } = await img.png({ compressionLevel: 6 }).toBuffer({ resolveWithObject: true });
      return { src: `data:image/png;base64,${data.toString("base64")}`, ratio: info.width / Math.max(1, info.height) };
    } catch {
      return null;
    }
  }
  // Sin sharp: solo PNG y JPEG, tal cual
  const ratio = ratioOf(buf);
  if (!ratio) return null;
  const png = buf.subarray(1, 4).toString("ascii") === "PNG";
  return { src: `data:image/${png ? "png" : "jpeg"};base64,${buf.toString("base64")}`, ratio };
}

let assets: Promise<{ black: Buffer; semi: Buffer; crest: Pic }> | null = null;
export const loadAssets = () =>
  (assets ??= Promise.all([
    readFile(join(process.cwd(), "src/assets/fonts/BarlowCondensed-Black.ttf")),
    readFile(join(process.cwd(), "src/assets/fonts/Barlow-SemiBold.ttf")),
    readFile(join(process.cwd(), "public/escudo.png")).then((b) => prepareImage(b, { max: 360 })),
  ]).then(([black, semi, crest]) => ({ black, semi, crest: crest! })));

// ---------------------------------------------------------------- Piezas

const OUT_WORD: Record<Outcome, string> = { W: "¡VICTORIA!", D: "EMPATE", L: "DERROTA" };
const GHOST: Record<Outcome, string> = { W: "VICTORIA", D: "EMPATE", L: "DERROTA" };
const FORM_LETTER: Record<Outcome, string> = { W: "V", D: "E", L: "D" };
const FORM_BG: Record<Outcome, string> = { W: ORO, D: "#6b6b6b", L: ROJO };

/** Fondo: negro con la franja diagonal roja y dorada de la camiseta, rayado fino y semitono. */
export function Backdrop({ w, h, glow, glowY }: { w: number; h: number; glow: string; glowY?: number }) {
  // La franja va de abajo a la izquierda hacia arriba a la derecha, como en la camiseta
  const b = 230;                 // ancho de la franja roja
  const x0 = w * 0.18;           // dónde corta el borde de abajo
  const x1 = x0 + h * 0.75;      // dónde corta el borde de arriba
  let pin = "";
  for (let k = -h; k < w; k += 20) pin += `M${k} ${h}L${k + h} 0`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: "absolute", top: 0, left: 0 }}>
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#15080a" />
          <stop offset="0.5" stopColor="#0a0a0b" />
          <stop offset="1" stopColor="#050505" />
        </linearGradient>
        <linearGradient id="red" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor={ROJO} stopOpacity="0.05" />
          <stop offset="0.45" stopColor={ROJO} stopOpacity="0.85" />
          <stop offset="1" stopColor="#7a060c" stopOpacity="0.9" />
        </linearGradient>
        <linearGradient id="gold" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor={ORO} stopOpacity="0" />
          <stop offset="0.5" stopColor={ORO_CLARO} stopOpacity="0.95" />
          <stop offset="1" stopColor={ORO} stopOpacity="0.7" />
        </linearGradient>
        <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={glow} stopOpacity="0.34" />
          <stop offset="1" stopColor={glow} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="fadeDown" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.85" />
        </linearGradient>
        <pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse">
          <circle cx="11" cy="11" r="3.2" fill="#ffffff" />
        </pattern>
        <radialGradient id="dotFade" cx="1" cy="0" r="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.16" />
          <stop offset="0.7" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <mask id="dotMask"><rect width={w} height={h} fill="url(#dotFade)" /></mask>
      </defs>
      <rect width={w} height={h} fill="url(#bg)" />
      {/* Rayado fino en diagonal (un solo trazo: un <pattern> girado tardaba un segundo en dibujarse) */}
      <path d={pin} stroke="#ffffff" strokeOpacity="0.035" strokeWidth="2" fill="none" />
      {/* Semitono arriba a la derecha */}
      <rect width={w} height={h} fill="url(#dots)" mask="url(#dotMask)" />
      {/* Brillo detrás del marcador */}
      <ellipse cx={w / 2} cy={h * (glowY ?? (h > 1500 ? 0.36 : 0.37))} rx={w * 0.62} ry={h * 0.26} fill="url(#glow)" />
      {/* Franja del Rayo */}
      <polygon points={`${x0},${h} ${x0 + b},${h} ${x1 + b},0 ${x1},0`} fill="url(#red)" opacity="0.55" />
      <polygon points={`${x0 + b + 18},${h} ${x0 + b + 40},${h} ${x1 + b + 40},0 ${x1 + b + 18},0`} fill="url(#gold)" opacity="0.6" />
      <polygon points={`${x0 - 40},${h} ${x0 - 30},${h} ${x1 - 30},0 ${x1 - 40},0`} fill="#ffffff" opacity="0.06" />
      {/* Oscurece abajo para que se lea lo de encima */}
      <rect y={h * 0.5} width={w} height={h * 0.5} fill="url(#fadeDown)" />
    </svg>
  );
}

export const Bolt = ({ size = 34, color = ORO }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" fill={color} /></svg>
);
const BallIcon = ({ size = 30 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="11" fill="#ffffff" stroke="#111" strokeWidth="1.2" />
    <path d="M12 6.5l3.6 2.6-1.4 4.2H9.8L8.4 9.1z" fill="#111" />
    <path d="M12 1.5v5M15.6 9.1l5-1.6M14.2 13.3l3 4.2M9.8 13.3l-3 4.2M8.4 9.1l-5-1.6" stroke="#111" strokeWidth="1.2" />
  </svg>
);
const CardIcon = ({ red }: { red: boolean }) => (
  <div style={{ display: "flex", width: 16, height: 22, borderRadius: 3, background: red ? "#E5262E" : "#F5C518", marginRight: 6 }} />
);
const Glove = ({ size = 26 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <path d="M7 21h9v-3l3-5V7.5a1.5 1.5 0 0 0-3 0V11h-.5V4.5a1.5 1.5 0 0 0-3 0V10H12V3.5a1.5 1.5 0 0 0-3 0V10h-.5V5.5a1.5 1.5 0 0 0-3 0V14l1.5 4z" fill={ORO} />
  </svg>
);

/** Escudo: imagen preparada, enlace o el escudo de colores con las iniciales. */
export function CrestImg({ crest, short, color, size }: { crest: Pic | string | null; short: string; color: string; size: number }) {
  if (crest) {
    const src = typeof crest === "string" ? crest : crest.src;
    const r = typeof crest === "string" ? 1 : crest.ratio;
    const [cw, ch] = r >= 1 ? [size, Math.round(size / r)] : [Math.round(size * r), size];
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} width={cw} height={ch} style={{ objectFit: "contain" }} alt="" />;
  }
  return (
    <div style={{ display: "flex", width: size * 0.8, height: size * 0.92, alignItems: "center", justifyContent: "center", background: color, borderRadius: `${size * 0.12}px ${size * 0.12}px ${size * 0.4}px ${size * 0.4}px`, border: `${Math.max(4, size * 0.035)}px solid rgba(255,255,255,0.92)`, fontFamily: "Display", fontSize: size * 0.3, color: "white" }}>{short}</div>
  );
}

/** Camiseta del Rayo con el dorsal (para el MVP sin foto). */
export function Jersey({ goalkeeper, size }: { goalkeeper: boolean; size: number }) {
  const body = goalkeeper ? ORO : "#111111";
  return (
    <svg width={size} height={(size * 60) / 64} viewBox="0 0 64 60">
      <defs>
        <clipPath id="jc"><path d="M20 2 L26 6 Q32 9 38 6 L44 2 L62 12 L56 26 L50 23 L50 58 L14 58 L14 23 L8 26 L2 12 Z" /></clipPath>
      </defs>
      <g clipPath="url(#jc)">
        <rect width="64" height="60" fill={body} />
        <path d="M2 50 L52 0 L62 0 L62 4 L10 58 L2 58 Z" fill={goalkeeper ? NEGRO : ROJO} opacity={goalkeeper ? 0.18 : 1} />
        <path d="M10 58 L62 4 L62 7 L13 58 Z" fill={goalkeeper ? NEGRO : ORO} opacity={goalkeeper ? 0.25 : 1} />
      </g>
      <path d="M20 2 L26 6 Q32 9 38 6 L44 2 L62 12 L56 26 L50 23 L50 58 L14 58 L14 23 L8 26 L2 12 Z" fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="1.2" />
    </svg>
  );
}

/** Cromo dorado del MVP, con la silueta de los cromos de la plantilla. */
function MvpCard({ mvp, crest, w }: { mvp: NonNullable<PosterData["mvp"]>; crest: Pic; w: number }) {
  const h = Math.round(w * 1.39);
  const s = w / 340;                       // escala respecto al diseño base de 340 px
  const shape = `${w * 0.12},0 ${w * 0.88},0 ${w},${h * 0.07} ${w},${h * 0.89} ${w / 2},${h} 0,${h * 0.89} 0,${h * 0.07}`;
  const inner = (k: number) => {
    const i = 7 * s * k;
    return `${w * 0.12 + i * 0.4},${i} ${w * 0.88 - i * 0.4},${i} ${w - i},${h * 0.07 + i * 0.4} ${w - i},${h * 0.89 - i * 0.25} ${w / 2},${h - i * 1.2} ${i},${h * 0.89 - i * 0.25} ${i},${h * 0.07 + i * 0.4}`;
  };
  const photoW = Math.round(w * 0.74), photoH = Math.round(h * 0.55);
  const stat = (label: string, value: number) => (
    <div style={{ display: "flex", alignItems: "baseline", margin: `0 ${12 * s}px` }}>
      <span style={{ fontFamily: "Display", fontSize: 46 * s, lineHeight: 1 }}>{value}</span>
      <span style={{ fontFamily: "Display", fontSize: 24 * s, marginLeft: 6 * s, opacity: 0.75 }}>{label}</span>
    </div>
  );
  const name = mvp.name.toUpperCase();
  return (
    <div style={{ display: "flex", position: "relative", width: w, height: h }}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: "absolute", top: 0, left: 0 }}>
        <defs>
          <linearGradient id="face" x1="0" y1="0" x2="0.8" y2="1">
            <stop offset="0" stopColor="#fdf0b4" />
            <stop offset="0.38" stopColor="#e6c65a" />
            <stop offset="1" stopColor="#a57d14" />
          </linearGradient>
          <linearGradient id="shine" x1="0" y1="0" x2="1" y2="0.6">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
            <stop offset="0.3" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={shape} fill={NEGRO} />
        <polygon points={inner(1)} fill="url(#face)" />
        {/* Franja del Rayo en el cromo */}
        <polygon points={`${w * 0.7},0 ${w * 0.8},0 ${w * 0.18},${h * 0.62} ${w * 0.08},${h * 0.62}`} fill={ROJO} opacity="0.85" />
        <polygon points={`${w * 0.82},0 ${w * 0.85},0 ${w * 0.23},${h * 0.62} ${w * 0.2},${h * 0.62}`} fill={NEGRO} opacity="0.75" />
        <polygon points={inner(1)} fill="url(#shine)" />
        <polygon points={inner(2.2)} fill="none" stroke={NEGRO} strokeOpacity="0.35" strokeWidth={2 * s} />
      </svg>
      {/* Foto o camiseta */}
      <div style={{ display: "flex", position: "absolute", top: h * 0.05, left: w * 0.2, width: photoW, height: photoH, alignItems: "flex-end", justifyContent: "center" }}>
        {mvp.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mvp.photo.src} width={photoW} height={photoH} style={{ objectFit: "cover" }} alt="" />
        ) : (
          <div style={{ display: "flex", position: "relative", marginBottom: 20 * s }}>
            <Jersey goalkeeper={mvp.goalkeeper} size={190 * s} />
            <div style={{ display: "flex", position: "absolute", top: 50 * s, left: 0, width: 190 * s, justifyContent: "center", fontFamily: "Display", fontSize: 92 * s, lineHeight: 1, color: mvp.goalkeeper ? NEGRO : "white" }}>{mvp.number ?? "★"}</div>
          </div>
        )}
      </div>
      {/* Dorsal, posición y escudo */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", position: "absolute", top: h * 0.075, left: w * 0.085, color: NEGRO }}>
        <span style={{ fontFamily: "Display", fontSize: 64 * s, lineHeight: 0.9 }}>{mvp.number ?? "–"}</span>
        <span style={{ fontFamily: "Display", fontSize: 26 * s, lineHeight: 1 }}>{mvp.position}</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={crest.src} width={40 * s} height={Math.round((40 * s) / crest.ratio)} style={{ marginTop: 8 * s }} alt="" />
      </div>
      {/* Nombre y lo que hizo en el partido */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", position: "absolute", top: h * 0.6, left: 0, width: w, color: NEGRO }}>
        <span style={{ fontFamily: "Display", fontSize: (name.length > 11 ? 44 : 56) * s, lineHeight: 1 }}>{name}</span>
        <div style={{ display: "flex", width: w * 0.62, height: 3 * s, background: NEGRO, opacity: 0.35, margin: `${10 * s}px 0` }} />
        <div style={{ display: "flex", alignItems: "center" }}>
          {mvp.goalkeeper ? null : stat("GOL", mvp.goals)}
          {mvp.goalkeeper ? null : stat("ASIS", mvp.assists)}
          {mvp.goalkeeper && <span style={{ fontFamily: "Display", fontSize: 30 * s, letterSpacing: 2 * s }}>PORTERO</span>}
        </div>
      </div>
      {/* Etiqueta */}
      <div style={{ display: "flex", position: "absolute", top: -22 * s, left: 0, width: w, justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "center", background: NEGRO, color: ORO, borderRadius: 999, padding: `${8 * s}px ${22 * s}px`, border: `${3 * s}px solid ${ORO}`, fontFamily: "Display", fontSize: 26 * s, letterSpacing: 3 * s }}>
          <svg width={22 * s} height={22 * s} viewBox="0 0 24 24" style={{ marginRight: 8 * s }}><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill={ORO} /></svg>
          MVP DEL PARTIDO
        </div>
      </div>
    </div>
  );
}

/** Hueco del MVP mientras el equipo vota. */
function MvpPending({ w, crest }: { w: number; crest: Pic }) {
  const h = Math.round(w * 1.39);
  const shape = `${w * 0.12},0 ${w * 0.88},0 ${w},${h * 0.07} ${w},${h * 0.89} ${w / 2},${h} 0,${h * 0.89} 0,${h * 0.07}`;
  return (
    <div style={{ display: "flex", position: "relative", width: w, height: h, alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: "absolute", top: 0, left: 0 }}>
        <polygon points={shape} fill="rgba(255,255,255,0.05)" stroke={ORO} strokeWidth="3" strokeDasharray="14 10" />
      </svg>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={crest.src} width={110} height={Math.round(110 / crest.ratio)} style={{ opacity: 0.5 }} alt="" />
      <span style={{ fontFamily: "Display", fontSize: 40, color: ORO, marginTop: 18, letterSpacing: 2 }}>MVP</span>
      <span style={{ fontSize: 24, color: "rgba(255,255,255,0.7)", textAlign: "center", width: w * 0.7, marginTop: 6, justifyContent: "center" }}>Lo está votando el equipo</span>
    </div>
  );
}

// ---------------------------------------------------------------- Cabecera y pie (comunes a todas las imágenes)

const PAD = 60;

/** Cabecera: escudo y club a la izquierda, competición y fecha a la derecha. */
export function PosterHeader({ crest, competition, day, story }: { crest: Pic; competition: string; day: string; story: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: `${story ? 110 : 44}px ${PAD}px 0` }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <CrestImg crest={crest} short="RVA" color={ROJO} size={story ? 92 : 78} />
        <div style={{ display: "flex", flexDirection: "column", marginLeft: 16 }}>
          <span style={{ fontFamily: "Display", fontSize: story ? 40 : 36, lineHeight: 1 }}>RAYO <span style={{ color: ORO, marginLeft: 10 }}>VALLECAÑAS</span></span>
          <span style={{ fontSize: 19, letterSpacing: 5, color: "rgba(255,255,255,0.55)", marginTop: 4 }}>FÚTBOL 7 · SALAMANCA</span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
        <div style={{ display: "flex", alignItems: "center", background: ROJO, padding: "6px 16px", borderRadius: 6, fontFamily: "Display", fontSize: 26, letterSpacing: 3 }}>{competition}</div>
        <span style={{ fontSize: 22, color: "rgba(255,255,255,0.75)", marginTop: 8 }}>{day}</span>
      </div>
    </div>
  );
}

/** Pie: patrocinador principal (o el campo), lema y campo. */
export function PosterFooter({ sponsor, venue, story }: { sponsor: Pic | null; venue: string | null; story: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: `22px ${PAD}px ${story ? 90 : 28}px`, borderTop: `5px solid ${ORO}`, background: "rgba(0,0,0,0.85)" }}>
      {sponsor ? (
        <div style={{ display: "flex", alignItems: "center" }}>
          <span style={{ display: "flex", flexDirection: "column", fontSize: 15, letterSpacing: 4, color: "rgba(255,255,255,0.55)", marginRight: 16 }}><span>CON EL</span><span>APOYO DE</span></span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={sponsor.src} width={Math.round(Math.min(220, Math.max(60, 64 * sponsor.ratio)))} height={64} style={{ objectFit: "contain" }} alt="" />
        </div>
      ) : (
        <span style={{ fontSize: 22, color: "rgba(255,255,255,0.7)" }}>{venue ?? ""}</span>
      )}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
        <span style={{ display: "flex", alignItems: "center", fontFamily: "Display", fontSize: 34, letterSpacing: 3, color: ORO }}>#AÚPARAYO <div style={{ display: "flex", marginLeft: 8 }}><Bolt size={30} /></div></span>
        {sponsor && venue && <span style={{ fontSize: 18, color: "rgba(255,255,255,0.55)" }}>{venue}</span>}
      </div>
    </div>
  );
}

/** Rótulo pequeño en dorado entre dos filetes («RESULTADO FINAL», «CONVOCATORIA»…). */
export function Kicker({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", fontSize: 24, letterSpacing: 9, color: ORO }}>
      <div style={{ display: "flex", height: 3, width: 70, background: `linear-gradient(90deg, rgba(213,175,50,0), ${ORO})`, marginRight: 18 }} />
      {text}
      <div style={{ display: "flex", height: 3, width: 70, background: `linear-gradient(90deg, ${ORO}, rgba(213,175,50,0))`, marginLeft: 18 }} />
    </div>
  );
}

// ---------------------------------------------------------------- Póster

function renderPoster(d: PosterData, format: Format) {
  const { w: W, h: H } = SIZES[format];
  const story = format === "story";
  const o = d.outcome;
  const gold = (t: Side) => t.isUs && o === "W";
  const pad = 60;

  const header = <PosterHeader crest={d.crest} competition={d.competition} day={d.day} story={story} />;

  // ---- Titular con la palabra gigante de fondo
  const headline = (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", position: "relative", marginTop: story ? 70 : 22 }}>
      <div style={{ display: "flex", position: "absolute", top: story ? -40 : -34, left: -200, width: W + 400, justifyContent: "center", fontFamily: "Display", fontSize: story ? 330 : 290, lineHeight: 1, color: "rgba(255,255,255,0.045)", letterSpacing: 6 }}>{GHOST[o]}</div>
      <div style={{ display: "flex", alignItems: "center", fontSize: 24, letterSpacing: 9, color: ORO }}>
        <div style={{ display: "flex", height: 3, width: 70, background: `linear-gradient(90deg, rgba(213,175,50,0), ${ORO})`, marginRight: 18 }} />
        RESULTADO FINAL
        <div style={{ display: "flex", height: 3, width: 70, background: `linear-gradient(90deg, ${ORO}, rgba(213,175,50,0))`, marginLeft: 18 }} />
      </div>
      <div style={{ display: "flex", alignItems: "center", marginTop: 4, fontFamily: "Display", fontSize: story ? 168 : 128, lineHeight: 1, letterSpacing: 4, color: o === "W" ? "white" : o === "L" ? "white" : "#e9e9e9", transform: "skewX(-7deg)" }}>
        {OUT_WORD[o]}
      </div>
    </div>
  );

  // ---- Marcador
  const crestSize = story ? 220 : 158;
  const team = (t: Side) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 300 }}>
      <div style={{ display: "flex", width: crestSize + 30, height: crestSize + 30, alignItems: "center", justifyContent: "center", borderRadius: 999, background: `radial-gradient(circle, ${t.isUs ? "rgba(213,175,50,0.28)" : "rgba(255,255,255,0.16)"}, rgba(255,255,255,0) 68%)` }}>
        <CrestImg crest={t.crest} short={t.short} color={t.color} size={crestSize} />
      </div>
      <div style={{ display: "flex", marginTop: 10, fontFamily: "Display", fontSize: t.name.length > 18 ? 34 : 40, lineHeight: 1, textAlign: "center", textTransform: "uppercase", color: t.isUs ? ORO : "white", justifyContent: "center" }}>{t.name}</div>
    </div>
  );
  const digit = (t: Side) => (
    <div style={{ display: "flex", minWidth: story ? 170 : 150, height: story ? 240 : 196, alignItems: "center", justifyContent: "center", fontFamily: "Display", fontSize: (t.goals > 9 ? 0.72 : 1) * (story ? 290 : 236), lineHeight: 1, color: gold(t) ? ORO : "white", transform: "skewX(-7deg)" }}>{t.goals}</div>
  );
  const scoreboard = (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: `0 ${pad - 20}px`, marginTop: story ? 70 : 18 }}>
      {team(d.home)}
      <div style={{ display: "flex", alignItems: "center", marginTop: -40 }}>
        {digit(d.home)}
        <div style={{ display: "flex", width: 34, height: 12, background: ORO, margin: "0 8px", transform: "skewX(-20deg)" }} />
        {digit(d.away)}
      </div>
      {team(d.away)}
    </div>
  );

  // ---- Goleadores, porteria a cero y tarjetas
  const fs = story ? 1.1 : 1;
  const goals = (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", fontFamily: "Display", fontSize: 28 * fs, letterSpacing: 5, color: ORO, marginBottom: 6 }}>
        <div style={{ display: "flex", marginRight: 10 }}><BallIcon size={26 * fs} /></div> GOLES DEL RAYO
      </div>
      {d.scorers.length === 0 && <span style={{ fontSize: 26 * fs, color: "rgba(255,255,255,0.7)", marginTop: 6 }}>Hoy no entró ninguno</span>}
      {d.scorers.map((e) => (
        <div key={e.name} style={{ display: "flex", flexDirection: "column", marginTop: 10 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <span style={{ fontFamily: "Display", fontSize: 44 * fs, lineHeight: 1, textTransform: "uppercase", marginRight: 12 }}>{e.name}</span>
            {Array.from({ length: Math.min(e.goals, 5) }, (_, k) => <div key={k} style={{ display: "flex", marginRight: 5 }}><BallIcon size={28 * fs} /></div>)}
          </div>
          {e.assists.length > 0 && <span style={{ fontSize: 21 * fs, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>Asistencia de {e.assists.join(", ")}</span>}
        </div>
      ))}
      {d.moreScorers > 0 && <span style={{ fontSize: 22, color: "rgba(255,255,255,0.6)", marginTop: 8 }}>y {d.moreScorers} más</span>}
    </div>
  );
  const extras = (d.cleanSheet || d.cards.length > 0) && (
    <div style={{ display: "flex", flexDirection: "column", marginTop: 22, paddingTop: 18, borderTop: "2px solid rgba(255,255,255,0.12)" }}>
      {d.cleanSheet && (
        <div style={{ display: "flex", alignItems: "center", fontSize: 24 * fs }}>
          <div style={{ display: "flex", marginRight: 10 }}><Glove size={28 * fs} /></div>
          <span style={{ fontFamily: "Display", fontSize: 28 * fs, letterSpacing: 2, color: ORO, marginRight: 10 }}>PORTERÍA A CERO</span>
          <span style={{ color: "rgba(255,255,255,0.85)" }}>{d.cleanSheet}</span>
        </div>
      )}
      {d.cards.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", marginTop: d.cleanSheet ? 12 : 0 }}>
          {d.cards.map((c) => (
            <div key={c.name} style={{ display: "flex", alignItems: "center", marginRight: 22, marginBottom: 4, fontSize: 22 * fs, color: "rgba(255,255,255,0.8)" }}>
              {Array.from({ length: Math.min(c.yellows, 2) }, (_, k) => <CardIcon key={k} red={false} />)}
              {c.red && <CardIcon red />}
              <span style={{ marginLeft: 2 }}>{c.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
  const playedList = d.played.length > 0 && (
    <div style={{ display: "flex", flexDirection: "column", marginTop: 22, paddingTop: 18, borderTop: "2px solid rgba(255,255,255,0.12)" }}>
      <span style={{ fontFamily: "Display", fontSize: 24 * fs, letterSpacing: 4, color: "rgba(255,255,255,0.55)" }}>JUGARON</span>
      <span style={{ fontSize: 22 * fs, lineHeight: 1.35, color: "rgba(255,255,255,0.85)", marginTop: 6 }}>{d.played.join(" · ")}</span>
    </div>
  );
  const panel = (showPlayed: boolean, grow = true) => (
    <div style={{ display: "flex", flexDirection: "column", flexGrow: grow ? 1 : 0, flexBasis: grow ? 0 : "auto", background: "linear-gradient(160deg, rgba(20,20,22,0.92) 0%, rgba(8,8,9,0.92) 100%)", border: "2px solid rgba(255,255,255,0.1)", borderLeft: `6px solid ${ROJO}`, borderRadius: 18, padding: story ? "30px 34px" : "26px 30px" }}>
      {goals}
      {extras}
      {showPlayed && playedList}
    </div>
  );

  // ---- MVP
  const mvpW = story ? 340 : 290;
  const mvpBlock = d.mvp ? <MvpCard mvp={d.mvp} crest={d.crest} w={mvpW} /> : d.mvpPending ? <MvpPending w={mvpW} crest={d.crest} /> : null;

  // ---- Contexto: racha, clasificación y próximo partido
  const ctxLabel = (s: string) => <span style={{ fontSize: 17, letterSpacing: 4, color: "rgba(255,255,255,0.55)", marginBottom: 8 }}>{s}</span>;
  const blocks: React.ReactNode[] = [];
  if (d.form.length > 1) {
    blocks.push(
      <div key="f" style={{ display: "flex", flexDirection: "column" }}>
        {ctxLabel("RACHA")}
        <div style={{ display: "flex" }}>
          {d.form.map((r, k) => (
            <div key={k} style={{ display: "flex", width: 38, height: 38, marginRight: 6, alignItems: "center", justifyContent: "center", borderRadius: 6, background: FORM_BG[r], color: r === "W" ? NEGRO : "white", fontFamily: "Display", fontSize: 26, border: k === d.form.length - 1 ? "3px solid white" : "3px solid transparent" }}>{FORM_LETTER[r]}</div>
          ))}
        </div>
      </div>,
    );
  }
  if (d.table) {
    blocks.push(
      <div key="t" style={{ display: "flex", flexDirection: "column" }}>
        {ctxLabel("CLASIFICACIÓN")}
        <div style={{ display: "flex", alignItems: "baseline" }}>
          <span style={{ fontFamily: "Display", fontSize: 46, lineHeight: 0.85, color: ORO }}>{d.table.pos}</span>
          <span style={{ fontSize: 22, color: ORO, marginLeft: 2 }}>º</span>
          <span style={{ fontFamily: "Display", fontSize: 28, marginLeft: 10 }}>{d.table.points} PTS</span>
        </div>
      </div>,
    );
  }
  if (d.next) {
    blocks.push(
      <div key="n" style={{ display: "flex", flexDirection: "column" }}>
        {ctxLabel("PRÓXIMO PARTIDO")}
        <div style={{ display: "flex", alignItems: "center" }}>
          <CrestImg crest={d.next.crest} short={d.next.short} color={d.next.color} size={40} />
          <div style={{ display: "flex", flexDirection: "column", marginLeft: 10 }}>
            <span style={{ fontFamily: "Display", fontSize: 26, lineHeight: 1, textTransform: "uppercase" }}>{d.next.home ? "vs " : "en "}{d.next.name.length > 20 ? d.next.short : d.next.name}</span>
            <span style={{ fontSize: 18, color: "rgba(255,255,255,0.7)" }}>{d.next.when}</span>
          </div>
        </div>
      </div>,
    );
  }
  const context = blocks.length > 0 && (
    <div style={{ display: "flex", alignItems: "center", justifyContent: blocks.length === 1 ? "center" : "space-between", flexGrow: 1, margin: `0 ${pad}px`, padding: "18px 28px", background: "rgba(0,0,0,0.6)", border: "2px solid rgba(255,255,255,0.1)", borderRadius: 16 }}>
      {blocks.flatMap((b, k) => (k ? [<div key={`s${k}`} style={{ display: "flex", width: 2, height: 62, background: "rgba(255,255,255,0.12)" }} />, b] : [b]))}
    </div>
  );

  const footer = <PosterFooter sponsor={d.sponsor} venue={d.venue} story={story} />;

  const body = (
    <div style={{ display: "flex", flexGrow: 1, alignItems: "center", padding: `0 ${pad}px` }}>
      <div style={{ display: "flex", width: "100%", alignItems: "center" }}>
        {panel(story || !mvpBlock)}
        {mvpBlock && <div style={{ display: "flex", marginLeft: 30, paddingTop: 20 }}>{mvpBlock}</div>}
      </div>
    </div>
  );

  const tree = (
    <div style={{ display: "flex", flexDirection: "column", width: W, height: H, background: "#070707", color: "white", fontFamily: "Text", position: "relative" }}>
      <Backdrop w={W} h={H} glow={o === "W" ? ORO : o === "L" ? ROJO : "#9aa3ad"} />
      {header}
      {headline}
      {scoreboard}
      {body}
      {context && <div style={{ display: "flex", marginBottom: story ? 40 : 22 }}>{context}</div>}
      {footer}
    </div>
  );
  return { tree, width: W, height: H };
}

/**
 * Dibuja un póster: satori lo pasa a SVG y sharp (nativo) lo convierte en JPEG. Es bastante más
 * rápido que el dibujo de next/og y el JPEG pesa una fracción del PNG, así se comparte antes.
 */
export async function drawTree(tree: React.ReactElement, width: number, height: number): Promise<{ body: Buffer; type: string }> {
  const { black, semi } = await loadAssets();
  const fonts = [
    { name: "Display", data: black, weight: 900 as const, style: "normal" as const },
    { name: "Text", data: semi, weight: 600 as const, style: "normal" as const },
  ];
  const sharp = await sharpLib();
  if (sharp) {
    try {
      const svg = await satori(tree, { width, height, fonts });
      const body = await sharp(Buffer.from(svg), { density: 72, limitInputPixels: false }).flatten({ background: "#070707" })
        .jpeg({ quality: 90, chromaSubsampling: "4:4:4", mozjpeg: true }).toBuffer();
      return { body, type: "image/jpeg" };
    } catch (e) {
      console.error("Imagen para compartir: sharp ha fallado, se usa el dibujo de next/og", e);
    }
  }
  // Plan B (más lento, PNG): el dibujo de next/og con el mismo diseño
  const res = new ImageResponse(tree, { width, height, fonts });
  return { body: Buffer.from(await res.arrayBuffer()), type: "image/png" };
}

/** Imagen del resultado. */
export async function drawPoster(d: PosterData, format: Format): Promise<{ body: Buffer; type: string }> {
  const { tree, width, height } = renderPoster(d, format);
  return drawTree(tree, width, height);
}
