import React, { useEffect, useState } from "react";
import { useNetwork } from "../../context/NetworkContext";
import { useAccountTransactions } from "../../hooks/useAccountTransactions";
import { getCosmosClient } from "../../utils/cosmos/client";
import { microToDecimal } from "../../utils/currency";
import CopyButton from "../copyButton/CopyButton";
import styles from "./ExplorerTabs.module.css";

interface Coin {
    denom: string;
    amount: string;
}

interface AddressLookupTabProps {
    /** Address to show; changing it (e.g. from a Players row) runs the lookup. */
    address: string;
    onAddressChange: (address: string) => void;
    onTxClick: (hash: string) => void;
}

function formatDenom(denom: string): string {
    if (denom.toLowerCase() === "usdc" || denom.toLowerCase() === "uusdc") return "USDC";
    return denom.startsWith("u") ? denom.slice(1).toUpperCase() : denom.toUpperCase();
}

function formatAmount(amount: string, denom: string): string {
    // Chain balances are micro-denominated integers.
    return /^\d+$/.test(amount) ? `${microToDecimal(BigInt(amount))} ${formatDenom(denom)}` : `${amount} ${formatDenom(denom)}`;
}

const AddressLookupTab: React.FC<AddressLookupTabProps> = ({ address, onAddressChange, onTxClick }) => {
    const { currentNetwork } = useNetwork();
    const [draft, setDraft] = useState(address);
    const [formatError, setFormatError] = useState("");
    const [balances, setBalances] = useState<Coin[]>([]);
    const [balancesLoading, setBalancesLoading] = useState(false);
    const [balancesError, setBalancesError] = useState("");

    const target = address === "" ? null : address;
    const { txs, isLoading: txsLoading, error: txsError } = useAccountTransactions(target);

    useEffect(() => {
        setDraft(address);
    }, [address]);

    useEffect(() => {
        setBalances([]);
        setBalancesError("");
        if (target === null) return;
        let cancelled = false;
        const load = async () => {
            setBalancesLoading(true);
            try {
                const client = getCosmosClient(currentNetwork);
                if (!client) throw new Error("Block52 client not initialized");
                const result = await client.getAllBalances(target);
                if (!cancelled) setBalances(result as Coin[]);
            } catch (err) {
                if (!cancelled) setBalancesError(err instanceof Error ? err.message : "Failed to load balances");
            } finally {
                if (!cancelled) setBalancesLoading(false);
            }
        };
        void load();
        return () => {
            cancelled = true;
        };
    }, [target, currentNetwork]);

    const submit = () => {
        const next = draft.trim();
        if (!next.startsWith("b52")) {
            setFormatError("Enter a Block52 address starting with b52");
            return;
        }
        setFormatError("");
        onAddressChange(next);
    };

    return (
        <>
            <div className={styles.toolbar}>
                <input
                    className={styles.searchInput}
                    value={draft}
                    placeholder="Search by address (b52…)"
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === "Enter") submit();
                    }}
                />
                <button type="button" className={`btn-ghost ${styles.pill}`} onClick={submit}>
                    Look up
                </button>
            </div>
            {formatError !== "" && <p className={`${styles.secondary} ${styles.stateError}`}>{formatError}</p>}

            <div className={`pane-lite ${styles.panel}`}>
                {target === null ? (
                    <p className={styles.state}>Enter a Block52 address to see its balances and transactions.</p>
                ) : (
                    <>
                        <div className={styles.row}>
                            <div className={styles.grow}>
                                <span className={styles.secondary}>Address</span>
                                <span className={styles.primary} style={{ whiteSpace: "normal", wordBreak: "break-all" }}>
                                    {target}
                                </span>
                            </div>
                            <CopyButton text={target} message="Address copied" title="Copy address" />
                        </div>

                        <div className={styles.balances}>
                            <span className={styles.secondary}>Balances</span>
                            {balancesLoading && <span className={styles.secondary}>Loading…</span>}
                            {balancesError !== "" && <span className={`${styles.secondary} ${styles.stateError}`}>{balancesError}</span>}
                            {!balancesLoading && balancesError === "" && balances.length === 0 && (
                                <span className={styles.secondary}>No balances for this address.</span>
                            )}
                            {balances.map(b => (
                                <span key={b.denom} className={styles.balanceLine}>
                                    <span>{formatDenom(b.denom)}</span>
                                    <span className={styles.num}>{formatAmount(b.amount, b.denom)}</span>
                                </span>
                            ))}
                        </div>

                        <div className={styles.balances}>
                            <span className={styles.secondary}>Transactions</span>
                            {txsLoading && <span className={styles.secondary}>Loading…</span>}
                            {txsError !== "" && <span className={`${styles.secondary} ${styles.stateError}`}>{txsError}</span>}
                            {!txsLoading && txsError === "" && txs.length === 0 && (
                                <span className={styles.secondary}>No transactions found for this address.</span>
                            )}
                        </div>
                        {txs.map(tx => (
                            <div key={tx.hash} className={`row-hover ${styles.row} ${styles.rowLink}`} onClick={() => onTxClick(tx.hash)}>
                                <div className={styles.grow}>
                                    <span className={styles.primary}>{`${tx.hash.slice(0, 16)}…${tx.hash.slice(-6)}`}</span>
                                    <span className={styles.secondary}>
                                        Block #{Number(tx.height).toLocaleString()}
                                        {tx.timestamp !== "" ? ` · ${new Date(tx.timestamp).toLocaleString()}` : ""}
                                    </span>
                                </div>
                                <span className={`${styles.num} ${tx.success ? styles.won : styles.lost}`}>{tx.success ? "Success" : "Failed"}</span>
                            </div>
                        ))}
                    </>
                )}
            </div>
        </>
    );
};

export default AddressLookupTab;
