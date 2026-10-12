import { describe, expect, it } from "vitest";
import { actionErrorMessage, isPayoutAlreadyClaimed } from "./chainErrors";

const wrapped = (reason: string): Error =>
    new Error(
        `Failed to leave game: transaction 03EE06511DCFD17B5AE6976D6B1EC9D3359677AB7AEB3E246DB40DE9CF41972B failed with code 1113 — failed to execute message; message index: 0: ${reason}`
    );

describe("actionErrorMessage", () => {
    it("turns an already-claimed payout into plain words", () => {
        const err = wrapped("player b5210lpeclqj7xjd0alc796ceuq7gqyskwnsnv5waw already claimed payout: sit-and-go payout already claimed");
        expect(actionErrorMessage(err)).toBe("This prize was already collected.");
        expect(isPayoutAlreadyClaimed(err)).toBe(true);
    });

    it("keeps only the chain reason for unknown failures, without hashes or addresses", () => {
        expect(actionErrorMessage(wrapped("seat 3 cannot post 0x8c640da3688beb1f758e5c9a78b464180ed8f63d3f6dca2d07d1f3428f6cf96b"))).toBe("Seat 3 cannot post");
    });

    it("never shows an over-long chain dump", () => {
        expect(actionErrorMessage(new Error("x".repeat(300)))).toBe("Something went wrong. Please try again.");
    });
});
