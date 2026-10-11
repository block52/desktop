import { ethers } from "ethers";
import type { NetworkEndpoints } from "../context/NetworkContext";
import { getSigningClient } from "./cosmos/client";

export interface WalletNftAsset {
    id: string;
    contractAddress: string;
    tokenId: string;
    imageUrl: string;
    name?: string;
    collectionName?: string;
}

export interface OnChainNftAvatar {
    /** The Ethereum address that signed the registration: the player's linked wallet. */
    ethAddress: string;
    contractAddress: string;
    tokenId: string;
}

/** True for a well-formed 0x-prefixed Ethereum address (any checksum case). */
export function isEthAddress(value: string): boolean {
    return /^0x[0-9a-fA-F]{40}$/.test(value.trim());
}

/** The sentence the Ethereum wallet signs to authorise a Block52 address to use an NFT. */
export function buildNftAuthorizationMessage(ethAddress: string, cosmosAddress: string, contractAddress: string, tokenId: string): string {
    return `I, ${ethAddress.toLowerCase()}, authorize ${cosmosAddress} to use NFT ${contractAddress.toLowerCase()}:${tokenId}`;
}

/** Fail early, with a message the player can act on, when the wallet signed with a different account than shown. */
export function assertNftAuthorizationSigner(message: string, signature: string, expectedEthAddress: string): void {
    const signer = ethers.verifyMessage(message, signature);
    if (signer.toLowerCase() !== expectedEthAddress.toLowerCase()) {
        throw new Error(
            `Your wallet signed with ${signer}, but the avatar is being linked to ${expectedEthAddress}. Switch your wallet to ${expectedEthAddress} (or reconnect) and try again.`
        );
    }
}

/** The chain answers "nothing registered" with either a 404 or a wrapped 500; neither is a failure. */
function isNotRegisteredResponse(body: string): boolean {
    return /collections: not found|no NFT avatar registered/i.test(body);
}

export async function queryNftAvatar(restEndpoint: string, cosmosAddress: string, signal?: AbortSignal): Promise<OnChainNftAvatar | null> {
    const response = await fetch(`${restEndpoint.replace(/\/+$/, "")}/pokerchain/poker/nft_avatar/${cosmosAddress}`, { signal });
    if (!response.ok) {
        if (response.status === 404 || isNotRegisteredResponse(await response.text())) return null;
        throw new Error(`Could not read your avatar (${response.status})`);
    }
    const data = (await response.json()) as { eth_address?: string; contract_address?: string; token_id?: string };
    if (data.contract_address === undefined || data.token_id === undefined || data.eth_address === undefined) return null;
    return { ethAddress: data.eth_address, contractAddress: data.contract_address, tokenId: data.token_id };
}

/** Send the signed registration to the chain, signed by the Block52 key. Returns the tx hash. */
export async function registerNftAvatar(
    network: NetworkEndpoints,
    ethAddress: string,
    contractAddress: string,
    tokenId: string,
    ethSignature: string
): Promise<string> {
    const { signingClient } = await getSigningClient(network);
    return signingClient.registerNftAvatar(ethAddress, contractAddress, tokenId, ethSignature);
}

// ── Listing a wallet's NFTs through an Alchemy-style indexer ──

interface IndexerNftItem {
    contract?: { address?: string };
    tokenId?: string;
    id?: { tokenId?: string };
    name?: string;
    title?: string;
    collection?: { name?: string };
    metadata?: { image?: string };
    image?: { cachedUrl?: string; thumbnailUrl?: string; pngUrl?: string; originalUrl?: string };
    raw?: { metadata?: { image?: string } };
    rawMetadata?: { image?: string };
}

export interface IndexerPage {
    ownedNfts?: IndexerNftItem[];
    nfts?: IndexerNftItem[];
    pageKey?: string;
    nextPageKey?: string;
    nextToken?: string;
    cursor?: string;
}

const IPFS_GATEWAY = "https://dweb.link";

function toDisplayUrl(value: string): string {
    if (value.startsWith("ipfs://")) return `${IPFS_GATEWAY}/ipfs/${value.slice("ipfs://".length).replace(/^ipfs\//, "")}`;
    if (value.startsWith("ar://")) return value.replace("ar://", "https://arweave.net/");
    return value;
}

function normalizeTokenId(tokenId: string): string {
    if (!tokenId.startsWith("0x")) return tokenId;
    try {
        return BigInt(tokenId).toString();
    } catch {
        return tokenId;
    }
}

/** NFTs from one indexer page that have a contract, a token id and an https/data image. */
export function mapIndexerNfts(page: IndexerPage): WalletNftAsset[] {
    const items = page.ownedNfts ?? page.nfts ?? [];
    return items.flatMap((item): WalletNftAsset[] => {
        const contractAddress = item.contract?.address;
        const rawTokenId = item.tokenId ?? item.id?.tokenId;
        if (contractAddress === undefined || contractAddress === "" || rawTokenId === undefined || rawTokenId === "") return [];
        const tokenId = normalizeTokenId(rawTokenId);
        // A seat avatar is small: prefer the CDN thumbnail over a raw multi-MB original.
        const rawImage =
            item.image?.thumbnailUrl ??
            item.image?.cachedUrl ??
            item.image?.pngUrl ??
            item.image?.originalUrl ??
            item.metadata?.image ??
            item.rawMetadata?.image ??
            item.raw?.metadata?.image;
        if (rawImage === undefined || rawImage === "") return [];
        const imageUrl = toDisplayUrl(rawImage);
        if (!/^(https?:\/\/|data:)/.test(imageUrl)) return [];
        return [
            {
                id: `${contractAddress}:${tokenId}`,
                contractAddress,
                tokenId,
                imageUrl,
                name: item.name ?? item.title,
                collectionName: item.collection?.name
            }
        ];
    });
}

export function nextIndexerPageToken(page: IndexerPage): string | null {
    return page.pageKey ?? page.nextPageKey ?? page.nextToken ?? page.cursor ?? null;
}

/**
 * Where to list NFTs from: VITE_PROFILE_NFT_INDEXER_URL (a URL template with {owner} / {chainId}), or
 * an Alchemy mainnet RPC URL in VITE_MAINNET_RPC_URL. Null when neither is set.
 */
export function nftIndexerUrl(owner: string): string | null {
    const template: unknown = import.meta.env.VITE_PROFILE_NFT_INDEXER_URL;
    if (typeof template === "string" && template.trim() !== "") {
        return template.trim().replace(/\{owner\}/g, owner).replace(/\{chainId\}/g, "1");
    }
    const rpc: unknown = import.meta.env.VITE_MAINNET_RPC_URL;
    if (typeof rpc === "string") {
        const match = rpc.match(/^(.*)\/v2\/([^/]+)$/);
        if (match !== null) return `${match[1]}/nft/v3/${match[2]}/getNFTsForOwner?owner=${owner}&withMetadata=true&pageSize=100`;
    }
    return null;
}

const MAX_PAGES = 20;

export async function fetchWalletNfts(owner: string, signal?: AbortSignal): Promise<WalletNftAsset[]> {
    const baseUrl = nftIndexerUrl(owner);
    if (baseUrl === null) throw new Error("No NFT source configured. Set VITE_PROFILE_NFT_INDEXER_URL or VITE_MAINNET_RPC_URL.");

    const assets = new Map<string, WalletNftAsset>();
    let pageToken: string | null = null;
    for (let index = 0; index < MAX_PAGES; index += 1) {
        const url = new URL(baseUrl);
        if (pageToken !== null) url.searchParams.set("pageKey", pageToken);
        const response = await fetch(url.toString(), { signal });
        if (!response.ok) throw new Error(`NFT source responded ${response.status}`);
        const page = (await response.json()) as IndexerPage;
        for (const asset of mapIndexerNfts(page)) assets.set(asset.id, asset);
        pageToken = nextIndexerPageToken(page);
        if (pageToken === null) break;
    }
    return [...assets.values()];
}
