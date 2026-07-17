import { createClient, createAccount } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
import type { Policy } from "../types";

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;
const MAX_ATTEMPTS = 3;

// --- Unit conversion: GEN uses 18 decimals, like wei. -----------------------
// Contract amounts are always raw on-chain integers. The UI only ever
// shows/accepts human GEN amounts, converted at this one boundary.

export function toRawUnits(genAmount: string): bigint {
  const [wholeRaw, fracRaw = ""] = genAmount.trim().split(".");
  const whole = wholeRaw === "" ? "0" : wholeRaw;
  const frac = (fracRaw + "0".repeat(18)).slice(0, 18);
  return BigInt(whole) * 10n ** 18n + BigInt(frac === "" ? "0" : frac);
}

export function fromRawUnits(raw: number | string): string {
  const bi = BigInt(raw);
  const whole = bi / 10n ** 18n;
  const frac = bi % 10n ** 18n;
  const fracStr = frac.toString().padStart(18, "0").replace(/0+$/, "");
  return fracStr ? `${whole}.${fracStr}` : `${whole}`;
}

// --- Core client + account plumbing — do not change ------------------------

function makeClient(account: ReturnType<typeof createAccount>) {
  return createClient({ chain: studionet, account });
}

export function makeAccount(privateKey?: `0x${string}`) {
  return createAccount(privateKey);
}

export async function writeContract(
  account: ReturnType<typeof createAccount>,
  method: string,
  args: unknown[],
  value?: bigint
): Promise<void> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const client = makeClient(account);
      const callParams: Record<string, unknown> = {
        address: CONTRACT_ADDRESS,
        functionName: method,
        args,
        account,
        leaderOnly: false,
      };
      if (value !== undefined) callParams.value = value.toString();

      const hash = await client.writeContract(callParams as any);
      await client.waitForTransactionReceipt({
        hash,
        status: TransactionStatus.ACCEPTED,
        retries: 120,
        interval: 4000,
      });
      return;
    } catch (err: any) {
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, attempt * 3000));
        continue;
      }
      throw err;
    }
  }
}

// Use this ONLY for contract methods that return a value (buy_policy returns policy_id)
export async function writeContractWithReturn(
  account: ReturnType<typeof createAccount>,
  method: string,
  args: unknown[],
  value?: bigint
): Promise<string> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const client = makeClient(account);
      const simParams: Record<string, unknown> = {
        address: CONTRACT_ADDRESS,
        functionName: method,
        args,
      };
      if (value !== undefined) simParams.value = value.toString();

      console.log("WINGBACK DEBUG — simParams about to be sent:", JSON.stringify(simParams, (_k, v) => typeof v === "bigint" ? v.toString() : v));

      // simulateWriteContract gets the return value without waiting for consensus
      const returnValue = await client.simulateWriteContract(simParams as any);

      const callParams: Record<string, unknown> = {
        address: CONTRACT_ADDRESS,
        functionName: method,
        args,
        account,
        leaderOnly: false,
      };
      if (value !== undefined) callParams.value = value.toString();

      const hash = await client.writeContract(callParams as any);
      await client.waitForTransactionReceipt({
        hash,
        status: TransactionStatus.ACCEPTED,
        retries: 120,
        interval: 4000,
      });
      return returnValue as string;
    } catch (err: any) {
      console.error("WINGBACK DEBUG — raw error caught:", err);
      console.error("WINGBACK DEBUG — error.message:", err?.message);
      console.error("WINGBACK DEBUG — error.cause:", err?.cause);
      console.error("WINGBACK DEBUG — error.details:", err?.details);
      console.error("WINGBACK DEBUG — full keys:", Object.getOwnPropertyNames(err || {}));
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, attempt * 3000));
        continue;
      }
      throw err;
    }
  }
  throw new Error("All attempts failed");
}

export async function readContract(method: string, args: unknown[]): Promise<string> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      // Read calls don't need a persistent account
      const account = createAccount();
      const client = makeClient(account);
      const result = await client.readContract({
        address: CONTRACT_ADDRESS,
        functionName: method,
        args,
      });
      return result as string;
    } catch (err: any) {
      if (attempt < MAX_ATTEMPTS) {
        // Studionet's shared RPC returns "server busy, retry_after_seconds" under load.
        // 2000ms base covers that hint; backs off further on later attempts.
        await new Promise((r) => setTimeout(r, attempt * 2000));
        continue;
      }
      throw err;
    }
  }
  throw new Error("All read attempts failed");
}

// --- Wingback-specific wrappers ---------------------------------------------

export async function buyPolicy(
  account: ReturnType<typeof createAccount>,
  flightNumber: string,
  departureDate: string,
  departureTs: number,
  premiumGen: string
): Promise<string> {
  return writeContractWithReturn(
    account,
    "buy_policy",
    [flightNumber, departureDate, String(departureTs)], // String() for int params, per build guide lesson
    toRawUnits(premiumGen)
  );
}

export async function adjudicateFlight(
  account: ReturnType<typeof createAccount>,
  policyId: string
): Promise<void> {
  return writeContract(account, "adjudicate_flight", [policyId]);
}

export async function getPolicy(policyId: string): Promise<Policy> {
  const raw = await readContract("get_policy", [policyId]);
  return JSON.parse(raw);
}

export async function getPoliciesForHolder(holder: string): Promise<Policy[]> {
  const raw = await readContract("get_policies_for_holder", [holder]);
  return JSON.parse(raw);
}

export async function getContractBalance(): Promise<string> {
  return readContract("get_contract_balance", []);
}

export async function getPolicyCount(): Promise<string> {
  return readContract("get_policy_count", []);
}