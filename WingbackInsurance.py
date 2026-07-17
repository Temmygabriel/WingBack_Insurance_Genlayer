# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *

import json


PAYOUT_MULTIPLIER = 5  # payout = premium * PAYOUT_MULTIPLIER, only paid if delayed 3+ hours


class WingbackInsurance(gl.Contract):

    policy_count: u256
    policies: TreeMap[str, str]
    holder_policies: TreeMap[str, str]

    def __init__(self):
        self.policy_count = u256(0)

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
            "reasoning": "",
            "sources_used": [],
            "paid_out": 0,
        }
        self._write_policy(policy_id, policy_data)
        self._add_holder_policy(holder, policy_id)
        return policy_id

    @gl.public.write
    def adjudicate_flight(self, policy_id: str) -> None:
        policy = self._read_policy(policy_id)

        if policy["status"] != "active":
            return

        flight = policy["flight_number"]

        api_key = "5069d86b489690492dfed8427baba78b"
        url = "https://api.aviationstack.com/v1/flights?access_key=" + api_key + "&flight_iata=" + flight

        def generate():
            try:
                response = gl.nondet.web.request(url, method="GET")
                body_text = response.body.decode("utf-8")
            except Exception as e:
                body_text = None

            if not body_text:
                relay_prompt = "The API request failed. Respond with exactly this JSON: {\"flight_status\": \"unknown\", \"departure_delay\": null, \"arrival_delay\": null, \"looks_relevant\": false}"
            else:
                snippet_input = body_text[:4000]
                relay_prompt = f"""Below is a raw JSON API response for a flight status lookup. It may contain multiple
records for this flight number on different dates, since the airline reuses this flight number daily.

Select EXACTLY ONE record using this priority order:
1. If any record has flight_status "active" (currently in the air), pick that one.
2. Otherwise, pick the record with the single latest/most recent flight_date value.
Ignore every other record.

RAW RESPONSE:
{snippet_input}
END OF RAW RESPONSE.

Return ONLY this JSON, nothing else, describing ONLY the one record you selected:
{{"flight_status": "<the flight_status value from that one record>", "departure_delay": <the departure.delay value from that one record, or null if absent>, "arrival_delay": <the arrival.delay value from that one record, or null if absent>, "looks_relevant": <true if any usable record was found, false if the response was empty or an error>}}"""

            result = gl.nondet.exec_prompt(relay_prompt)
            return result.replace("```json", "").replace("```", "")

        result_raw = gl.eq_principle.prompt_non_comparative(
            generate,
            task="select exactly one flight record from a JSON API response using a fixed priority rule (active status first, else most recent date), ignoring all other records",
            criteria="a JSON object with flight_status, departure_delay, arrival_delay, and looks_relevant fields for the single selected record only",
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

        if not looks_relevant:
            delay_minutes = -1
        else:
            delay_minutes = arrival_delay
            if delay_minutes is None:
                delay_minutes = departure_delay
            if delay_minutes is None:
                delay_minutes = 0

        policy["delay_minutes"] = delay_minutes
        policy["flight_status"] = flight_status
        policy["departure_delay_minutes"] = departure_delay
        policy["arrival_delay_minutes"] = arrival_delay
        policy["reasoning"] = "Source: Aviationstack API. flight_status=" + str(flight_status)
        policy["sources_used"] = ["aviationstack:flights"]

        if delay_minutes >= 180:
            payout_amount = policy["payout_amount"]
            if self.balance >= payout_amount:
                target = gl.get_contract_at(Address(policy["holder"]))
                target.emit_transfer(value=payout_amount)
                policy["status"] = "paid"
                policy["paid_out"] = payout_amount
            else:
                policy["status"] = "delayed_unfunded"
        elif delay_minutes < 0:
            policy["status"] = "unresolved"
        else:
            policy["status"] = "not_delayed"

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
