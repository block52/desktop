// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import EtherscanTxLink from "./EtherscanTxLink";

const HASH = `0x${"ab".repeat(32)}`;

describe("EtherscanTxLink", () => {
    afterEach(() => {
        cleanup();
        vi.unstubAllGlobals();
    });

    it("opens the transaction on Etherscan through the desktop bridge", () => {
        const openExternal = vi.fn();
        vi.stubGlobal("electronAPI", { openExternal });
        vi.stubGlobal("window", Object.assign(window, { electronAPI: { openExternal } }));
        render(<EtherscanTxLink hash={HASH} />);
        fireEvent.click(screen.getByRole("button", { name: /View on Etherscan/ }));
        expect(openExternal).toHaveBeenCalledWith(`https://etherscan.io/tx/${HASH}`);
    });

    it("shows no link for a value that is not a transaction hash", () => {
        render(<EtherscanTxLink hash="0xnothex" />);
        expect(screen.queryByRole("button")).toBeNull();
    });
});
