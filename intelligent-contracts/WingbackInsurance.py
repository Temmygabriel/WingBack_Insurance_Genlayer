# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *

import json


PAYOUT_MULTIPLIER = 5  # payout = premium * PAYOUT_MULTIPLIER, only paid if delayed 3+ hours


class WingbackInsurance(gl.Contract):

    policy_count: u256
    policies: TreeMap[str, str]
    holder_policies: TreeMap[str, str]
    aviationstack_key: str

    def __init__(self):
        self.policy_count = u256(0)
        self.aviationstack_key = "d3e89e21d8629497a38527e7d90dc237"

    @gl.public.write
    def set_aviationstack_key(self, new_key: str) -> None:
        # Lets the API key be rotated without redeploying the whole contract.
        # NOTE: this has no access control — anyone can call it. Fine for a
        # demo on a free-tier key; would need an owner check before any real use.
        self.aviationstack_key = new_key

    def _read_policy(self, policy_id: str) -> dict:
        return json.loads(self.policies[policy_id])

    def _write_policy(self, policy_id: str, policy_data: dict) -> None:
        self.policies[policy_id] = json.dumps(policy_data)

    def _get_holder_policy_ids(self, holder: str) -> list:
        raw = self.holder_policies.get(holder)
        if raw is None:
            return []
        return json.loads(raw)

    def _add_holder_policy(self, holder: str, policy_id: str) -> None:
        ids = self._get_holder_policy_ids(holder)
        ids.append(policy_id)
        self.holder_policies[holder] = json.dumps(ids)

    def _make_policy_id(self, holder: str, flight_number: str, departure_date: str) -> str:
        n = int(self.policy_count) * 1009 + len(holder) * 97 + len(flight_number) * 13 + len(departure_date) * 7
        chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
        code = ""
        for _ in range(10):
            code = code + chars[n % len(chars)]
            n = n // len(chars)
        return code

    @gl.public.write.payable
    def buy_policy(self, flight_number: str, departure_date: str, departure_ts: str) -> str:
        holder = gl.message.sender_address.as_hex
        premium = gl.message.value

        if premium <= 0:
            raise gl.vm.UserError("Premium must be greater than zero")

        self.policy_count = u256(int(self.policy_count) + 1)
        policy_id = self._make_policy_id(holder, flight_number, departure_date)

        policy_data = {
            "policy_id": policy_id,
            "holder": holder,
            "flight_number": flight_number.upper().strip(),
            "departure_date": departure_date,
            "departure_ts": int(departure_ts),
            "premium": premium,
            "payout_amount": premium * PAYOUT_MULTIPLIER,
            "status": "active",
            "delay_minutes": 0,
            "flight_status": "",
            "departure_delay_minutes": None,
            "arrival_delay_minutes": None,
            "claim_narrative": "",
            "narrative_consistent": None,
            "reasoning": "",
            "sources_used": [],
            "paid_out": 0,
        }
        self._write_policy(policy_id, policy_data)
        self._add_holder_policy(holder, policy_id)
        return policy_id

    @gl.public.write
    def adjudicate_flight(self, policy_id: str, claim_narrative: str) -> None:
        policy = self._read_policy(policy_id)

        if policy["status"] != "active":
            return

        if not claim_narrative.strip():
            raise gl.vm.UserError("A claim narrative is required — describe what happened in your own words")

        flight = policy["flight_number"]

        api_key = self.aviationstack_key
        url = "https://api.aviationstack.com/v1/flights?access_key=" + api_key + "&flight_iata=" + flight

        def generate():
            try:
                response = gl.nondet.web.request(url, method="GET")
                body_text = response.body.decode("utf-8")
            except Exception as e:
                body_text = None

            if not body_text:
                relay_prompt = "The API request failed. Respond with exactly this JSON: {\"flight_status\": \"unknown\", \"departure_delay\": null, \"arrival_delay\": null, \"looks_relevant\": false, \"narrative_consistent\": false, \"consistency_reasoning\": \"No official record could be retrieved to check the claim against.\"}"
            else:
                snippet_input = body_text[:4000]
                relay_prompt = f"""You are adjudicating a flight-delay insurance claim. There are two pieces of evidence below:
an official flight-status record (objective, from an aviation data provider) and the claimant's own written
account of what happened (subjective, could be honest, mistaken, or exaggerated).

CLAIMANT'S NARRATIVE:
{claim_narrative[:1000]}
END OF NARRATIVE.

OFFICIAL RECORD (raw JSON, may contain multiple dated records for this flight number — select the one with
flight_status "active" if present, otherwise the single most recent flight_date, and ignore all other records):
{snippet_input}
END OF OFFICIAL RECORD.

Do two separate things:
1. Extract the objective facts from the ONE selected official record only.
2. Compare the claimant's narrative against those objective facts. Flag it as inconsistent ONLY for a material
factual contradiction — e.g. the narrative describes a wildly different delay length than the record shows, claims
the flight was cancelled when the record shows it landed close to on time, or otherwise conflicts with the record
in a way that matters. Do NOT flag it as inconsistent merely for being vague, brief, or emotional — claimants are
not expected to know technical details, only to describe their real experience honestly.

Return ONLY this JSON, nothing else:
{{"flight_status": "<flight_status from the selected record>", "departure_delay": <departure.delay from the selected record, or null>, "arrival_delay": <arrival.delay from the selected record, or null>, "looks_relevant": <true if a usable record was found, false otherwise>, "narrative_consistent": <true if the claimant's account does not materially contradict the official record, false if it does>, "consistency_reasoning": "<one sentence explaining the consistency judgment, citing specifics from both the narrative and the record>"}}"""

            result = gl.nondet.exec_prompt(relay_prompt)
            return result.replace("```json", "").replace("```", "")

        result_raw = gl.eq_principle.prompt_non_comparative(
            generate,
            task="extract objective flight status facts from one selected record, and separately judge whether a claimant's narrative materially contradicts those facts",
            criteria="a JSON object with flight_status, departure_delay, arrival_delay, looks_relevant, narrative_consistent, and consistency_reasoning fields",
        )

        try:
            start = result_raw.find("{")
            end = result_raw.rfind("}") + 1
            result_json = json.loads(result_raw[start:end]) if start >= 0 and end > start else {}
        except Exception:
            result_json = {}

        looks_relevant = result_json.get("looks_relevant", False)
        flight_status = result_json.get("flight_status") or "unknown"

        departure_delay = result_json.get("departure_delay")
        arrival_delay = result_json.get("arrival_delay")

        narrative_consistent = result_json.get("narrative_consistent")
        if narrative_consistent is None:
            narrative_consistent = False
        consistency_reasoning = result_json.get("consistency_reasoning") or "No consistency judgment was returned."

        if not looks_relevant:
            delay_minutes = -1
        else:
            delay_minutes = arrival_delay
            if delay_minutes is None:
                delay_minutes = departure_delay
            if delay_minutes is None:
                delay_minutes = 0

        policy["claim_narrative"] = claim_narrative
        policy["delay_minutes"] = delay_minutes
        policy["flight_status"] = flight_status
        policy["departure_delay_minutes"] = departure_delay
        policy["arrival_delay_minutes"] = arrival_delay
        policy["narrative_consistent"] = narrative_consistent
        policy["reasoning"] = consistency_reasoning
        policy["sources_used"] = ["aviationstack:flights", "claimant:narrative"]

        if delay_minutes < 0:
            policy["status"] = "unresolved"
        elif delay_minutes < 180:
            policy["status"] = "not_delayed"
        elif not narrative_consistent:
            policy["status"] = "flagged_inconsistent"
        else:
            payout_amount = policy["payout_amount"]
            if self.balance >= payout_amount:
                target = gl.get_contract_at(Address(policy["holder"]))
                target.emit_transfer(value=payout_amount)
                policy["status"] = "paid"
                policy["paid_out"] = payout_amount
            else:
                policy["status"] = "delayed_unfunded"

        self._write_policy(policy_id, policy)

    @gl.public.view
    def get_policy(self, policy_id: str) -> str:
        return json.dumps(self._read_policy(policy_id))

    @gl.public.view
    def get_policies_for_holder(self, holder: str) -> str:
        ids = self._get_holder_policy_ids(holder)
        return json.dumps([self._read_policy(pid) for pid in ids])

    @gl.public.view
    def get_contract_balance(self) -> str:
        return str(self.balance)

    @gl.public.view
    def get_policy_count(self) -> str:
        return str(int(self.policy_count))
