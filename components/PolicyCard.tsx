"use client";
import { useState } from "react";
import { fromRawUnits, explorerTxUrl } from "../lib/contract";
import { POLICY_STATUS, STATUS_LABEL, STATUS_PILL_CLASS } from "../types";
import type { Policy } from "../types";
import { AdjudicationProgress } from "./AdjudicationProgress";

// Flight statuses where delay_minutes is a sentinel value (used to trigger
// the payout threshold) rather than a real minutes figure — never render it
// as "Nm delay" for these, since it's not one.
const NON_DELAY_STATUSES = new Set(["cancelled", "diverted"]);

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
  const isPaid = policy.status === POLICY_STATUS.PAID;
  const [narrative, setNarrative] = useState("");

  const showDelayMinutes =
    policy.delay_minutes >= 0 && !NON_DELAY_STATUSES.has(policy.flight_status);

  // This component only ever renders client-side (page.tsx loads App with
  // ssr: false), so reading localStorage directly here is safe — no
  // server/client hydration mismatch risk.
  const payoutTxHash =
    isPaid && typeof window !== "undefined"
      ? localStorage.getItem(`wingback_payout_tx:${policy.policy_id}`)
      : null;

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

      {isPaid && (
        <div className="banner banner-success" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <span>
            ✓ You were paid <strong>{fromRawUnits(policy.paid_out)} GEN</strong>
          </span>
          {payoutTxHash && (
            <a
              href={explorerTxUrl(payoutTxHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="mono"
              style={{ fontSize: 12, textDecoration: "underline" }}
            >
              View transaction →
            </a>
          )}
        </div>
      )}

      {!isActive && (
        <>
          <p className="flight-row__reasoning">
            {policy.flight_status && <span className="mono">{policy.flight_status} · </span>}
            {showDelayMinutes ? `${policy.delay_minutes}m delay. ` : ""}
            {policy.reasoning}
          </p>
          {policy.claim_narrative && (
            <p className="hint" style={{ fontStyle: "italic" }}>
              Your claim: "{policy.claim_narrative}"
            </p>
          )}
        </>
      )}

      {isActive && checking && <AdjudicationProgress />}

      {isActive && !checking && (
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
              disabled={!narrative.trim()}
            >
              File claim
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
