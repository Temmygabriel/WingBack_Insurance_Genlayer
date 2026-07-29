// lib/wallet.ts
//
// Real MetaMask wallet integration — this is additive alongside the existing
// auto-generated browser account in App.tsx, not a replacement. Per
// genlayer-js's own docs, passing a plain address string (rather than an
// Account object with a private key) as `account` to createClient makes it
// rely on the injected browser wallet (MetaMask) for signing instead of a
// locally-held key.
//
// Chain parameters below were confirmed directly from the genlayer-js
// package source (dist/chunk-*.js, studionet chain definition) — not
// guessed:
//   id: 61999
//   rpcUrls.default.http: ["https://studio.genlayer.com/api"]
//   nativeCurrency: { name: "GEN Token", symbol: "GEN", decimals: 18 }

export const STUDIONET_CHAIN_ID_DECIMAL = 61999;
export const STUDIONET_CHAIN_ID_HEX = "0xf22f"; // 61999 in hex, confirmed by conversion
export const STUDIONET_RPC_URL = "https://studio.genlayer.com/api";
export const STUDIONET_EXPLORER_URL = "https://genlayer-explorer.vercel.app";

export function isMetaMaskAvailable(): boolean {
  return typeof window !== "undefined" && !!(window as any).ethereum;
}

async function addOrSwitchToStudionet(ethereum: any): Promise<void> {
  try {
    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: STUDIONET_CHAIN_ID_HEX }],
    });
  } catch (switchError: any) {
    // Error code 4902 = chain hasn't been added to this wallet yet.
    if (switchError?.code === 4902) {
      await ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: STUDIONET_CHAIN_ID_HEX,
            chainName: "GenLayer Studio Network",
            rpcUrls: [STUDIONET_RPC_URL],
            nativeCurrency: { name: "GEN Token", symbol: "GEN", decimals: 18 },
            blockExplorerUrls: [STUDIONET_EXPLORER_URL],
          },
        ],
      });
    } else {
      throw switchError;
    }
  }
}

/**
 * Prompts MetaMask to connect, adds/switches to GenLayer Studio Network if
 * needed, and returns the connected address. Throws with a readable message
 * on any failure (no MetaMask installed, user rejected, network switch
 * failed) — callers should catch and surface e.message directly.
 */
export async function connectMetaMaskWallet(): Promise<string> {
  const ethereum = (window as any).ethereum;
  if (!ethereum) {
    throw new Error(
      "No wallet was detected in this browser. Install MetaMask (or a compatible wallet) and try again."
    );
  }

  const accounts: string[] = await ethereum.request({ method: "eth_requestAccounts" });
  if (!accounts || accounts.length === 0) {
    throw new Error("No account was returned by the wallet.");
  }

  await addOrSwitchToStudionet(ethereum);

  return accounts[0];
}
