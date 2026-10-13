import { describe, expect, it } from "vitest";
import { avatarImageCandidates } from "./playerAvatar";

const CONTRACT = "0x" + "a".repeat(40);

describe("avatarImageCandidates", () => {
    it("returns nothing for an empty avatar", () => {
        expect(avatarImageCandidates(undefined)).toEqual([]);
        expect(avatarImageCandidates("  ")).toEqual([]);
    });

    it("expands an nft ipfs ref across gateways", () => {
        const urls = avatarImageCandidates(`nft:eip155:1/erc721:${CONTRACT}/42|ipfs://bafyCID/1.png`);
        expect(urls[0]).toBe("https://dweb.link/ipfs/bafyCID/1.png");
        expect(urls.length).toBeGreaterThan(1);
    });

    it("re-roots a gateway url onto the fallback chain", () => {
        expect(avatarImageCandidates("https://ipfs.io/ipfs/QmABC/x.png")[0]).toBe("https://dweb.link/ipfs/QmABC/x.png");
    });

    it("passes an image from a trusted NFT media host through", () => {
        expect(avatarImageCandidates(`nft:eip155:1/erc721:${CONTRACT}/7|https://nft-cdn.alchemy.com/eth-mainnet/abc`)).toEqual([
            "https://nft-cdn.alchemy.com/eth-mainnet/abc"
        ]);
    });

    it("drops an image on a host the player controls (it would reveal every viewer's IP)", () => {
        expect(avatarImageCandidates(`nft:eip155:1/erc721:${CONTRACT}/7|https://cdn.example.com/a.png`)).toEqual([]);
        expect(avatarImageCandidates("http://tracker.example.com/pixel.png")).toEqual([]);
    });

    it("rejects unsupported schemes", () => {
        expect(avatarImageCandidates("javascript:alert(1)")).toEqual([]);
    });
});
