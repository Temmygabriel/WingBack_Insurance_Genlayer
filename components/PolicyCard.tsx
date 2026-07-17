"use client";
import { SplitFlap } from "./SplitFlap";
import { fromRawUnits } from "../lib/contract";
import { POLICY_STATUS, STATUS_LABEL } from "../types";
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
    <div className="board-row">
      <div className="board-row__main">
        <div className="board-row__flight mono">{policy.flight_number}</div>
        <div className="board-row__meta">
          <span className="mono">{policy.departure_date}</span>
          <span className="board-row__id mono">{policy.policy_id}</span>
        </div>
      </div>

      <div className="board-row__status">
        <SplitFlap text={STATUS_LABEL[policy.status]} tone={policy.status} />
      </div>

      <div className="board-row__detail">
        <span className="mono board-row__amounts">
          {fromRawUnits(policy.premium)} GEN premium → {fromRawUnits(policy.payout_amount)} GEN payout
        </span>

        {!isActive && (
          <p className="board-row__reasoning">
            {policy.flight_status && <span className="mono">{policy.flight_status} · </span>}
            {policy.delay_minutes >= 0 ? `${policy.delay_minutes}m delay. ` : ""}
            {policy.reasoning}
          </p>
        )}

        {isActive && (
          <button
            className="btn btn--check"
            onClick={() => onCheck(policy.policy_id)}
            disabled={checking}
          >
            {checking ? "Adjudicating — takes 3–5 minutes…" : "Check this flight"}
          </button>
        )}
      </div>
    </div>
  );
}
