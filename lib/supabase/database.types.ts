/**
 * Types for the Phase 3 schema.
 *
 * Hand-written to match `supabase/migrations/20260822120000_phase3.sql`. Once
 * the migration is applied you can regenerate this file instead:
 *   npx supabase gen types typescript --project-id <ref> > lib/supabase/database.types.ts
 */

export type MoodCategory = 'chuppah' | 'floral' | 'table' | 'lighting' | 'attire' | 'other';
export type RsvpStatus = 'pending' | 'attending' | 'declined' | 'maybe';
export type MealPreference =
  | 'regular'
  | 'vegan'
  | 'vegetarian'
  | 'gluten_free'
  | 'kosher'
  | 'child';
export type GuestSide = 'partner_a' | 'partner_b' | 'shared';
export type TableShape = 'round' | 'rectangle' | 'head';
export type BudgetStatus = 'planned' | 'deposit' | 'paid';
export type BudgetSource = 'manual' | 'receipt_scan';
export type ReceiptStatus = 'pending' | 'processed' | 'failed';
export type GiftMethod = 'paybox' | 'bit' | 'card' | 'none';

export interface MoodboardRow {
  id: string;
  client_id: string;
  category: MoodCategory;
  storage_path: string | null;
  image_url: string;
  caption: string | null;
  tags: string[];
  position: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface GuestRow {
  id: string;
  client_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  side: GuestSide;
  party_size: number;
  status: RsvpStatus;
  meal_preference: MealPreference;
  allergies: string | null;
  token: string;
  responded_at: string | null;
  gift_method: GiftMethod | null;
  gift_amount: number | null;
  blessing: string | null;
  table_id: string | null;
  seat_index: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SeatingTableRow {
  id: string;
  client_id: string;
  label: string;
  shape: TableShape;
  capacity: number;
  pos_x: number;
  pos_y: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BudgetItemRow {
  id: string;
  client_id: string;
  category: string;
  vendor: string | null;
  description: string | null;
  amount_planned: number;
  amount_paid: number;
  currency: string;
  status: BudgetStatus;
  due_date: string | null;
  paid_at: string | null;
  source: BudgetSource;
  receipt_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReceiptRow {
  id: string;
  client_id: string;
  storage_path: string;
  image_url: string | null;
  vendor: string | null;
  amount: number | null;
  currency: string | null;
  category: string | null;
  receipt_date: string | null;
  raw_extraction: unknown;
  confidence: number | null;
  status: ReceiptStatus;
  error: string | null;
  budget_item_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventSettingsRow {
  client_id: string;
  gift_paybox_url: string | null;
  gift_bit_url: string | null;
  gift_card_url: string | null;
  gift_message: string | null;
  calendar_token: string;
  event_start: string | null;
  event_end: string | null;
  venue_name: string | null;
  venue_address: string | null;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface ClientRow {
  id: string;
  producer_id: string;
  display_name: string;
  event_date: string | null;
  venue: string | null;
  guest_count: number | null;
  created_at: string;
  updated_at: string;
}

/** Shape returned by the `rsvp_get` RPC. */
export interface RsvpPayload {
  guest: {
    id: string;
    full_name: string;
    party_size: number;
    status: RsvpStatus;
    meal_preference: MealPreference;
    allergies: string | null;
    gift_method: GiftMethod | null;
    blessing: string | null;
    responded_at: string | null;
  };
  event: {
    display_name: string;
    event_date: string | null;
    venue: string | null;
    venue_name: string | null;
    venue_address: string | null;
    event_start: string | null;
  };
  gifts: {
    paybox: string | null;
    bit: string | null;
    card: string | null;
    message: string | null;
  };
}

/** Shape returned by the `calendar_feed` RPC. */
export interface CalendarFeedPayload {
  display_name: string;
  event_date: string | null;
  event_start: string | null;
  event_end: string | null;
  venue_name: string | null;
  venue_address: string | null;
  timezone: string;
}


// ── Phase 4 ────────────────────────────────────────────────────────────────

export type ProducerStatus = 'pending' | 'approved' | 'suspended';
export type ProducerTier = 'diy' | 'managed' | 'agency';
export type VendorRole =
  | 'catering' | 'sound' | 'lighting' | 'dj' | 'band' | 'photo' | 'video'
  | 'magnets' | 'design' | 'flowers' | 'rabbi' | 'security' | 'transport' | 'other';
export type VendorStatus = 'expected' | 'arrived' | 'late' | 'no_show';
export type FunnelStage = 'visit' | 'lead' | 'consult' | 'signed' | 'lost';

export interface ProducerRow {
  id: string;
  owner_user_id: string;
  brand_name: string;
  legal_name: string | null;
  slug: string;
  custom_domain: string | null;
  domain_verified: boolean;
  logo_url: string | null;
  color_ink: string;
  color_accent: string;
  color_paper: string;
  contact_email: string | null;
  contact_phone: string | null;
  contact_whatsapp: string | null;
  website_url: string | null;
  status: ProducerStatus;
  tier: ProducerTier;
  approved_at: string | null;
  suspended_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FeatureFlagRow {
  key: string;
  label_he: string;
  label_en: string;
  description_he: string | null;
  enabled_diy: boolean;
  enabled_managed: boolean;
  enabled_agency: boolean;
  updated_at: string;
}

export interface FunnelEventRow {
  id: string;
  tenant_id: string;
  stage: FunnelStage;
  lead_ref: string | null;
  source: string | null;
  response_minutes: number | null;
  value_ils: number | null;
  occurred_at: string;
}

export interface VendorCheckinRow {
  id: string;
  client_id: string;
  role: VendorRole;
  vendor_name: string;
  phone: string | null;
  expected_at: string | null;
  arrived_at: string | null;
  status: VendorStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface VendorBroadcastRow {
  id: string;
  client_id: string;
  message: string;
  channel: 'whatsapp' | 'sms';
  recipients: number;
  delivered: number;
  sent_by: string | null;
  created_at: string;
}

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      clients: Table<ClientRow>;
      moodboards: Table<MoodboardRow>;
      guests_rsvp: Table<GuestRow>;
      tables_seating: Table<SeatingTableRow>;
      budget_items: Table<BudgetItemRow>;
      receipts: Table<ReceiptRow>;
      event_settings: Table<EventSettingsRow>;
      producers: Table<ProducerRow>;
      feature_flags: Table<FeatureFlagRow>;
      funnel_events: Table<FunnelEventRow>;
      vendor_checkins: Table<VendorCheckinRow>;
      vendor_broadcasts: Table<VendorBroadcastRow>;
    };
    Views: Record<never, never>;
    Functions: {
      rsvp_get: { Args: { p_token: string }; Returns: RsvpPayload };
      rsvp_submit: {
        Args: {
          p_token: string;
          p_status: Exclude<RsvpStatus, 'pending'>;
          p_party_size?: number | null;
          p_meal?: MealPreference | null;
          p_allergies?: string | null;
          p_gift_method?: GiftMethod | null;
          p_gift_amount?: number | null;
          p_blessing?: string | null;
        };
        Returns: { ok: boolean; status: RsvpStatus; party_size: number };
      };
      calendar_feed: { Args: { p_token: string }; Returns: CalendarFeedPayload };
      is_platform_admin: { Args: Record<string, never>; Returns: boolean };
      current_tenant_id: { Args: Record<string, never>; Returns: string | null };
      resolve_tenant: { Args: { p_host: string }; Returns: unknown };
      tier_allows: { Args: { p_key: string; p_tier: string }; Returns: boolean };
      admin_platform_stats: { Args: Record<string, never>; Returns: unknown };
      admin_producer_leaderboard: { Args: Record<string, never>; Returns: unknown[] };
      admin_set_producer_status: {
        Args: { p_producer_id: string; p_status: string };
        Returns: { ok: boolean; status: string };
      };
      producer_funnel: { Args: { p_days?: number }; Returns: unknown };
      producer_cashflow: { Args: Record<string, never>; Returns: unknown };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}

/** Tables that are published to Supabase Realtime. */
export type RealtimeTable =
  | 'moodboards'
  | 'guests_rsvp'
  | 'tables_seating'
  | 'budget_items'
  | 'receipts'
  | 'vendor_checkins';
