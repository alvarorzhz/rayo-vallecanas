import { siteUrl } from "@/lib/receipt";

/** Datos que la página pública de la rifa recibe de la base de datos (sin datos personales). */
export type RafflePublicEvent = {
  kind: "closed" | "reopened" | "drawn";
  at: string;
  sold_count: number | null;
  sold_numbers: number[] | null;
  fingerprint: string | null;
  winning_number: number | null;
  draw_mode: "random" | "manual" | null;
  actor: string | null;
};

export type RafflePublic = {
  name: string;
  year: number;
  draw_date: string | null;
  price_cents: number;
  total: number;
  status: "active" | "closed" | "drawn";
  prize: string | null;
  purpose: string | null;
  sold_numbers: number[];
  voided_numbers: number[];
  winning_number: number | null;
  raised_cents: number | null;
  events: RafflePublicEvent[];
};

export type RaffleCheck = {
  found: boolean;
  number?: number;
  sold_on?: string;
  paid?: boolean;
  in_frozen_list?: boolean | null;
  winner?: boolean;
} | null;

export const publicRaffleUrl = (slug: string) => `${siteUrl()}/rifa/${slug}`;

/** Último cierre de ventas: su lista y su huella son las oficiales. */
export const lastClose = (events: RafflePublicEvent[]) => [...events].reverse().find((e) => e.kind === "closed");

export const DRAW_MODE_LABEL = {
  random: "Al azar, por la app, entre los números vendidos",
  manual: "Número indicado por un gestor (sorteo en directo)",
} as const;
