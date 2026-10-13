/**
 * Cosmos Client creation and management
 *
 * This file provides a minimal wrapper around the SDK's CosmosClient
 * with singleton pattern for the frontend.
 */

import {
  CosmosClient,
  getDefaultCosmosConfig as getDefaultCosmosConfigSDK,
  COSMOS_CONSTANTS,
  SigningCosmosClient,
} from "@block52/poker-vm-sdk";
import { SIGNING_METHODS } from "../../wallet/types";
import type { SigningMethod } from "../../wallet/types";
import { getCosmosAddress } from "./storage";
import { getCosmosUrls, NetworkEndpoints } from "./urls";
import { requireWalletBridge } from "./walletBridge";

// Local type definition (not exported from SDK main index)
interface CosmosConfig {
  rpcEndpoint: string;
  restEndpoint: string;
  chainId: string;
  prefix: string;
  denom: string;
  gasPrice: string;
}

// Re-export types and constants from SDK
export type { CosmosClient };
export { COSMOS_CONSTANTS };

// Re-export getCosmosUrls for REST endpoint queries
export { getCosmosUrls };

/**
 * Get default cosmos configuration with environment variable overrides
 * Uses SDK's getDefaultCosmosConfig() and overrides with env vars if present
 */
export const getDefaultCosmosConfig = (
  network: NetworkEndpoints,
): CosmosConfig => {
  const sdkConfig = getDefaultCosmosConfigSDK();
  const { rpcEndpoint, restEndpoint } = getCosmosUrls(network);

  return {
    ...sdkConfig,
    rpcEndpoint,
    restEndpoint,
  };
};

/**
 * Get cosmos configuration with custom endpoints
 * Used when switching networks dynamically
 */
export const getCosmosConfigWithEndpoints = (
  rpcEndpoint: string,
  restEndpoint: string,
): CosmosConfig => {
  const sdkConfig = getDefaultCosmosConfigSDK();

  return {
    ...sdkConfig,
    rpcEndpoint,
    restEndpoint,
  };
};

/**
 * Get singleton Cosmos client instance
 * This ensures we reuse the same client across the app
 */
let clientInstance: CosmosClient | null = null;
let currentEndpoints: { rpc: string; rest: string } | null = null;

export const getCosmosClient = (
  networkOrEndpoints: NetworkEndpoints | { rpc: string; rest: string },
): CosmosClient | null => {
  // Determine if we have custom endpoints or a network config
  const customEndpoints =
    "rpc" in networkOrEndpoints &&
    "rest" in networkOrEndpoints &&
    !("name" in networkOrEndpoints)
      ? (networkOrEndpoints as { rpc: string; rest: string })
      : null;

  const network = customEndpoints
    ? null
    : (networkOrEndpoints as NetworkEndpoints);

  // Get the actual endpoints to use (either custom or from network config)
  const newEndpoints = customEndpoints
    ? { rpc: customEndpoints.rpc, rest: customEndpoints.rest }
    : { rpc: network!.rpc, rest: network!.rest };

  // Clear client if endpoints have changed (network switch or custom endpoint change)
  if (
    currentEndpoints &&
    (currentEndpoints.rpc !== newEndpoints.rpc ||
      currentEndpoints.rest !== newEndpoints.rest)
  ) {
    clientInstance = null;
  }

  if (!clientInstance) {
    const config = customEndpoints
      ? getCosmosConfigWithEndpoints(customEndpoints.rpc, customEndpoints.rest)
      : getDefaultCosmosConfig(network!);

    // Read-only: signing happens in the main process, never with a key held here.
    clientInstance = new CosmosClient(config);

    // Track current endpoints for change detection
    currentEndpoints = newEndpoints;
  }

  return clientInstance;
};

/**
 * Clear the cached client instance (useful when changing wallets or networks)
 */
export const clearCosmosClient = (): void => {
  clientInstance = null;
  currentEndpoints = null;
};

/**
 * The signing client that runs in the main process (see src/wallet/signer.ts). The page gets only these
 * methods; each call is sent over IPC and signed there, so the seed phrase never reaches the page.
 */
export type RemoteSigningClient = Pick<SigningCosmosClient, SigningMethod>;

export interface SigningClientResult {
  signingClient: RemoteSigningClient;
  userAddress: string;
}

function remoteSigningClient(network: NetworkEndpoints): RemoteSigningClient {
  const bridge = requireWalletBridge();
  const { rpcEndpoint, restEndpoint } = getCosmosUrls(network);
  const endpoints = { rpc: rpcEndpoint, rest: restEndpoint };
  const methods = SIGNING_METHODS.map((method) => [
    method,
    (...args: unknown[]) => bridge.signingCall(endpoints, method, args),
  ]);
  return Object.fromEntries(methods) as unknown as RemoteSigningClient;
}

/**
 * Get the signing client for the current wallet + network.
 *
 * The main process builds and caches the real client (the expensive key derivation runs once per
 * network there), so this is cheap.
 *
 * @throws Error if Cosmos wallet is not initialized (no address)
 */
export async function getSigningClient(network: NetworkEndpoints): Promise<SigningClientResult> {
  const userAddress = getCosmosAddress();

  if (!userAddress) {
    throw new Error(
      "Block52 wallet not initialized. Please create or import a Block52 wallet first.",
    );
  }

  return { signingClient: remoteSigningClient(network), userAddress };
}

/**
 * Drop the main process's cached signing client so the next call reconnects.
 *
 * Call on: logout, wallet import/change, network switch, and from
 * withMoneyMoverRetry's error-recovery path below.
 */
export async function clearSigningClientCache(): Promise<void> {
  await window.electronAPI?.wallet.resetSigner();
}

/**
 * Does this error look like a Cosmos account-sequence mismatch (SDK code 32,
 * "account sequence mismatch, expected N, got M")?
 *
 * Every tx from an account carries an account sequence. When a prior tx is
 * still pending in the mempool (accepted by CheckTx but not yet committed),
 * a fresh getSequence query still returns the pre-increment value, so the
 * next tx signs a sequence that collides and the chain rejects it with this
 * error. Repeatable while the pending tx sits uncommitted.
 *
 * This is NOT limited to money-movers (join/leave). Any gameplay action
 * (bet/call/raise/fold/sit-out/etc.) that races a still-pending prior
 * transaction from the same account can hit it too, which is why
 * executeTransportAction (src/hooks/playerActions/transportAction.ts) also
 * recovers from it, via its own separate retry path.
 */
export function isSequenceMismatchError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err ?? "");
  return /account sequence mismatch/i.test(message);
}

/**
 * Heuristic: does this error look like a dead RPC connection rather than a
 * chain-level rejection? Errs on the side of NOT retrying — a false
 * negative just means we don't retry a recoverable failure; a false
 * positive could double-submit a tx that was actually rejected.
 */
export function isTransportError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const message = (err as { message?: unknown }).message;
  if (typeof message !== "string") return false;
  const lower = message.toLowerCase();
  return (
    lower.includes("network") ||
    lower.includes("fetch") ||
    lower.includes("socket") ||
    lower.includes("econnreset") ||
    lower.includes("econnrefused") ||
    lower.includes("etimedout") ||
    lower.includes("disconnected") ||
    lower.includes("connection")
  );
}

export const SEQUENCE_RETRY_DELAY_MS = 1500;

/**
 * Run a chain-direct MONEY-MOVER (join / leave / top-up) with recovery for
 * the two ways a cached client + ordered sequence can transiently fail:
 *
 *   - Transport error (stale RPC socket): clear the cache, reconnect, retry.
 *   - Sequence mismatch (a prior money-mover still pending in the mempool):
 *     clear the cache so the retry reconnects and re-queries the sequence,
 *     wait a beat for the pending tx to commit and bump the on-chain
 *     sequence, then retry.
 *
 * A single retry after a short delay clears the common "pending tx not yet
 * committed" case. This does NOT loop — a persistently wedged account
 * surfaces the error so it isn't silently masked.
 *
 * Gameplay actions must NOT use this — they have their own retry path (see
 * executeTransportAction in transportAction.ts), which also recovers from a
 * sequence mismatch and additionally rewrites a stale action-index error
 * into a user-facing retryable prompt specific to gameplay's replay
 * protection scheme.
 */
export async function withMoneyMoverRetry<T>(
  network: NetworkEndpoints,
  fn: (client: SigningClientResult) => Promise<T>,
): Promise<T> {
  const client = await getSigningClient(network);
  try {
    return await fn(client);
  } catch (err) {
    const sequenceMismatch = isSequenceMismatchError(err);
    if (!isTransportError(err) && !sequenceMismatch) {
      throw err;
    }
    // Force a fresh client so the retry re-queries the account sequence.
    await clearSigningClientCache();
    if (sequenceMismatch) {
      // Give the pending money-mover a chance to commit so the re-query
      // returns the advanced sequence instead of the same stale value.
      await new Promise((resolve) => setTimeout(resolve, SEQUENCE_RETRY_DELAY_MS));
    }
    const fresh = await getSigningClient(network);
    return fn(fresh);
  }
}
