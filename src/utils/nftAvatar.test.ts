import { describe, expect, it } from "vitest";
import { buildNftAuthorizationMessage, isEthAddress, mapIndexerNfts, nextIndexerPageToken } from "./nftAvatar";

describe("buildNftAuthorizationMessage", () => {
    it("lowercases the ethereum address and the contract", () => {
        expect(buildNftAuthorizationMessage("0xABCDEF0000000000000000000000000000000001", "b521xyz", "0xCONTRACT", "42")).toBe(
            "I, 0xabcdef0000000000000000000000000000000001, authorize b521xyz to use NFT 0xcontract:42"
        );
    });
});

describe("isEthAddress", () => {
    it("accepts 0x + 40 hex and rejects the rest", () => {
        expect(isEthAddress("0x1234567890abcdef1234567890ABCDEF12345678")).toBe(true);
        expect(isEthAddress("0x1234")).toBe(false);
        expect(isEthAddress("1234567890abcdef1234567890ABCDEF12345678")).toBe(false);
    });
});

describe("mapIndexerNfts", () => {
    it("maps owned NFTs, normalising hex token ids and ipfs images, and drops unusable ones", () => {
        const assets = mapIndexerNfts({
            ownedNfts: [
                { contract: { address: "0xaaa" }, tokenId: "0x2a", name: "Nouns 42", image: { thumbnailUrl: "https://cdn.example/42.png" }, collection: { name: "Nouns" } },
                { contract: { address: "0xbbb" }, tokenId: "7", metadata: { image: "ipfs://bafy/7.png" } },
                { contract: { address: "0xccc" }, tokenId: "9" },
                { tokenId: "1", image: { cachedUrl: "https://cdn.example/1.png" } },
                { contract: { address: "0xddd" }, tokenId: "3", image: { cachedUrl: "file:///etc/passwd" } }
            ]
        });
        expect(assets).toEqual([
            { id: "0xaaa:42", contractAddress: "0xaaa", tokenId: "42", imageUrl: "https://cdn.example/42.png", name: "Nouns 42", collectionName: "Nouns" },
            { id: "0xbbb:7", contractAddress: "0xbbb", tokenId: "7", imageUrl: "https://dweb.link/ipfs/bafy/7.png", name: undefined, collectionName: undefined }
        ]);
    });
});

describe("nextIndexerPageToken", () => {
    it("reads the first cursor-like field", () => {
        expect(nextIndexerPageToken({ pageKey: "a" })).toBe("a");
        expect(nextIndexerPageToken({ cursor: "c" })).toBe("c");
        expect(nextIndexerPageToken({})).toBeNull();
    });
});
