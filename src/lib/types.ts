export type Campaign = {
  id: string;
  name: string;
  year: number;
  kind: "lottery" | "raffle";
  lottery_number: string | null;
  winning_number: number | null;
  archived_at: string | null;
  draw_type: string;
  draw_date: string | null;
  price_cents: number;
  played_cents: number;
  donation_cents: number;
  total_shares: number;
  numbering_mode: "auto" | "booklet" | "manual";
  ref_prefix: string;
  status: "draft" | "active" | "closed" | "drawn";
  winning_prize_cents: number | null;
  notes: string | null;
  created_at: string;
};

export type Sale = {
  id: string;
  campaign_id: string;
  reference: string;
  buyer_id: string;
  seller_id: string;
  quantity: number;
  unit_price_cents: number;
  total_cents: number;
  paid_cents: number;
  payment_status: "pending" | "partial" | "paid" | "cancelled";
  preferred_channel: "email" | "whatsapp" | null;
  notes: string | null;
  created_at: string;
  cancelled_at: string | null;
  cancel_reason: string | null;
};

export type Summary = {
  total: number;
  available: number;
  reserved: number;
  sold: number;
  voided: number;
  sales_count?: number;
  sold_cents?: number;
  paid_cents?: number;
  pending_cents?: number;
  pending_sales?: number;
  buyers?: number;
};
