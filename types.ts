// Status strings — copied verbatim from WingbackInsurance.py.
// Never retype these anywhere else in the frontend. Import and reuse.
export const POLICY_STATUS = {
  ACTIVE: "active",
  NOT_DELAYED: "not_delayed",
  PAID: "paid",
  DELAYED_UNFUNDED: "delayed_unfunded",
  UNRESOLVED: "unresolved",
} as const;

export type PolicyStatus = (typeof POLICY_STATUS)[keyof typeof POLICY_STATUS];

export const STATUS_LABEL: Record<PolicyStatus, string> = {
  active: "AWAITING FLIGHT",
  not_delayed: "ON TIME",
  paid: "DELAYED · PAID",
  delayed_unfunded: "DELAYED · UNFUNDED",
  unresolved: "NO DATA YET",
};

// Matches the exact JSON shape written by buy_policy / adjudicate_flight
// in WingbackInsurance.py. Amounts are raw on-chain units (18 decimals, like wei).
export interface Policy {
  policy_id: string;
  holder: string;
  flight_number: string;
  departure_date: string;
  departure_ts: number;
  premium: number;
  payout_amount: number;
  status: PolicyStatus;
  delay_minutes: number;
  flight_status: string;
  departure_delay_minutes: number | null;
  arrival_delay_minutes: number | null;
  reasoning: string;
  sources_used: string[];
  paid_out: number;
}
