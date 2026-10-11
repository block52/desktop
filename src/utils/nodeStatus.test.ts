import { describe, expect, it } from "vitest";
import { buildNodeStatus, formatSince } from "./nodeStatus";

describe("buildNodeStatus", () => {
    it("is offline when no endpoint answered", () => {
        expect(buildNodeStatus(null, null, null).online).toBe(false);
    });

    it("reads the block header from either response shape", () => {
        const header = { height: "42", time: "2026-10-11T00:00:00Z", chain_id: "pokerchain" };
        expect(buildNodeStatus(null, { block: { header } }, null).blockHeight).toBe("42");
        expect(buildNodeStatus(null, { sdk_block: { header } }, null).chainId).toBe("pokerchain");
    });

    it("carries node info and the syncing flag", () => {
        const status = buildNodeStatus(
            { default_node_info: { moniker: "node1", network: "pokerchain" }, application_version: { version: "0.1.73", cosmos_sdk_version: "v0.50" } },
            null,
            { syncing: true }
        );
        expect(status).toMatchObject({ online: true, moniker: "node1", nodeVersion: "0.1.73", syncing: true, chainId: "pokerchain" });
    });
});

describe("formatSince", () => {
    const now = new Date("2026-10-11T12:00:00Z").getTime();
    it("formats by magnitude", () => {
        expect(formatSince("2026-10-11T11:59:52Z", now)).toBe("8s");
        expect(formatSince("2026-10-11T11:48:00Z", now)).toBe("12m");
        expect(formatSince("2026-10-11T07:48:00Z", now)).toBe("4h 12m");
        expect(formatSince("2026-10-08T07:48:00Z", now)).toBe("3d 4h 12m");
    });
});
