"use client";
import { useState } from "react";
import { fromRawUnits } from "../lib/contract";
import { POLICY_STATUS, STATUS_LABEL, STATUS_PILL_CLASS } from "../types";
import type { Policy } from "../types";

export function PolicyCard({
  policy,
  onCheck,
  checking,
}: {
  policy: Policy;
  onCheck: (id: string, narrative: string) => void;
  checking: boolean;
}) {
  const isActive = policy.status === POLICY_STATUS.ACTIVE;
  const [narrative, setNarrative] = useState("");

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
        <>
          <p className="flight-row__reasoning">
            {policy.flight_status && <span className="mono">{policy.flight_status} · </span>}
            {policy.delay_minutes >= 0 ? `${policy.delay_minutes}m delay. ` : ""}
            {policy.reasoning}
          </p>
          {policy.claim_narrative && (
            <p className="hint" style={{ fontStyle: "italic" }}>
              Your claim: "{policy.claim_narrative}"
            </p>
          )}
        </>
      )}

      {isActive && (
        <div className="field">
          <span className="label">Describe what happened</span>
          <textarea
            className="input"
            style={{ minHeight: 60, resize: "vertical", fontFamily: "inherit" }}
            placeholder="e.g. My flight was delayed about 4 hours and I missed my connection in Frankfurt."
            value={narrative}
            onChange={(e) => setNarrative(e.target.value)}
          />
          <div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => onCheck(policy.policy_id, narrative)}
              disabled={checking || !narrative.trim()}
            >
              {checking && <span className="spinner spinner-teal" style={{ width: 12, height: 12 }} />}
              {checking ? "Adjudicating — 3–5 min…" : "File claim"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}