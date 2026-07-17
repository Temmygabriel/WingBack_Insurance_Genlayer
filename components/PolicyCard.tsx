"use client";
import { fromRawUnits } from "../lib/contract";
import { POLICY_STATUS, STATUS_LABEL, STATUS_PILL_CLASS } from "../types";
import type { Policy } from "../types";

export function PolicyCard({
  policy,
  onCheck,
  checking,
}: {
  policy: Policy;
  onCheck: (id: string) => void;
  checking: boolean;
}) {
  const isActive = policy.status === POLICY_STATUS.ACTIVE;

  return (
    <div className="flight-row">
      <div className="flight-row__top">
        <div>
          <span className="mono" style={{ fontWeight: 600, fontSize: 15 }}>{policy.flight_number}</span>
          <span className="flight-row__id mono"> · {policy.departure_date} · {policy.policy_id}</span>
        </div>
        <span className={`status-pill ${STATUS_PILL_CLASS[policy.status]}`}>
          {STATUS_LABEL[policy.status]}
        </span>
      </div>

      <div className="flight-row__amounts mono">
        {fromRawUnits(policy.premium)} GEN premium → {fromRawUnits(policy.payout_amount)} GEN payout
      </div>

      {!isActive && (
        <p className="flight-row__reasoning">
          {policy.flight_status && <span className="mono">{policy.flight_status} · </span>}
          {policy.delay_minutes >= 0 ? `${policy.delay_minutes}m delay. ` : ""}
          {policy.reasoning}
        </p>
      )}

      {isActive && (
        <div>
          <button className="btn btn-secondary btn-sm" onClick={() => onCheck(policy.policy_id)} disabled={checking}>
            {checking && <span className="spinner spinner-teal" style={{ width: 12, height: 12 }} />}
            {checking ? "Adjudicating — 3–5 min…" : "Check this flight"}
          </button>
        </div>
      )}
    </div>
  );
}