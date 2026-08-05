import { createClient, createAccount } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
import { generatePrivateKey } from "viem/accounts";
import type { Policy } from "../types";

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;
const MAX_ATTEMPTS = 3;

// A signing account is either:
//   - a local burner Account object (private key held in this browser), or
//   - a plain wallet address string, in which case genlayer-js relies on
//     the injected browser wallet (MetaMask) to sign — see lib/wallet.ts.
export type SigningAccount = ReturnType<typeof createAccount> | `0x${string}`;

// --- Unit conversion: GEN uses 18 decimals, like wei. -----------------------

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

function addressOf(account: SigningAccount): string {
  return typeof account === "string" ? account : account.address;
}

// GenLayer's SDK expects the per-call `account` passed into writeContract /
// simulateWriteContract to be an object with an `.address` field — passing
// a plain wallet address string there breaks internally (`account.address`
// is undefined on a string), even though the CLIENT-level account must stay
// a plain string for eth_ RPC calls to route to the injected wallet
// (MetaMask) instead of the plain HTTP endpoint. This normalizes only the
// per-call value; makeClient() below keeps passing the raw value through.
function toCallAccount(account: SigningAccount): any {
  if (typeof account === "string") {
    return { address: account }; // no `type` field — keeps _sendTransaction's
    // `type === "local"` check false, so it takes the eth_sendTransaction
    // (wallet-signed) path rather than expecting a local signTransaction.
  }
  return account;
}

// waitForTransactionReceipt only waits for the transaction to reach a
// decided consensus STATUS (e.g. ACCEPTED) — it does NOT check whether the
// contract's own execution actually succeeded. A reverted call (a raised
// UserError, an authorization failure, an insufficient-reserve rejection,
// etc.) still reaches ACCEPTED status, the same way a failed Ethereum
// transaction still gets mined — it just carries an error result instead of
// throwing. Without this check, every caller of writeContract would
// silently treat a rejected transaction as a success. Confirmed via a real
// on-chain Rollback that the frontend previously reported as "Flight
// registered" — this is not a hypothetical.
function assertReceiptSucceeded(receipt: any): void {
  const leaderReceipts = receipt?.consensus_data?.leader_receipt;
  const entries = Array.isArray(leaderReceipts) ? leaderReceipts : leaderReceipts ? [leaderReceipts] : [];

  for (const entry of entries) {
    const executionResult = entry?.execution_result;
    if (executionResult && String(executionResult).toUpperCase() !== "SUCCESS") {
      const decoded = decodeContractErrorMessage(entry);
      const err = new Error(
        decoded ||
          `The contract rejected this transaction (${executionResult}) but the reason couldn't be read automatically — check the browser console for the raw details, or look up this transaction on the GenLayer explorer.`
      );
      (err as any).isContractRejection = true; // deterministic — don't retry
      throw err;
    }
  }
}

function decodeContractErrorMessage(leaderReceiptEntry: any): string | null {
  const raw = leaderReceiptEntry?.result;
  if (raw == null) return null;

  // `result` may already be a readable string/object, valid JSON as a
  // string, or base64 — and base64 might decode to JSON OR to plain text.
  // Try every shape rather than assuming one, since guessing wrong before
  // silently produced no message at all.
  const candidates: unknown[] = [raw];
  if (typeof raw === "string") {
    try {
      candidates.push(JSON.parse(raw));
    } catch {
      /* not JSON, ignore */
    }
    try {
      const decoded = atob(raw);
      candidates.push(decoded); // plain text after base64 decode
      try {
        candidates.push(JSON.parse(decoded)); // or JSON after base64 decode
      } catch {
        /* not JSON either, the plain-text candidate above still stands */
      }
    } catch {
      /* not valid base64 at all, ignore */
    }
  }

  const MESSAGE_KEYS = ["message", "error", "reason", "detail", "msg", "description"];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim() && candidate !== raw) return candidate;
    if (candidate && typeof candidate === "object") {
      for (const key of MESSAGE_KEYS) {
        const value = (candidate as Record<string, unknown>)[key];
        if (typeof value === "string" && value.trim()) return value;
      }
    }
  }
  // Plain raw string as last resort, after structured attempts came up empty.
  if (typeof raw === "string" && raw.trim()) return raw;

  // Genuinely couldn't decode anything readable — log the real shape so
  // this can actually be fixed with real data instead of another guess.
  console.error("Could not decode contract error message. Raw leader receipt entry:", leaderReceiptEntry);
  return null;
}

  return typeof raw === "string" ? raw : null;
}

// --- Core client + account plumbing -----------------------------------------

function makeClient(account: SigningAccount) {
  return createClient({ chain: studionet, account: account as any });
}

export function makeAccount(privateKey?: `0x${string}`) {
  // genlayer-js's createAccount() never exposes .privateKey on the returned
  // object — confirmed by searching the whole SDK source, zero occurrences.
  // Reading acc.privateKey afterward has always silently returned undefined,
  // which meant every "restore from localStorage" attempt was actually
  // restoring from the literal string "undefined" and falling back to a
  // fresh random wallet — every reload, forever. The fix: generate the key
  // ourselves before creating the account, so we always hold the real
  // string directly, then attach it to the object explicitly since
  // genlayer-js never will.
  const key = privateKey || generatePrivateKey();
  const account = createAccount(key) as any;
  account.privateKey = key;
  return account as ReturnType<typeof createAccount> & { privateKey: `0x${string}` };
}

export async function writeContract(
  account: SigningAccount,
  method: string,
  args: unknown[],
  value?: bigint
): Promise<string> {
  let hash: string | undefined;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const client = makeClient(account);

      // Only submit a new transaction if we don't already have a hash from
      // a prior attempt — retrying a WRITE by resubmitting from scratch can
      // create a second, completely separate real on-chain transaction
      // (charging a premium twice, reserving exposure twice) if the first
      // attempt actually went through but the client just failed to
      // confirm it in time. A retry should re-check the SAME transaction,
      // never submit a new one, once a hash exists.
      if (!hash) {
        const callParams: Record<string, unknown> = {
          address: CONTRACT_ADDRESS,
          functionName: method,
          args,
          account: toCallAccount(account),
          leaderOnly: false,
        };
        if (value !== undefined) callParams.value = value;
        hash = await client.writeContract(callParams as any);
      }

      const receipt = await client.waitForTransactionReceipt({
        hash,
        status: TransactionStatus.ACCEPTED,
        retries: 120,
        interval: 4000,
      });
      assertReceiptSucceeded(receipt);
      return hash;
    } catch (err: any) {
      if (!err?.isContractRejection && attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, attempt * 3000));
        continue; // hash (if we got one) is preserved — next attempt re-polls it, doesn't resubmit
      }
      throw err;
    }
  }
  throw new Error("All attempts failed");
}

// Use this ONLY for contract methods that return a value (buy_policy returns policy_id)
export async function writeContractWithReturn(
  account: SigningAccount,
  method: string,
  args: unknown[],
  value?: bigint
): Promise<string> {
  let hash: string | undefined;
  let returnValue: string | undefined;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const client = makeClient(account);

      if (!hash) {
        const simParams: Record<string, unknown> = {
          address: CONTRACT_ADDRESS,
          functionName: method,
          args,
          account: toCallAccount(account),
        };
        if (value !== undefined) simParams.value = value;
        // simulateWriteContract gets the return value without waiting for consensus
        returnValue = (await client.simulateWriteContract(simParams as any)) as string;

        const callParams: Record<string, unknown> = {
          address: CONTRACT_ADDRESS,
          functionName: method,
          args,
          account: toCallAccount(account),
          leaderOnly: false,
        };
        if (value !== undefined) callParams.value = value;
        hash = await client.writeContract(callParams as any);
      }

      const receipt = await client.waitForTransactionReceipt({
        hash,
        status: TransactionStatus.ACCEPTED,
        retries: 120,
        interval: 4000,
      });
      assertReceiptSucceeded(receipt);
      return returnValue as string;
    } catch (err: any) {
      if (!err?.isContractRejection && attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, attempt * 3000));
        continue; // hash/returnValue (if obtained) are preserved — re-poll, don't resubmit
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
  account: SigningAccount,
  flightNumber: string,
  departureDate: string,
  departureTs: number,
  premiumGen: string
): Promise<string> {
  // NOTE: deliberately using writeContract, not writeContractWithReturn.
  // simulateWriteContract does not honor the `value` field, so simulating
  // this call sees a zero premium and buy_policy's own zero-premium check
  // rejects it — even though the real write would have carried real value.
  // We don't use the returned policy_id anyway; refreshPolicies() re-reads
  // the full list from chain state right after this call.
  return writeContract(
    account,
    "buy_policy",
    [flightNumber, departureDate, String(departureTs)], // String() for int params, per build guide lesson
    toRawUnits(premiumGen)
  );
}

export async function depositReserve(
  account: SigningAccount,
  amountGen: string
): Promise<string> {
  return writeContract(account, "deposit_reserve", [], toRawUnits(amountGen));
}

export async function adjudicateFlight(
  account: SigningAccount,
  policyId: string,
  claimNarrative: string
): Promise<string> {
  return writeContract(account, "adjudicate_flight", [policyId, claimNarrative]);
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

export async function getTotalOutstandingExposure(): Promise<string> {
  return readContract("get_total_outstanding_exposure", []);
}

const STUDIONET_EXPLORER_BASE = "https://explorer-studio.genlayer.com";

export function explorerTxUrl(hash: string): string {
  return `${STUDIONET_EXPLORER_BASE}/tx/${hash}`;
}

export function explorerAddressUrl(address: string): string {
  return `${STUDIONET_EXPLORER_BASE}/address/${address}`;
}

export async function getReserveDepositedTotal(): Promise<string> {
  return readContract("get_reserve_deposited_total", []);
}

export { addressOf };
