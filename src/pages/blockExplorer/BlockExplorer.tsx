import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { BlockResponse } from "@block52/poker-vm-sdk";
import { useNetwork } from "../../context/NetworkContext";
import { useAvgBlockTime } from "../../hooks/useAvgBlockTime";
import { txHashFromBase64 } from "../../utils/txHash";
import { useRecentTxs } from "../../hooks/useRecentTxs";
import { useValidatorCount } from "../../hooks/useValidatorCount";
import { useAccountsList } from "../../hooks/useAccountsList";
import { useAccountTransactions } from "../../hooks/useAccountTransactions";
import { getCosmosClient } from "../../utils/cosmos/client";
import CopyButton from "../../components/copyButton/CopyButton";
import ExplorerStats from "../../components/explorer/ExplorerStats";
import AccountsColumn, { type AccountSortField } from "../../components/explorer/AccountsColumn";
import AddressLookupTab from "../../components/explorer/AddressLookupTab";
import PlayersTab from "../../components/explorer/PlayersTab";
import Pagination, { PAGE_SIZES } from "../../components/pagination/Pagination";
import { pageInfo, paginate } from "../../utils/paginate";
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

type ExplorerTab = "blocks" | "accounts" | "address" | "players";

const TABS: { id: ExplorerTab; label: string }[] = [
    { id: "blocks", label: "Latest blocks" },
    { id: "accounts", label: "All accounts" },
    { id: "address", label: "Address lookup" },
    { id: "players", label: "Players" }
];

/* Subset of CometBFT /block the height search renders. */
interface BlockLookup {
    height: string;
    hash: string;
    time: string;
    proposer: string;
    txCount: number;
}


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
    const navigate = useNavigate();
    const { currentNetwork } = useNetwork();
    const { avgBlockTimeSeconds } = useAvgBlockTime();
    const validatorsCount = useValidatorCount();

    const [blocks, setBlocks] = useState<BlockResponse[]>([]);
    const [chainHeight, setChainHeight] = useState(0);
    const [blocksPage, setBlocksPage] = useState(1);
    const [blocksPageSize, setBlocksPageSize] = useState<number>(PAGE_SIZES[0]);
    const [txsPage, setTxsPage] = useState(1);
    const [txsPageSize, setTxsPageSize] = useState<number>(PAGE_SIZES[0]);
    const [accountsPage, setAccountsPage] = useState(1);
    const [accountsPageSize, setAccountsPageSize] = useState<number>(PAGE_SIZES[0]);
    const [blocksError, setBlocksError] = useState("");
    const [selectedHeight, setSelectedHeight] = useState<string | null>(null);
    // height → real tx hashes of that block (block data carries raw base64 txs).
    const [blockTxHashes, setBlockTxHashes] = useState<Record<string, string[]>>({});
    const [tab, setTab] = useState<ExplorerTab>("blocks");
    const [lookupAddress, setLookupAddress] = useState("");

    const [txQuery, setTxQuery] = useState("");
    const [txResult, setTxResult] = useState<TxSummary | null>(null);
    const [txNotFound, setTxNotFound] = useState(false);
    const [txSearching, setTxSearching] = useState(false);
    const [blockResult, setBlockResult] = useState<BlockLookup | null>(null);
    const { txs: recentTxs, total: recentTxsTotal, isLoading: recentTxsLoading, error: recentTxsError } = useRecentTxs(txsPage, txsPageSize);
    const searchInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        let cancelled = false;
        const fetchBlocks = async () => {
            try {
                const client = getCosmosClient(currentNetwork);
                if (!client) return;
                // Page N is the N-th run of blocks counting back from the chain tip.
                const height = await client.getHeight();
                const newest = height - (blocksPage - 1) * blocksPageSize;
                if (newest < 1) {
                    if (!cancelled) setBlocks([]);
                    return;
                }
                const count = Math.min(blocksPageSize, newest);
                const latest = await client.getBlocks(newest - count + 1, count);
                if (cancelled) return;
                setChainHeight(height);
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
    }, [currentNetwork, blocksPage, blocksPageSize]);

    useEffect(() => {
        if (selectedHeight === null || blockTxHashes[selectedHeight] !== undefined) return;
        const block = blocks.find(b => b.block.header.height === selectedHeight);
        if (block === undefined) return;
        let cancelled = false;
        Promise.all(block.block.data.txs.map(txHashFromBase64))
            .then(hashes => {
                if (!cancelled) setBlockTxHashes(prev => ({ ...prev, [selectedHeight]: hashes }));
            })
            .catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, [selectedHeight, blocks, blockTxHashes]);

    const searchByHash = useCallback(
        async (hash: string) => {
            const trimmed = hash.trim();
            if (trimmed === "") return;
            setBlockResult(null);
            // A plain number is a block height.
            if (/^\d+$/.test(trimmed)) {
                setTxSearching(true);
                setTxNotFound(false);
                setTxResult(null);
                try {
                    const rpc = currentNetwork.rpc.replace(/\/+$/, "");
                    const response = await fetch(`${rpc}/block?height=${trimmed}`);
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    const data = (await response.json()) as {
                        result?: {
                            block_id?: { hash?: string };
                            block?: { header?: { height?: string; time?: string; proposer_address?: string }; data?: { txs?: unknown[] } };
                        };
                    };
                    const header = data.result?.block?.header;
                    if (header?.height === undefined) throw new Error("Block not found");
                    setBlockResult({
                        height: header.height,
                        hash: data.result?.block_id?.hash ?? "",
                        time: header.time ?? "",
                        proposer: header.proposer_address ?? "",
                        txCount: data.result?.block?.data?.txs?.length ?? 0
                    });
                } catch {
                    setTxNotFound(true);
                } finally {
                    setTxSearching(false);
                }
                return;
            }
            // Addresses open the lookup tab instead of a tx search.
            if (trimmed.startsWith("b52")) {
                setLookupAddress(trimmed);
                setTab("address");
                setTxResult(null);
                setTxNotFound(false);
                return;
            }
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
    const [accountSort, setAccountSort] = useState<AccountSortField>("balance");
    const [accountOrder, setAccountOrder] = useState<"asc" | "desc">("desc");

    const toggleAccountSort = (field: AccountSortField) => {
        setAccountsPage(1);
        if (accountSort === field) {
            setAccountOrder(o => (o === "asc" ? "desc" : "asc"));
        } else {
            setAccountSort(field);
            setAccountOrder(field === "address" ? "asc" : "desc");
        }
    };

    const sortedAccounts = useMemo(() => {
        const direction = accountOrder === "asc" ? 1 : -1;
        return [...accounts].sort((a, b) => {
            if (accountSort === "address") return direction * a.address.localeCompare(b.address);
            if (accountSort === "balance") return direction * (a.usdcValue - b.usdcValue);
            // Accounts with no activity sort last in either direction.
            if (a.lastActive === null && b.lastActive === null) return 0;
            if (a.lastActive === null) return 1;
            if (b.lastActive === null) return -1;
            return direction * (Date.parse(a.lastActive) - Date.parse(b.lastActive));
        });
    }, [accounts, accountSort, accountOrder]);
    const accountsSlice = paginate(sortedAccounts, accountsPage, accountsPageSize);
    const { txs: accountTxs, isLoading: accountTxsLoading, error: accountTxsError } = useAccountTransactions(selectedAccount);

    const openTx = (hash: string) => {
        setTxQuery(hash);
        void searchByHash(hash);
    };

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

            {(txSearching || txNotFound || txResult || blockResult) && (
                <div className={`pane-lite ${styles.searchCard}`}>
                    {txSearching && <p className={styles.stateText}>Searching…</p>}

                    {txNotFound && (
                        <p className={styles.notFound}>Nothing found for that search on {currentNetwork.name}.</p>
                    )}

                    {blockResult && (
                        <div className={styles.txDetailPanel}>
                            <div className={styles.txRow}>
                                <span className={styles.txLabel}>Block</span>
                                <span className={styles.txValueMono}>#{Number(blockResult.height).toLocaleString()}</span>
                            </div>
                            <div className={styles.txRow}>
                                <span className={styles.txLabel}>Hash</span>
                                <span className={styles.txValueWrap}>
                                    <span className={styles.txValueMono}>{blockResult.hash}</span>
                                    <CopyButton text={blockResult.hash} message="Block hash copied" title="Copy hash" />
                                </span>
                            </div>
                            <div className={styles.txRow}>
                                <span className={styles.txLabel}>Time</span>
                                <span className={styles.txValue}>{new Date(blockResult.time).toLocaleString()}</span>
                            </div>
                            <div className={styles.txRow}>
                                <span className={styles.txLabel}>Proposer</span>
                                <span className={styles.txValueMono}>{blockResult.proposer}</span>
                            </div>
                            <div className={styles.txRow}>
                                <span className={styles.txLabel}>Transactions</span>
                                <span className={styles.txValue}>{blockResult.txCount}</span>
                            </div>
                        </div>
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

            <div className="segmented" role="tablist" style={{ display: "flex", width: "100%", overflowX: "auto" }}>
                {TABS.map(t => (
                    <button
                        key={t.id}
                        type="button"
                        role="tab"
                        aria-selected={tab === t.id}
                        className={tab === t.id ? "seg on" : "seg"}
                        style={{ flex: 1, textAlign: "center", justifyContent: "center", whiteSpace: "nowrap" }}
                        onClick={() => setTab(t.id)}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {tab === "blocks" && (
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
                                                    {block.block.data.txs.map((_, i) => {
                                                        const hash = blockTxHashes[height]?.[i];
                                                        return (
                                                            <span key={i} className={styles.txListItem}>
                                                                {hash === undefined ? (
                                                                    "…"
                                                                ) : (
                                                                    <>
                                                                        <span style={{ cursor: "pointer" }} onClick={() => openTx(hash)}>
                                                                            {truncateHash(hash)}
                                                                        </span>
                                                                        <CopyButton text={hash} message="Transaction hash copied" title="Copy hash" />
                                                                    </>
                                                                )}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </React.Fragment>
                            );
                        })}
                        <Pagination
                            slice={pageInfo(chainHeight, blocksPage, blocksPageSize)}
                            pageSize={blocksPageSize}
                            onPageChange={setBlocksPage}
                            onPageSizeChange={size => {
                                setBlocksPageSize(size);
                                setBlocksPage(1);
                            }}
                        />
                    </div>
                </div>
                    <div className={styles.column}>
                        <h2 className={styles.columnTitle}>Transactions</h2>
                        <div className={`pane-lite ${styles.panel}`}>
                            {recentTxsLoading && recentTxs.length === 0 && (
                                <div className={styles.stateBox}>
                                    <div className={styles.spinner} />
                                    <p className={styles.stateText}>Loading transactions…</p>
                                </div>
                            )}
                            {recentTxsError !== "" && recentTxs.length === 0 && (
                                <div className={styles.stateBox}>
                                    <p className={styles.stateTitle}>Failed to load transactions</p>
                                    <p className={styles.stateText}>{recentTxsError}</p>
                                </div>
                            )}
                            {recentTxs.map(tx => (
                                <div key={tx.hash} className={`row-hover ${styles.blockRow}`} onClick={() => openTx(tx.hash)}>
                                    <div className={styles.blockIcon}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M7 7h10v10" />
                                            <path d="M7 17 17 7" />
                                        </svg>
                                    </div>
                                    <div className={styles.blockIdentity}>
                                        <span className={styles.blockHeight}>{tx.type}</span>
                                        <span className={styles.blockMeta}>{truncateHash(tx.hash)}</span>
                                    </div>
                                    <span className={tx.success ? styles.txOk : styles.txFail}>{tx.success ? "OK" : "Failed"}</span>
                                    <span className={styles.blockAge}>#{Number(tx.height).toLocaleString()}</span>
                                </div>
                            ))}
                            <Pagination
                                slice={pageInfo(recentTxsTotal, txsPage, txsPageSize)}
                                pageSize={txsPageSize}
                                disabled={recentTxsLoading}
                                onPageChange={setTxsPage}
                                onPageSizeChange={size => {
                                    setTxsPageSize(size);
                                    setTxsPage(1);
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}

            {tab === "accounts" && (
                <div className={styles.columns}>
                    <AccountsColumn
                        sortBy={accountSort}
                        sortOrder={accountOrder}
                        onSort={toggleAccountSort}
                        accounts={accountsSlice.items}
                        total={accountsTotal}
                        isLoading={accountsLoading}
                        error={accountsError}
                        selectedAddress={selectedAccount}
                        onSelectAddress={setSelectedAccount}
                        selectedTxs={accountTxs}
                        txsLoading={accountTxsLoading}
                        txsError={accountTxsError}
                        hasMore={false}
                        expanded={false}
                        onToggleShowAll={() => undefined}
                        footer={
                            <Pagination
                                slice={accountsSlice}
                                pageSize={accountsPageSize}
                                onPageChange={setAccountsPage}
                                onPageSizeChange={size => {
                                    setAccountsPageSize(size);
                                    setAccountsPage(1);
                                }}
                            />
                        }
                        onTxClick={openTx}
                    />
                </div>
            )}

            {tab === "address" && <AddressLookupTab address={lookupAddress} onAddressChange={setLookupAddress} onTxClick={openTx} />}
            {tab === "players" && <PlayersTab onOpenPlayer={address => navigate(`/players/${address}`)} />}
        </div>
    );
};

export default BlockExplorer;
