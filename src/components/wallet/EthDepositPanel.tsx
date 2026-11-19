import React, { useState } from "react";
import usdcLogo from "../../assets/crypto/usdc.svg";
import usdtLogo from "../../assets/crypto/usdt.svg";
import { formatShort, formatUnits, parseUnits } from "../../config/ethTokens";
import type { EthAccount } from "../../hooks/wallet/useEthAccount";
import { ETH_DEPOSIT_TOKENS } from "../../wallet/types";
import type { EthBalances, EthDepositToken } from "../../wallet/types";
import dialog from "../modal/TableDialog.module.css";
import styles from "./EthDepositPanel.module.css";

const LOGOS: Record<EthDepositToken, string> = { USDC: usdcLogo, USDT: usdtLogo };

function heldOf(balances: EthBalances | null, token: EthDepositToken): bigint {
    if (balances === null) return 0n;
    return token === "USDC" ? balances.usdc : balances.usdt;
}

/** Electron prefixes errors that cross IPC with "Error invoking remote method '…': Error: ". Show only the reason. */
function ipcMessage(err: unknown, fallback: string): string {
    const message = err instanceof Error ? err.message : fallback;
    return message.replace(/^Error invoking remote method '[^']*': (Error: )?/, "");
}

interface EthDepositPanelProps {
    /** The Ethereum wallet derived from the seed phrase, shared with the wallet card. */
    eth: EthAccount;
    /** A deposit was sent: refresh the Block52 balance. */
    onCompleted: () => void;
}

/**
 * Bridge from the Ethereum wallet to Block52: pick USDC or USDT, an amount, and deposit. The address and balances live on
 * the wallet card; this is only the transfer. The key never leaves the main process, which confirms in a native dialog.
 */
const EthDepositPanel: React.FC<EthDepositPanelProps> = ({ eth, onCompleted }) => {
    const [token, setToken] = useState<EthDepositToken>("USDC");
    const [amount, setAmount] = useState("");
    const [error, setError] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [sent, setSent] = useState(false);

    const bridge = window.electronAPI?.wallet;
    if (!eth.available || bridge === undefined) {
        return <p className={dialog.body}>Depositing from the Ethereum wallet is available in the desktop app.</p>;
    }

    const held = heldOf(eth.balances, token);
    const parsed = parseUnits(amount, 6);
    const canSend = parsed !== null && parsed > 0n && parsed <= held && !isSending;

    const send = async () => {
        if (parsed === null) return;
        setIsSending(true);
        setError("");
        setSent(false);
        try {
            await bridge.ethDeposit(token, parsed);
            setSent(true);
            setAmount("");
            onCompleted();
            await eth.refresh();
        } catch (err) {
            setError(ipcMessage(err, "The deposit did not go through."));
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className={styles.panel}>
            <span className="section-label">From your Ethereum wallet</span>
            <div className={styles.depositRow} role="radiogroup" aria-label="Token to deposit">
                {ETH_DEPOSIT_TOKENS.map(symbol => (
                    <button
                        key={symbol}
                        type="button"
                        role="radio"
                        aria-checked={token === symbol}
                        className={`${styles.tokenChoice} ${token === symbol ? styles.tokenChoiceOn : ""}`}
                        onClick={() => {
                            setToken(symbol);
                            setAmount("");
                        }}
                    >
                        <img src={LOGOS[symbol]} alt="" className={styles.logo} />
                        <span className={styles.symbol}>{symbol}</span>
                        <span className={styles.held}>{eth.balances === null ? "…" : formatShort(heldOf(eth.balances, symbol), 6, 2)}</span>
                    </button>
                ))}
            </div>
            <label className={dialog.field}>
                <span className={dialog.fieldLabel}>Amount ({token})</span>
                <span className={styles.amountRow}>
                    <input
                        className={dialog.input}
                        inputMode="decimal"
                        value={amount}
                        placeholder="0.00"
                        onChange={event => setAmount(event.target.value)}
                    />
                    <button type="button" className={styles.max} onClick={() => setAmount(formatUnits(held, 6))} disabled={held === 0n}>
                        MAX
                    </button>
                </span>
            </label>
            {eth.error !== "" && <p className={dialog.error}>{eth.error}</p>}
            {error !== "" && <p className={dialog.error}>{error}</p>}
            {sent && <p className={dialog.body}>Sent. Your Block52 balance updates once the bridge has minted it.</p>}
            <div className={dialog.actions}>
                <button type="button" className={`btn-glow ${dialog.action}`} onClick={() => void send()} disabled={!canSend}>
                    {isSending ? "Waiting for Ethereum…" : "Deposit to Block52"}
                </button>
            </div>
        </div>
    );
};

export default EthDepositPanel;
