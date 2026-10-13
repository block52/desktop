/**
 * Player NFT avatars arrive on the table state as `player.avatar`:
 *   nft:eip155:<chainId>/erc721:<contract>/<tokenId>|<imageRef>
 * or a bare image URL. The image ref is content-addressed (ipfs://<cid>/<path>) so it
 * can be served by any public gateway; callers walk the returned candidates on error.
 */

const IPFS_GATEWAYS = ["https://dweb.link", "https://w3s.link", "https://cloudflare-ipfs.com", "https://ipfs.io"];
const ARWEAVE_GATEWAY = "https://arweave.net/";
// A bare image URL is chosen by the player who registered the avatar, and every client at the table would
// request it — handing that player the viewers' IP addresses. Only hosts that serve NFT media for many
// collections are fetched directly; everything else must be content-addressed (IPFS / Arweave).
const TRUSTED_IMAGE_HOSTS = ["nft-cdn.alchemy.com", "i.seadn.io", "i2.seadn.io", "raw.seadn.io"];
const NFT_AVATAR_PATTERN = /^nft:eip155:\d+\/erc721:0x[a-fA-F0-9]{40}\/[^|]+\|(.+)$/;
const PATH_GATEWAY = /^https?:\/\/[^/]+\/ipfs\/([A-Za-z0-9]+)(?:\/(.*))?$/i;
const SUBDOMAIN_GATEWAY = /^https?:\/\/([A-Za-z0-9]+)\.ipfs\.[^/]+(?:\/(.*))?$/i;

function parseIpfsRef(value: string): { cid: string; path: string } | null {
    if (value.startsWith("ipfs://")) {
        const [cid, ...rest] = value.slice("ipfs://".length).replace(/^ipfs\//, "").split("/");
        return cid === "" ? null : { cid, path: rest.join("/") };
    }
    const sub = value.match(SUBDOMAIN_GATEWAY);
    if (sub) return { cid: sub[1], path: sub[2] ?? "" };
    const path = value.match(PATH_GATEWAY);
    if (path) return { cid: path[1], path: path[2] ?? "" };
    return null;
}

/** Ordered image URLs to try for a player's avatar; empty when there is no usable avatar. */
export function avatarImageCandidates(avatar: string | undefined | null): string[] {
    if (avatar === undefined || avatar === null) return [];
    const trimmed = avatar.trim();
    if (trimmed === "") return [];

    const nft = trimmed.match(NFT_AVATAR_PATTERN);
    const image = nft !== null ? nft[1] : trimmed;

    const ipfs = parseIpfsRef(image);
    if (ipfs !== null) {
        const suffix = ipfs.path !== "" ? `/${ipfs.path}` : "";
        return IPFS_GATEWAYS.map(gateway => `${gateway}/ipfs/${ipfs.cid}${suffix}`);
    }
    if (image.startsWith("ar://")) return [image.replace("ar://", ARWEAVE_GATEWAY)];
    if (image.startsWith("data:image/")) return [image];
    if (image.startsWith("https://")) {
        try {
            return TRUSTED_IMAGE_HOSTS.includes(new URL(image).hostname) ? [image] : [];
        } catch {
            return [];
        }
    }
    return [];
}
