import React, { useCallback, useEffect, useRef, useState } from "react";
import type { BlockResponse } from "@block52/poker-vm-sdk";
import { useNetwork } from "../../context/NetworkContext";
import { useAvgBlockTime } from "../../hooks/useAvgBlockTime";
import { useValidatorCount } from "../../hooks/useValidatorCount";
import { useAccountsList } from "../../hooks/useAccountsList";
import { useAccountTransactions } from "../../hooks/useAccountTransactions";
import { getCosmosClient } from "../../utils/cosmos/client";
import CopyButton from "../../components/copyButton/CopyButton";
import ExplorerStats from "../../components/explorer/ExplorerStats";
import AccountsColumn from "../../components/explorer/AccountsColumn";
import styles from "./BlockExplorer.module.css";

/* getTx is untyped in the SDK (returns response.data of /cosmos/tx/v1beta1/txs/{hash});
   this is the subset of tx_response the explorer renders. */
interface TxSummary {
    height: string;
    txhash: string;
    code?: number;
    raw_log?: string;
    timestamp?: string;
    gas_wanted?: string;
    gas_used?: string;
    events?: unknown[];
}

interface TxLookupResponse {
    tx_response?: TxSummary;
}

const BLOCKS_FETCH_COUNT = 20;
const ACCOUNTS_LIMIT = 15;

function truncateHash(hash: string): string {
    return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

function shortProposer(proposer: string | undefined): string {
    if (proposer === undefined) return "—";
    return `${proposer.slice(0, 6)}…${proposer.slice(-4)}`;
}

function formatAge(isoTime: string): string {
    const seconds = Math.max(0, Math.round((Date.now() - new Date(isoTime).getTime()) / 1000));
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    return `${Math.floor(minutes / 60)}h ago`;
}

const BlockExplorer: React.FC = () => {
    const { currentNetwork } = useNetwork();
    const { avgBlockTimeSeconds } = useAvgBlockTime();
    const validatorsCount = useValidatorCount();

    const [blocks, setBlocks] = useState<BlockResponse[]>([]);
    const [blocksError, setBlocksError] = useState("");
    const [selectedHeight, setSelectedHeight] = useState<string | null>(null);

    const [txQuery, setTxQuery] = useState("");
    const [txResult, setTxResult] = useState<TxSummary | null>(null);
    const [txNotFound, setTxNotFound] = useState(false);
    const [txSearching, setTxSearching] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        let cancelled = false;
        const fetchBlocks = async () => {
            try {
                const client = getCosmosClient(currentNetwork);
                if (!client) return;
                const latest = await client.getLatestBlocks(BLOCKS_FETCH_COUNT);
                if (cancelled) return;
                setBlocks([...latest].sort((a, b) => Number(b.block.header.height) - Number(a.block.header.height)));
                setBlocksError("");
            } catch (err) {
                if (!cancelled) {
                    setBlocksError(err instanceof Error ? err.message : "Failed to fetch blocks");
                }
            }
        };

        fetchBlocks();
        const interval = setInterval(fetchBlocks, 5000);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [currentNetwork]);

    const searchByHash = useCallback(
        async (hash: string) => {
            const trimmed = hash.trim();
            if (trimmed === "") return;
            setTxSearching(true);
            setTxNotFound(false);
            setTxResult(null);
            try {
                const client = getCosmosClient(currentNetwork);
                if (!client) throw new Error("Block52 client not initialized");
                const data = (await client.getTx(trimmed)) as TxLookupResponse;
                if (!data.tx_response || data.tx_response.code) {
                    setTxNotFound(true);
                } else {
                    setTxResult(data.tx_response);
                }
            } catch {
                setTxNotFound(true);
            } finally {
                setTxSearching(false);
            }
        },
        [currentNetwork]
    );

    const { accounts, total: accountsTotal, isLoading: accountsLoading, error: accountsError } = useAccountsList();
    const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
    const [showAllAccounts, setShowAllAccounts] = useState(false);
    const { txs: accountTxs, isLoading: accountTxsLoading, error: accountTxsError } = useAccountTransactions(selectedAccount);

    const latestHeight = blocks.length > 0 ? Number(blocks[0].block.header.height).toLocaleString() : null;

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <div className={styles.headerText}>
                    <h1 className={styles.title}>Block explorer</h1>
                    <p className={styles.subtitle}>Every deal, bet and payout is a transaction. Look any of them up.</p>
                </div>
                <div className={`search-field ${styles.searchPill}`} onClick={() => searchInputRef.current?.focus()}>
                    <svg className={styles.searchIcon} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <circle cx="11" cy="11" r="8" />
                        <path d="m21 21-4.3-4.3" />
                    </svg>
                    <input
                        ref={searchInputRef}
                        type="text"
                        value={txQuery}
                        onChange={e => setTxQuery(e.target.value)}
                        placeholder="Block height, tx hash or address"
                        className={styles.searchInput}
                        onKeyDown={e => {
                            if (e.key === "Enter") void searchByHash(txQuery);
                        }}
                    />
                </div>
            </div>

            <ExplorerStats
                latestHeight={latestHeight}
                avgBlockTimeSeconds={avgBlockTimeSeconds}
                accountsCount={accountsTotal}
                validatorsCount={validatorsCount}
            />

            {(txSearching || txNotFound || txResult) && (
                <div className={`pane-lite ${styles.searchCard}`}>
                    {txSearching && <p className={styles.stateText}>Searching…</p>}

                    {txNotFound && (
                        <p className={styles.notFound}>Transaction not found on {currentNetwork.name}.</p>
                    )}

                    {txResult && (
                        <div className={styles.txDetailPanel}>
                            <div className={styles.txRow}>
                                <span className={styles.txLabel}>Hash</span>
                                <span className={styles.txValueWrap}>
                                    <span className={styles.txValueMono}>{txResult.txhash}</span>
                                    <CopyButton text={txResult.txhash} message="Transaction hash copied" title="Copy hash" />
                                </span>
                            </div>
                            <div className={styles.txRow}>
                                <span className={styles.txLabel}>Height</span>
                                <span className={styles.txValueMono}>{txResult.height}</span>
                            </div>
                            <div className={styles.txRow}>
                                <span className={styles.txLabel}>Status</span>
                                <span className={txResult.code === 0 || txResult.code === undefined ? styles.txOk : styles.txFail}>
                                    {txResult.code === 0 || txResult.code === undefined ? "Success" : `Failed (code ${txResult.code})`}
                                </span>
                            </div>
                            {txResult.timestamp && (
                                <div className={styles.txRow}>
                                    <span className={styles.txLabel}>Time</span>
                                    <span className={styles.txValue}>{new Date(txResult.timestamp).toLocaleString()}</span>
                                </div>
                            )}
                            {txResult.gas_used && (
                                <div className={styles.txRow}>
                                    <span className={styles.txLabel}>Gas</span>
                                    <span className={styles.txValueMono}>
                                        {txResult.gas_used} / {txResult.gas_wanted}
                                    </span>
                                </div>
                            )}
                            {txResult.events && (
                                <div className={styles.txRow}>
                                    <span className={styles.txLabel}>Events</span>
                                    <span className={styles.txValue}>{txResult.events.length}</span>
                                </div>
                            )}
                            {txResult.raw_log && txResult.raw_log !== "" && (
                                <div className={styles.txRow}>
                                    <span className={styles.txLabel}>Log</span>
                                    <span className={styles.txValueMono}>{txResult.raw_log}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            <div className={styles.columns}>
                <div className={styles.column}>
                    <h2 className={styles.columnTitle}>Blocks</h2>
                    <div className={`pane-lite ${styles.panel}`}>
                        {blocksError !== "" && (
                            <div className={styles.stateBox}>
                                <p className={styles.stateTitle}>Failed to load blocks</p>
                                <p className={styles.stateText}>{blocksError}</p>
                            </div>
                        )}

                        {blocksError === "" && blocks.length === 0 && (
                            <div className={styles.stateBox}>
                                <div className={styles.spinner} />
                                <p className={styles.stateText}>Loading blocks…</p>
                            </div>
                        )}

                        {blocks.map(block => {
                            const height = block.block.header.height;
                            const isSelected = height === selectedHeight;
                            return (
                                <React.Fragment key={height}>
                                    <div
                                        className={`row-hover ${styles.blockRow} ${isSelected ? styles.blockRowSelected : ""}`}
                                        onClick={() => setSelectedHeight(isSelected ? null : height)}
                                    >
                                        <div className={styles.blockIcon}>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                                                <path d="m3.3 7 8.7 5 8.7-5" />
                                                <path d="M12 22V12" />
                                            </svg>
                                        </div>
                                        <div className={styles.blockIdentity}>
                                            <span className={styles.blockHeight}>#{Number(height).toLocaleString()}</span>
                                            <span className={styles.blockMeta}>
                                                {truncateHash(block.block_id.hash)} · {shortProposer(block.block.header.proposer_address)}
                                            </span>
                                        </div>
                                        <span className={styles.txChip}>{block.block.data.txs.length} txs</span>
                                        <span className={styles.blockAge}>{formatAge(block.block.header.time)}</span>
                                    </div>
                                    {isSelected && (
                                        <div className={styles.blockDetail}>
                                            <div className={styles.txRow}>
                                                <span className={styles.txLabel}>Hash</span>
                                                <span className={styles.txValueWrap}>
                                                    <span className={styles.txValueMono}>{block.block_id.hash}</span>
                                                    <CopyButton text={block.block_id.hash} message="Block hash copied" title="Copy hash" />
                                                </span>
                                            </div>
                                            <div className={styles.txRow}>
                                                <span className={styles.txLabel}>Height</span>
                                                <span className={styles.txValueMono}>{height}</span>
                                            </div>
                                            <div className={styles.txRow}>
                                                <span className={styles.txLabel}>Time</span>
                                                <span className={styles.txValue}>
                                                    {new Date(block.block.header.time).toLocaleString()}
                                                </span>
                                            </div>
                                            <div className={styles.txRow}>
                                                <span className={styles.txLabel}>Proposer</span>
                                                <span className={styles.txValueMono}>{block.block.header.proposer_address}</span>
                                            </div>
                                            <div className={styles.txRow}>
                                                <span className={styles.txLabel}>Transactions</span>
                                                <span className={styles.txValue}>{block.block.data.txs.length}</span>
                                            </div>
                                            {block.block.data.txs.length > 0 && (
                                                <div className={styles.txList}>
                                                    {block.block.data.txs.map((tx, i) => (
                                                        <span key={i} className={styles.txListItem}>
                                                            {truncateHash(tx)}
                                                            <CopyButton text={tx} message="Transaction hash copied" title="Copy hash" />
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </div>
                </div>

                <AccountsColumn
                    accounts={showAllAccounts ? accounts : accounts.slice(0, ACCOUNTS_LIMIT)}
                    total={accountsTotal}
                    isLoading={accountsLoading}
                    error={accountsError}
                    selectedAddress={selectedAccount}
                    onSelectAddress={setSelectedAccount}
                    selectedTxs={accountTxs}
                    txsLoading={accountTxsLoading}
                    txsError={accountTxsError}
                    hasMore={accountsTotal > ACCOUNTS_LIMIT}
                    expanded={showAllAccounts}
                    onToggleShowAll={() => setShowAllAccounts(v => !v)}
                    onTxClick={hash => {
                        setTxQuery(hash);
                        void searchByHash(hash);
                    }}
                />
            </div>
        </div>
    );
};

export default BlockExplorer;
