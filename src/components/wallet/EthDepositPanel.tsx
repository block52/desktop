import React, { useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import ethLogo from "../../assets/crypto/eth.svg";
import usdcLogo from "../../assets/crypto/usdc.svg";
import usdtLogo from "../../assets/crypto/usdt.svg";
import wbtcLogo from "../../assets/crypto/wbtc.svg";
import { ETH_ASSETS, formatUnits, parseUnits } from "../../config/ethTokens";
import type { EthAssetSymbol } from "../../config/ethTokens";
import { ETH_DEPOSIT_TOKENS } from "../../wallet/types";
import type { EthBalances, EthDepositToken } from "../../wallet/types";
import dialog from "../modal/TableDialog.module.css";
import AddressPill from "./AddressPill";
import styles from "./EthDepositPanel.module.css";

const LOGOS: Record<EthAssetSymbol, string> = { ETH: ethLogo, USDC: usdcLogo, USDT: usdtLogo, wBTC: wbtcLogo };

function balanceOf(balances: EthBalances, symbol: EthAssetSymbol): bigint {
    if (symbol === "ETH") return balances.eth;
    if (symbol === "USDC") return balances.usdc;
    if (symbol === "USDT") return balances.usdt;
    return balances.wbtc;
}

function isDepositToken(symbol: EthAssetSymbol): symbol is EthDepositToken {
    return (ETH_DEPOSIT_TOKENS as readonly string[]).includes(symbol);
}

interface EthDepositPanelProps {
    /** A deposit was sent: refresh the Block52 balance. */
    onCompleted: () => void;
}

/**
 * Deposit from Ethereum with an address derived from the wallet's own seed phrase: send tokens to it, then move USDC or
 * USDT on to Block52 with one click. The key never leaves the main process; this page only shows the address and asks.
 */
const EthDepositPanel: React.FC<EthDepositPanelProps> = ({ onCompleted }) => {
    const bridge = window.electronAPI?.wallet;
    const [address, setAddress] = useState<string | null>(null);
    const [balances, setBalances] = useState<EthBalances | null>(null);
    const [token, setToken] = useState<EthDepositToken>("USDC");
    const [amount, setAmount] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [sent, setSent] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (bridge === undefined) return;
        setIsLoading(true);
        try {
            setBalances(await bridge.ethBalances());
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not read the balances.");
        } finally {
            setIsLoading(false);
        }
    }, [bridge]);

    useEffect(() => {
        if (bridge === undefined) return;
        let cancelled = false;
        bridge
            .ethAddress()
            .then(next => {
                if (!cancelled) setAddress(next);
            })
            .catch((err: unknown) => {
                if (!cancelled) setError(err instanceof Error ? err.message : "Could not derive the address.");
            });
        void refresh();
        return () => {
            cancelled = true;
        };
    }, [bridge, refresh]);

    if (bridge === undefined) return <p className={dialog.body}>The Ethereum deposit address is available in the desktop app.</p>;

    const held = balances === null ? 0n : balanceOf(balances, token);
    const parsed = parseUnits(amount, 6);
    const canSend = parsed !== null && parsed > 0n && parsed <= held && !isSending;

    const send = async () => {
        if (parsed === null) return;
        setIsSending(true);
        setError("");
        setSent(null);
        try {
            const result = await bridge.ethDeposit(token, parsed);
            setSent(result.depositHash);
            setAmount("");
            onCompleted();
            await refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "The deposit did not go through.");
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className={styles.panel}>
            <p className={dialog.body}>Send ETH, USDC, USDT or wBTC on Ethereum mainnet to this address.</p>

            {address !== null && (
                <>
                    <div className={styles.qr}>
                        <QRCodeSVG value={address} size={176} level="M" marginSize={2} />
                    </div>
                    <AddressPill address={address} copyMessage="Ethereum address copied" copyTitle="Copy Ethereum address" />
                </>
            )}

            <div className={styles.listHead}>
                <span className="section-label">On this address</span>
                <button type="button" className={styles.refresh} onClick={() => void refresh()} disabled={isLoading} aria-label="Refresh balances">
                    {isLoading ? "Refreshing…" : "Refresh"}
                </button>
            </div>
            <ul className={styles.assets}>
                {ETH_ASSETS.map(asset => (
                    <li key={asset.symbol} className={styles.asset}>
                        <img src={LOGOS[asset.symbol]} alt="" className={styles.logo} />
                        <span className={styles.symbol}>{asset.symbol}</span>
                        <span className={styles.balance}>{balances === null ? "…" : formatUnits(balanceOf(balances, asset.symbol), asset.decimals)}</span>
                    </li>
                ))}
            </ul>

            <div className={styles.depositRow} role="radiogroup" aria-label="Token to deposit">
                {ETH_ASSETS.filter(asset => isDepositToken(asset.symbol)).map(asset => (
                    <button
                        key={asset.symbol}
                        type="button"
                        role="radio"
                        aria-checked={token === asset.symbol}
                        className={`${styles.tokenChoice} ${token === asset.symbol ? styles.tokenChoiceOn : ""}`}
                        onClick={() => {
                            if (isDepositToken(asset.symbol)) setToken(asset.symbol);
                            setAmount("");
                        }}
                    >
                        {asset.symbol}
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
            {error !== "" && <p className={dialog.error}>{error}</p>}
            {sent !== null && <p className={dialog.body}>Sent. Your Block52 balance updates once the bridge has minted it.</p>}
            <div className={dialog.actions}>
                <button type="button" className={`btn-glow ${dialog.action}`} onClick={() => void send()} disabled={!canSend}>
                    {isSending ? "Waiting for Ethereum…" : "Deposit to Block52"}
                </button>
            </div>
        </div>
    );
};

export default EthDepositPanel;
