import CopyButton from "../copyButton/CopyButton";
import type { AccountListItem } from "../../hooks/useAccountsList";
import type { AccountTx } from "../../hooks/useAccountTransactions";
import styles from "./AccountsColumn.module.css";

export type AccountSortField = "address" | "balance" | "lastActive";

interface AccountsColumnProps {
    sortBy: AccountSortField;
    sortOrder: "asc" | "desc";
    onSort: (field: AccountSortField) => void;
    accounts: AccountListItem[];
    total: number;
    isLoading: boolean;
    error: string;
    selectedAddress: string | null;
    onSelectAddress: (address: string | null) => void;
    selectedTxs: AccountTx[];
    txsLoading: boolean;
    txsError: string;
    onTxClick: (hash: string) => void;
    hasMore: boolean;
    expanded: boolean;
    onToggleShowAll: () => void;
}

function truncateAddress(address: string): string {
    return `${address.slice(0, 10)}…${address.slice(-6)}`;
}

function formatAge(iso: string): string {
    const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}

function formatBalance(value: number): string {
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDenom(denom: string): string {
    if (denom.toLowerCase() === "usdc" || denom.toLowerCase() === "uusdc") return "USDC";
    if (denom.startsWith("u")) return denom.slice(1).toUpperCase();
    return denom.toUpperCase();
}

function formatCoin(amount: string, denom: string): string {
    const value = Number(amount) / 1_000_000;
    const formatted = Number.isFinite(value)
        ? value.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 6
          })
        : amount;
    return `${formatted} ${formatDenom(denom)}`;
}

const UserIcon: React.FC = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
    </svg>
);

const AccountsColumn: React.FC<AccountsColumnProps> = ({
    sortBy,
    sortOrder,
    onSort,
    accounts,
    total,
    isLoading,
    error,
    selectedAddress,
    onSelectAddress,
    selectedTxs,
    txsLoading,
    txsError,
    onTxClick,
    hasMore,
    expanded,
    onToggleShowAll
}) => {
    const arrow = (field: AccountSortField) => (sortBy === field ? (sortOrder === "asc" ? " ↑" : " ↓") : "");
    return (
        <div className={styles.column}>
            <div className={styles.columnHead}>
                <h2 className={styles.columnTitle}>Accounts</h2>
                <span className={styles.total}>{total.toLocaleString()}</span>
            </div>
            <div className={`pane-lite ${styles.panel}`}>
                {isLoading && accounts.length === 0 && (
                    <div className={styles.stateBox}>
                        <div className={styles.spinner} />
                        <p className={styles.stateText}>Loading accounts…</p>
                    </div>
                )}

                {error !== "" && (
                    <div className={styles.stateBox}>
                        <p className={styles.stateText}>{error}</p>
                    </div>
                )}

                {error === "" && !isLoading && accounts.length === 0 && (
                    <div className={styles.stateBox}>
                        <p className={styles.stateText}>No accounts found.</p>
                    </div>
                )}

                {accounts.length > 0 && (
                    <div className={styles.headRow}>
                        <span className={styles.headSpacer} />
                        <button type="button" className={`${styles.headButton} ${styles.headStart}`} onClick={() => onSort("address")}>
                            Address{arrow("address")}
                        </button>
                        <span className={`${styles.headType} ${styles.hideNarrow}`}>Type</span>
                        <button type="button" className={`${styles.headButton} ${styles.headBalance}`} onClick={() => onSort("balance")}>
                            Balance{arrow("balance")}
                        </button>
                        <button
                            type="button"
                            className={`${styles.headButton} ${styles.headActive} ${styles.hideNarrow}`}
                            onClick={() => onSort("lastActive")}
                        >
                            Last active{arrow("lastActive")}
                        </button>
                    </div>
                )}

                {accounts.map(account => {
                    const isSelected = account.address === selectedAddress;
                    return (
                        <div key={account.address}>
                            <div
                                className={`row-hover ${styles.accountRow} ${isSelected ? styles.accountRowSelected : ""}`}
                                onClick={() => onSelectAddress(isSelected ? null : account.address)}
                            >
                                <div className={styles.accountIcon}>
                                    <UserIcon />
                                </div>
                                <div className={styles.identity}>
                                    <span className={styles.addressLine}>
                                        <span className={styles.address}>{truncateAddress(account.address)}</span>
                                        <span onClick={e => e.stopPropagation()}>
                                            <CopyButton text={account.address} message="Address copied" title="Copy address" />
                                        </span>
                                    </span>
                                    {account.validatorMoniker !== null && (
                                        <span className={styles.validatorTag}>validator · {account.validatorMoniker}</span>
                                    )}
                                </div>
                                <span className={`${styles.typePill} ${styles.hideNarrow}`}>{account.type}</span>
                                <span className={styles.balance}>{formatBalance(account.usdcValue)}</span>
                                <span
                                    className={`${styles.lastActive} ${styles.hideNarrow}`}
                                    title={account.lastActive === null ? undefined : new Date(account.lastActive).toLocaleString()}
                                >
                                    {account.lastActive === null ? "—" : formatAge(account.lastActive)}
                                </span>
                            </div>

                            {isSelected && (
                                <div className={styles.accountDetail}>
                                    <div className={styles.kvRow}>
                                        <span className={styles.kvLabel}>Address</span>
                                        <span className={styles.kvValueWrap}>
                                            <input type="text" value={account.address} readOnly className={styles.kvInput} />
                                            <CopyButton text={account.address} message="Address copied" title="Copy address" />
                                        </span>
                                    </div>

                                    {account.validatorMoniker !== null && (
                                        <div className={styles.kvRow}>
                                            <span className={styles.kvLabel}>Validator</span>
                                            <span className={styles.kvValue}>
                                                {account.validatorMoniker}
                                                {account.validatorStatus !== null && (
                                                    <span
                                                        className={`${styles.statusPill} ${
                                                            account.validatorStatus === "BONDED" ? styles.statusBonded : styles.statusOther
                                                        }`}
                                                    >
                                                        {account.validatorStatus}
                                                    </span>
                                                )}
                                            </span>
                                        </div>
                                    )}

                                    <div className={styles.kvRow}>
                                        <span className={styles.kvLabel}>Balances</span>
                                        <span className={styles.kvValueCol}>
                                            {account.balances.length === 0 ? (
                                                <span className={styles.muted}>No balances.</span>
                                            ) : (
                                                account.balances.map(b => (
                                                    <span key={b.denom} className={styles.balanceLine}>
                                                        {formatCoin(b.amount, b.denom)}
                                                    </span>
                                                ))
                                            )}
                                        </span>
                                    </div>

                                    <div className={styles.txSection}>
                                        <span className={styles.kvLabel}>Transactions</span>
                                        {txsLoading && <span className={styles.muted}>Loading…</span>}
                                        {txsError !== "" && <span className={styles.muted}>{txsError}</span>}
                                        {!txsLoading && txsError === "" && selectedTxs.length === 0 && (
                                            <span className={styles.muted}>No transactions found for this address.</span>
                                        )}
                                        {selectedTxs.map(tx => (
                                            <div key={tx.hash} className={`row-hover ${styles.txRow}`} onClick={() => onTxClick(tx.hash)}>
                                                <span className={styles.txHash}>{`${tx.hash.slice(0, 10)}…`}</span>
                                                <span className={tx.success ? styles.txPillOk : styles.txPillFail}>
                                                    {tx.success ? "Success" : "Failed"}
                                                </span>
                                                <span className={styles.txMeta}>Block #{Number(tx.height).toLocaleString()}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
                {hasMore && (
                    <button className={styles.showAllButton} onClick={onToggleShowAll}>
                        {expanded ? "Show less" : `Show all ${total.toLocaleString()}`}
                    </button>
                )}
            </div>
        </div>
    );
};

export default AccountsColumn;
